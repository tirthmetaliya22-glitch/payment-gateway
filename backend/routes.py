import os
from typing import Optional, Annotated, Union
import secrets
import string
import json
import random
import urllib.parse
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from database import check_db_connection, get_database
import httpx
import socketio
import uuid
from bson import ObjectId

from schemas import (
    PyObjectId, Payment, Settlement, Customer, ContactInquiry,
    MerchantProfile, PasswordUpdate, LoginRequest, SupportTicket,
    SupportTicketReply, AdminSettings, MerchantInvite,
    RegenerateKeysRequest, ActivateRequest, CreateMerchantRequest,
    AddFundsRequest, WithdrawRequest, AdminWithdrawRequest
)


from fastapi import APIRouter
from socket_config import sio

router = APIRouter()

async def get_db_user_id_for_email(db, email: str):
    if not email:
        return ObjectId()
    email_regex = {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}
    merchant = await db.merchants.find_one({"email": email_regex})
    if merchant:
        if "user_id" in merchant and merchant["user_id"]:
            return merchant["user_id"]
        return merchant["_id"]
    inquiry = await db.sign_ups.find_one({"email": email_regex})
    if inquiry and "user_id" in inquiry:
        uid = inquiry["user_id"]
        if isinstance(uid, (ObjectId, str)):
            return uid
    new_uid = ObjectId()
    if inquiry:
        await db.sign_ups.update_one({"_id": inquiry["_id"]}, {"$set": {"user_id": new_uid}})
    return new_uid

def generate_secure_key(length=32):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def generate_salt(length=14):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))



async def create_cashfree_order(amount: float, customer_id: str, customer_phone: str, customer_email: str, order_id: str = None, return_url: str = None):
    """
    Create an order in Cashfree and return the payment_session_id.
    """
    app_id = os.getenv("CASHFREE_APP_ID")
    secret_key = os.getenv("CASHFREE_SECRET_KEY")
    environment = os.getenv("CASHFREE_ENVIRONMENT", "sandbox")
    
    url = "https://sandbox.cashfree.com/pg/orders" if environment == "sandbox" else "https://api.cashfree.com/pg/orders"
    
    headers = {
        "x-client-id": app_id,
        "x-client-secret": secret_key,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json"
    }
    
    payload = {
        "order_id": order_id or customer_id,
        "order_amount": amount,
        "order_currency": "INR",
        "customer_details": {
            "customer_id": customer_id,
            "customer_phone": customer_phone or "9999999999", # Cashfree requires a phone
            "customer_email": customer_email
        }
    }
    
    # Use provided return_url or default from env
    base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    payload["order_meta"] = {
        "return_url": return_url or f"{base_url}/payment-success?order_id={{order_id}}"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code == 200:
                data = response.json()
                return data.get("payment_session_id")
            else:
                print(f"Cashfree Order Error: {response.status_code} - {response.text}")
                return None
    except Exception as e:
        print(f"Cashfree Request Exception: {e}")
        return None

async def initiate_cashfree_upi_pay(payment_session_id: str):
    """
    Initiate a UPI payment to get the official QR link from Cashfree.
    """
    app_id = os.getenv("CASHFREE_APP_ID")
    secret_key = os.getenv("CASHFREE_SECRET_KEY")
    environment = os.getenv("CASHFREE_ENVIRONMENT", "sandbox")
    
    # Correct endpoint for Order Pay in v3
    url = "https://sandbox.cashfree.com/pg/orders/sessions" if environment == "sandbox" else "https://api.cashfree.com/pg/orders/sessions"
    
    headers = {
        "x-client-id": app_id,
        "x-client-secret": secret_key,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json"
    }
    
    payload = {
        "payment_session_id": payment_session_id,
        "payment_method": {
            "upi": {
                "channel": "qrcode"
            }
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code == 200:
                data = response.json()
                # Extract the UPI link (data.data.payload.qrcode or data.data.channel_data.upi_id)
                # In v3 Pay response, it's often in data.data.payload or similar
                return data.get("data", {}).get("payload", {}).get("qrcode") or data.get("data", {}).get("payment_method", {}).get("upi", {}).get("qrcode")
            else:
                print(f"Cashfree Pay Error: {response.status_code} - {response.text}")
                return None
    except Exception as e:
        print(f"Cashfree Pay Request Exception: {e}")
        return None

def add_payment_links(payment: dict):
    amount = str(payment.get("amount", "0")).replace('₹', '').replace(',', '')
    merchant_name = payment.get("merchant_name", "Merchant")
    payer_name = payment.get("name", "Customer")
    upi_id = payment.get("upi_id", "nexify@okicici")
    
    m_name_enc = urllib.parse.quote(merchant_name)
    p_name_enc = urllib.parse.quote(payer_name)
    
    upi_string = f"upi://pay?pa={upi_id}&pn={m_name_enc}&am={amount}&cu=INR&tn=Payment for {p_name_enc}"
    
    # If Cashfree UPI link is available, use it for the QR code
    if payment.get("cf_upi_link"):
        if payment.get("cf_upi_link").startswith("data:"):
            qr_link = payment.get("cf_upi_link")
        else:
            qr_link = f"https://api.qrserver.com/v1/create-qr-code/?size=600x600&data={urllib.parse.quote(payment.get('cf_upi_link'))}"
    # Else if custom QR link is provided, use it. Otherwise generate one.
    elif payment.get("custom_qr_link"):
        qr_link = payment.get("custom_qr_link")
    else:
        qr_link = f"https://api.qrserver.com/v1/create-qr-code/?size=600x600&data={urllib.parse.quote(upi_string)}"
    
    # Log the QR link in the backend console for visibility
    print(f"\n[BACKEND] QR Code Link for {payment.get('id', 'Unknown')}:")
    print(f"{qr_link}\n")
    
    payment["upi_string"] = upi_string
    payment["qr_link"] = payment.get("qr_link") or qr_link
    
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    payment["checkout_url"] = payment.get("checkout_url") or f"{frontend_url}/checkout/{payment.get('id')}"
    payment["cf_environment"] = os.getenv("CASHFREE_ENVIRONMENT", "sandbox")
    return payment

async def write_audit_log(user: str, action: str, target: str, status: str = "Normal"):
    """
    Inserts a log entry into the logs collection for audit visibility.
    """
    try:
        db = get_database()
        user_id = None
        if user:
            if "@" in user:
                user_id = await get_db_user_id_for_email(db, user)
            else:
                m = await db.merchants.find_one({"username": {"$regex": f"^{user}$", "$options": "i"}})
                if m:
                    user_id = await get_db_user_id_for_email(db, m.get("email"))
                else:
                    user_id = await get_db_user_id_for_email(db, user)
        if not user_id:
            user_id = ObjectId()
            
        log_entry = {
            "id": f"LOG-{random.randint(100000, 999999)}",
            "user": user,
            "user_id": user_id,
            "action": action,
            "target": target,
            "status": status,
            "timestamp": datetime.now().isoformat()
        }
        await db.logs.insert_one(log_entry)
        print(f"[AUDIT LOG] {action} by {user} on {target} - {status}")
    except Exception as e:
        print(f"Failed to write audit log: {e}")


@router.get("/")
async def root():
    return {"message": "Backend is running"}

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        print("[AUTH] Missing or invalid Authorization header")
        raise HTTPException(status_code=401, detail="Unauthorized: Missing or invalid token")
    
    token = authorization.split(" ")[1]
    db = get_database()
    session = await db.sessions.find_one({"token": token})
    
    if not session:
        print(f"[AUTH] Session not found for token: {token[:8]}...")
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid session")
    
    print(f"[AUTH] Authenticated: email={session.get('email')}, role={session.get('role')}")
    return session # Contains 'email' and 'role'

@router.post("/login/admin")
async def login_admin(req: LoginRequest):
    db = get_database()
    email = req.email.strip()
    password = req.password.strip()
    
    print(f"ADMIN Login attempt: email='{email}'")
    
    user_data = None
    role = "admin"
    
    # Check for default admin accounts
    if email.upper() == "HKLLP" and password == "HKLLP123":
        user_data = {"email": "HKLLP", "name": "Administrator"}
    elif email.lower() == "admin@payflow.com" and password == "password123":
        user_data = {"email": "admin@payflow.com", "name": "System Admin"}
    
    if not user_data:
        # Check database for custom admins
        db_admin = await db.merchants.find_one({
            "email": {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"},
            "password": password,
            "role": "admin"
        })
        if db_admin:
            user_data = {"email": db_admin["email"], "name": db_admin["name"]}
            
    if not user_data:
        await write_audit_log(user=email, action="Failed Login Attempt", target="Admin Portal", status="Warning")
        return {"status": "error", "message": "Invalid admin credentials"}
        
    # Generate session token
    session_token = str(uuid.uuid4())
    await db.sessions.insert_one({
        "token": session_token,
        "email": user_data["email"],
        "role": role,
        "created_at": datetime.now()
    })
    await write_audit_log(user=user_data["email"], action="Admin Login", target="Admin Dashboard", status="Normal")
    return {
        "status": "success",
        "session_token": session_token,
        "email": user_data["email"],
        "role": role,
        "name": user_data.get("name", "Administrator")
    }

@router.post("/login/merchant")
async def login_merchant(req: LoginRequest):
    db = get_database()
    email = req.email.strip()
    password = req.password.strip()
    
    print(f"MERCHANT Login attempt: identifier='{email}'")
    
    user_data = None
    role = "merchant"
    
    # Check for the default merchant
    if email.lower() == "merchant@payflow.com" and password == "password123":
        user_data = {"email": "merchant@payflow.com", "name": "Luxury Merchant"}
    else:
        # Check if merchant exists with this email/merchant_id and password (and role is not admin)
        merchant = await db.merchants.find_one({
            "$or": [
                {"email": {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}},
                {"merchant_id": {"$regex": f"^{email}$", "$options": "i"}}
            ],
            "password": password,
            "role": {"$ne": "admin"}
        })
        if merchant:
            user_data = merchant
        else:
            # Check sign_ups (inquiries) for credentials if not yet in merchants
            inquiry = await db.sign_ups.find_one({
                "$or": [
                    {"email": {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}},
                    {"username": {"$regex": f"^{email}$", "$options": "i"}}
                ],
                "password": password
            })
            if inquiry:
                user_data = inquiry

    if not user_data:
        await write_audit_log(user=email, action="Failed Login Attempt", target="Merchant Portal", status="Warning")
        return {"status": "error", "message": "Invalid merchant credentials"}
        
    # Generate session token
    session_token = str(uuid.uuid4())
    await db.sessions.insert_one({
        "token": session_token,
        "email": user_data["email"],
        "role": role,
        "created_at": datetime.now()
    })
    await write_audit_log(user=user_data["email"], action="Merchant Login", target="Merchant Dashboard", status="Normal")
    return {
        "status": "success",
        "session_token": session_token,
        "email": user_data["email"],
        "role": role,
        "name": user_data.get("name", user_data.get("email"))
    }

@router.get("/auth/verify")
async def verify_auth(current_user: dict = Depends(get_current_user)):
    """Allows the frontend to verify if a session token is still valid."""
    return {
        "status": "success",
        "email": current_user["email"],
        "role": current_user["role"]
    }


@router.post("/contact")
async def create_contact(inquiry: ContactInquiry):
    db = get_database()
    inquiry_data = inquiry.dict()
    inquiry_data["date"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    inquiry_data["active"] = False  # Must be activated by admin
    
    # Auto-generate user_id and inquiry_id if not provided
    import random
    suffix = str(random.randint(100000, 999999))
    inquiry_id = f"INQ-{suffix[-4:]}"
    
    req_user_id = inquiry.user_id
    if not req_user_id:
        user_id = ObjectId()
    else:
        user_id = req_user_id
        
    inquiry_data["user_id"] = user_id
    inquiry_data["inquiry_id"] = inquiry_id
    
    if not inquiry_data.get("created_at"):
        inquiry_data["created_at"] = datetime.now()
    if not inquiry_data.get("updated_at"):
        inquiry_data["updated_at"] = datetime.now()
    
    # Insert the inquiry
    result = await db.sign_ups.insert_one(inquiry_data)
    
    return {"status": "success", "id": str(result.inserted_id), "user_id": str(user_id), "inquiry_id": inquiry_id, "message": "Application submitted for review"}



@router.get("/merchant/profile")
async def get_merchant_profile(current_user: dict = Depends(get_current_user)):
    db = get_database()
    email = current_user["email"]
    role = current_user.get("role")
    
    # If admin, return a standard admin profile
    if role == "admin":
        return {
            "name": "System Administrator", 
            "email": email,
            "merchant_id": "ADMIN-001",
            "merchant_key": "ADMIN_OVERRIDE",
            "salt_key": "ADMIN_OVERRIDE",
            "plan": "System",
            "status": "Active"
        }
    
    # Find the merchant by email (case-insensitive)
    email_regex = {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}
    profile = await db.merchants.find_one({"email": email_regex}, {"_id": 0, "password": 0})
    
    if not profile:
        # Fallback for default hardcoded merchant
        if email.lower() == "merchant@payflow.com":
            return {
                "name": "Luxury Merchant", 
                "email": "merchant@payflow.com",
                "merchant_id": "M-9021",
                "merchant_key": "mk_live_default_key_123456",
                "salt_key": "salt_default_123",
                "plan": "Enterprise",
                "status": "Healthy",
                "business_name": "Luxury Goods Co.",
                "tax_id": "Tax ID: GB-902100000"
            }
        
        # Fallback for newly created merchants from sign-ups that might not be fully synced
        return {
            "name": email.split('@')[0].capitalize(),
            "email": email,
            "merchant_id": "M-TEMP",
            "plan": "Standard",
            "status": "Healthy",
            "business_name": "PayFlow Solutions Ltd.",
            "tax_id": "Tax ID: GB-123456789"
        }
        
    if profile and 'user_id' in profile:
        profile['user_id'] = str(profile['user_id'])
    return profile

@router.post("/merchant/profile")
async def update_profile(profile: MerchantProfile, current_user: dict = Depends(get_current_user)):
    db = get_database()
    # Ensure they only update their own profile
    email = current_user["email"]
    
    update_data = {k: v for k, v in profile.dict(exclude_none=True).items()}
    update_data["updated_at"] = datetime.now()
    
    await db.merchants.update_one(
        {"email": {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}},
        {"$set": update_data},
        upsert=True
    )
    
    # Synchronize changes with the linked sign_ups collection to ensure data integrity
    sync_data = {}
    if "name" in update_data:
        sync_data["name"] = update_data["name"]
    if "email" in update_data:
        sync_data["email"] = update_data["email"]
        
    if sync_data:
        sync_data["updated_at"] = datetime.now()
        await db.sign_ups.update_one(
            {"email": {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}},
            {"$set": sync_data}
        )
    
    await write_audit_log(user=email, action="Profile Update", target="Merchant Profile Info", status="Normal")
    return {"status": "success"}

@router.post("/merchant/password")
async def update_password(update: PasswordUpdate, current_user: dict = Depends(get_current_user)):
    db = get_database()
    email = current_user["email"]
    
    # Verify ownership or admin role
    if update.email.lower() != email.lower() and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: You can only update your own password unless you are an admin")
    
    # Find the merchant by email (case-insensitive)
    merchant = await db.merchants.find_one({
        "email": {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}
    })
    if not merchant:
        # Default merchant password update (handled separately or just allow if hardcoded)
        if email.lower() == "merchant@payflow.com":
             pass # In a real app we'd have a DB entry
        else:
            raise HTTPException(status_code=404, detail="Merchant not found")
        
    await db.merchants.update_one(
        {"email": {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}},
        {"$set": {"password": update.new_password}}
    )
    return {"status": "success"}



@router.post("/merchant/regenerate-keys")
async def regenerate_keys(req: RegenerateKeysRequest, current_user: dict = Depends(get_current_user)):
    db = get_database()
    email = current_user["email"]
    
    if req.email.lower() != email.lower() and current_user.get("role") != "admin":
         raise HTTPException(status_code=403, detail="Forbidden: Only owners or admins can regenerate keys")

    new_merchant_key = f"mk_live_{generate_secure_key()}"
    new_salt_key = generate_salt()
    
    await db.merchants.update_one(
        {"email": {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}},
        {"$set": {
            "merchant_key": new_merchant_key,
            "salt_key": new_salt_key
        }}
    )
    return {
        "status": "success", 
        "merchant_key": new_merchant_key, 
        "salt_key": new_salt_key
    }

@router.get("/db-check")
async def db_check():
    is_connected = await check_db_connection()
    if is_connected:
        return {"status": "success", "message": "Database is connected"}
    else:
        return {"status": "error", "message": "Database connection failed"}

@router.get("/hello/{name}")
async def say_hello(name: str):
    return {"message": f"Hello {name}"}
@router.get("/admin/merchants")
async def get_all_merchants(current_user: dict = Depends(get_current_user)):
    db = get_database()
    # Return all registered merchants (filter out role == "admin")
    merchants = await db.merchants.find({"role": {"$ne": "admin"}}, {"_id": 0}).to_list(length=100)
    for m in merchants:
        if 'user_id' in m:
            m['user_id'] = str(m['user_id'])
    return merchants

@router.post("/admin/merchants/{merchant_id}/wallet/add")
async def add_wallet_funds(merchant_id: str, req: AddFundsRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    
    # Find merchant by merchant_id
    merchant = await db.merchants.find_one({"merchant_id": merchant_id})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
        
    # Add funds
    current_balance = float(merchant.get("wallet_balance", 0.0))
    new_balance = current_balance + req.amount
    
    # Update balance
    await db.merchants.update_one(
        {"merchant_id": merchant_id},
        {"$set": {"wallet_balance": new_balance}}
    )
    
    # Write audit log
    await write_audit_log(
        user=current_user["email"], 
        action="Added Wallet Funds", 
        target=f"Merchant {merchant_id} (Amount: {req.amount})", 
        status="Normal"
    )
    
    return {"status": "success", "new_balance": new_balance}

@router.get("/admin/inquiries")
async def get_all_inquiries(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    inquiries = []
    async for doc in db.sign_ups.find({}):
        doc['id'] = str(doc['_id'])
        # Keep original inquiry_id if it exists, otherwise use the stringified _id
        if 'inquiry_id' not in doc:
            doc['inquiry_id'] = doc['id']
        # Keep original user_id if it exists, otherwise use fallback
        if 'user_id' not in doc:
            doc['user_id'] = await get_db_user_id_for_email(db, doc.get("email"))
        doc['user_id'] = str(doc['user_id'])
        del doc['_id']
        inquiries.append(doc)
    return inquiries


@router.get("/admin/logs")
async def get_all_logs(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    logs = await db.logs.find({}, {"_id": 0}).to_list(length=100)
    for l in logs:
        if 'user_id' in l:
            l['user_id'] = str(l['user_id'])
    return logs

@router.post("/admin/invites")
async def create_invite(invite: MerchantInvite, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    
    # 1. Check if merchant already exists
    merchant = await db.merchants.find_one({"email": invite.email})
    
    if merchant:
        # If merchant exists, create a payment request instead of an invitation
        payment_id = f"ADM-{random.randint(1000, 9999)}"
        amount_val = invite.amount if invite.amount else "0"
        
        payment_data = {
            "id": payment_id,
            "name": f"Admin Request: {invite.name}",
            "amount": f"₹{float(amount_val):,.2f}",
            "currency": "INR",
            "status": "Active",
            "merchant_name": merchant.get("name"),
            "email": invite.email, # Associate with email
            "user_id": await get_db_user_id_for_email(db, invite.email),
            "created": f"{datetime.now().strftime('%Y-%m-%d')} by Admin",
            "creation_timestamp": datetime.now().timestamp(),
            "created_by": "admin",
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }

        # Integrate Cashfree Flow
        try:
            amount_float = float(amount_val)
            if amount_float > 0:
                session_id = await create_cashfree_order(
                    amount=amount_float,
                    customer_id=f"CUST-{random.randint(1000, 9999)}",
                    customer_phone=merchant.get("phone", "9999999999"),
                    customer_email=invite.email,
                    order_id=payment_id
                )
                
                if session_id:
                    payment_data["payment_session_id"] = session_id
                    print(f"[ADMIN] Created Cashfree Session: {session_id}")
                    
                    cf_upi_link = await initiate_cashfree_upi_pay(session_id)
                    if cf_upi_link:
                        payment_data["cf_upi_link"] = cf_upi_link
                        print(f"[ADMIN] Stored Cashfree UPI Link: {cf_upi_link}")
        except Exception as e:
            print(f"Error integrating Cashfree in admin request: {e}")

        # Add standard links (QR, checkout, etc.)
        payment_data = add_payment_links(payment_data)
        
        await db.payments.insert_one(payment_data)
        if "_id" in payment_data: del payment_data["_id"]
        
        # Serialize user_id
        if "user_id" in payment_data:
            payment_data["user_id"] = str(payment_data["user_id"])
        
        # Notify via socket if they are online
        await sio.emit("payment_update", {
            "type": "NEW_PAYMENT",
            "message": f"Admin sent a payment request for {payment_data['amount']}",
            "redirect_url": "/merchant/payments"
        })
        
        return {"status": "success", "message": "Payment request created with Cashfree flow", "payment": payment_data}

    # 2. Otherwise, create a standard invitation
    invite_data = invite.dict()
    invite_data["created"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    invite_data["status"] = "Invited"
    invite_data["invite_id"] = f"INV-{random.randint(1000, 9999)}"
    invite_data["user_id"] = await get_db_user_id_for_email(db, invite.email)
    
    if not invite_data.get("created_at"):
        invite_data["created_at"] = datetime.now()
    if not invite_data.get("updated_at"):
        invite_data["updated_at"] = datetime.now()
        
    await db.invites.insert_one(invite_data)
    if "_id" in invite_data: del invite_data["_id"]
    invite_data["user_id"] = str(invite_data["user_id"])
    return {"status": "success", "invite": invite_data}

@router.post("/admin/create-payment-link")
async def admin_create_payment_link(req: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    username = req.get("username")
    payment_data = req.get("payment")
    
    if not username or not payment_data:
        raise HTTPException(status_code=400, detail="Missing username or payment data")
    
    # Look up merchant by username, ID, or email (case-insensitive)
    merchant = await db.merchants.find_one({
        "$or": [
            {"username": {"$regex": f"^{username}$", "$options": "i"}},
            {"merchant_id": {"$regex": f"^{username}$", "$options": "i"}},
            {"email": {"$regex": f"^{username}$", "$options": "i"}}
        ]
    })
    if not merchant:
        raise HTTPException(status_code=404, detail=f"No merchant found with username '{username}'")
        
    email = merchant.get("email")
    
    # Use merchant info
    payment_data["id"] = payment_data.get("order_id") or f"LNK-{random.randint(100000, 999999)}"
    payment_data["merchant_name"] = merchant.get("name", "Luxury Merchant")
    payment_data["upi_id"] = merchant.get("upi_id", "nexify@okicici")
    payment_data["email"] = email
    payment_data["user_id"] = await get_db_user_id_for_email(db, email)
    payment_data["username"] = merchant.get("username", username)
    payment_data["created"] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    payment_data["creation_timestamp"] = datetime.now().timestamp()
    payment_data["created_by"] = "admin"
    payment_data["created_at"] = datetime.now()
    payment_data["updated_at"] = datetime.now()
    
    # Create Cashfree Order
    try:
        raw_amount = payment_data.get("amount", "0")
        amount_val = float(str(raw_amount).replace('₹', '').replace(',', ''))
        
        session_id = await create_cashfree_order(
            amount=amount_val,
            customer_id=f"CUST-{random.randint(1000, 9999)}",
            customer_phone="9999999999",
            customer_email=email or "customer@example.com",
            order_id=payment_data["id"],
            return_url=payment_data.get("return_url")
        )
    except Exception as e:
        print(f"Error preparing Cashfree order: {e}")
        session_id = None
        amount_val = 0.0
    
    if session_id:
        payment_data["payment_session_id"] = session_id
        cf_upi_link = await initiate_cashfree_upi_pay(session_id)
        if cf_upi_link:
            payment_data["cf_upi_link"] = cf_upi_link
            
    payment_data = add_payment_links(payment_data)
    await db.payments.insert_one(payment_data)
    if "_id" in payment_data: del payment_data["_id"]
    
    # Serialize user_id
    if "user_id" in payment_data:
        payment_data["user_id"] = str(payment_data["user_id"])
        
    # Notify via Socket.IO
    await sio.emit("payment_update", {
        "type": "NEW_PAYMENT",
        "message": f"Admin created a payment link for you: {payment_data['amount']}",
        "redirect_url": "/merchant/payments"
    })
    
    return {"status": "success", "payment": payment_data}

@router.get("/admin/invites")
async def get_all_invites(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    invites = await db.invites.find({}, {"_id": 0}).to_list(length=100)
    for inv in invites:
        if 'user_id' in inv:
            inv['user_id'] = str(inv['user_id'])
    return invites

@router.get("/admin/tickets")
async def get_all_tickets(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    tickets = await db.tickets.find({}, {"_id": 0}).to_list(length=100)
    for t in tickets:
        if 'user_id' in t:
            t['user_id'] = str(t['user_id'])
    return tickets

@router.delete("/admin/merchants/{email}")
async def delete_merchant(email: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    email_regex = {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}
    
    # Aggressively delete from both collections to ensure full removal
    m_res = await db.merchants.delete_one({"email": email_regex})
    s_res = await db.sign_ups.delete_one({"email": email_regex})
    
    if m_res.deleted_count == 0 and s_res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Merchant or inquiry not found")
    
    # Notify via socket
    await sio.emit("admin_notification", {
        "type": "MERCHANT_DELETED",
        "message": f"Merchant deleted: {email}",
        "email": email
    })
        
    return {"status": "success", "message": "Merchant deleted successfully"}

@router.delete("/admin/inquiries/{email}")
async def delete_inquiry(email: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    email_regex = {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}
    res = await db.sign_ups.delete_one({"email": email_regex})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    return {"status": "success", "message": "Inquiry deleted successfully"}

@router.delete("/admin/invites/{email}")
async def delete_invite(email: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    email_regex = {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}
    res = await db.invites.delete_one({"email": email_regex})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invite not found")
    return {"status": "success", "message": "Invite deleted successfully"}

@router.post("/admin/tickets")
async def create_ticket(ticket: SupportTicket, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    ticket_data = ticket.dict()
    ticket_data["id"] = f"TKT-{random.randint(1000, 9999)}"
    ticket_data["created"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    merchant_name = ticket.merchant
    merchant = await db.merchants.find_one({
        "$or": [
            {"name": {"$regex": f"^{merchant_name}$", "$options": "i"}},
            {"email": {"$regex": f"^{merchant_name}$", "$options": "i"}},
            {"username": {"$regex": f"^{merchant_name}$", "$options": "i"}}
        ]
    })
    
    if merchant:
        ticket_data["user_id"] = await get_db_user_id_for_email(db, merchant["email"])
    else:
        ticket_data["user_id"] = ObjectId()
        
    if not ticket_data.get("created_at"):
        ticket_data["created_at"] = datetime.now()
    if not ticket_data.get("updated_at"):
        ticket_data["updated_at"] = datetime.now()
        
    await db.tickets.insert_one(ticket_data)
    if "_id" in ticket_data: del ticket_data["_id"]
    ticket_data["user_id"] = str(ticket_data["user_id"])
    return {"status": "success", "ticket": ticket_data}

@router.post("/admin/tickets/{ticket_id}/reply")
async def reply_ticket(ticket_id: str, reply: SupportTicketReply, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    result = await db.tickets.update_one(
        {"id": ticket_id},
        {"$set": {"status": reply.status, "updated_at": datetime.now()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    return {"status": "success", "message": "Reply sent and status updated"}

@router.get("/admin/stats")
async def get_admin_stats(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    # Count ALL registered merchants
    merchant_count = await db.merchants.count_documents({})
    inquiry_count = await db.sign_ups.count_documents({"active": {"$ne": True}})
    ticket_count = await db.tickets.count_documents({"status": "Open"})
    
    # Calculate total volume from payments
    total_volume = 0
    async for payment in db.payments.find({"status": {"$in": ["Paid", "Success"]}}):
        amount_str = str(payment.get("amount", "0")).replace('₹', '').replace(',', '')
        try:
            total_volume += float(amount_str)
        except:
            pass
            
    # Format volume for display (e.g., ₹1.2M or ₹500K)
    if total_volume >= 1000000:
        formatted_volume = f"₹{total_volume/1000000:.1f}M"
    elif total_volume >= 1000:
        formatted_volume = f"₹{total_volume/1000:.1f}K"
    else:
        formatted_volume = f"₹{total_volume:.2f}"

    return {
        "merchants": merchant_count,
        "new_inquiries": inquiry_count,
        "open_tickets": ticket_count,
        "total_volume": formatted_volume
    }

@router.get("/admin/settings")
async def get_admin_settings(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    settings = await db.admin_settings.find_one({}, {"_id": 0})
    if not settings:
        return {
            "general": {
                "platformName": "PayFlow Gateway",
                "supportEmail": "support@payflow.com",
                "timezone": "UTC +00:00",
                "maintenanceMode": False
            },
            "security": {
                "requireTwoFactor": True,
                "sessionExpiry": "24 Hours",
                "passwordPolicy": "Strong",
                "ipWhitelisting": False
            },
            "api": {
                "endpointUrl": "https://api.payflow.com/v1",
                "webhookSecret": "whsec_51MzZkS2VsdWR1M2...",
                "requestLimit": "10,000 / hr",
                "logRetention": "90 Days"
            }
        }
    return settings

@router.post("/admin/settings")
async def update_admin_settings(settings: AdminSettings, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    await db.admin_settings.update_one(
        {},
        {"$set": settings.dict()},
        upsert=True
    )
    return {"status": "success"}

# Duplicate route removed to maintain consistency

@router.get("/merchant/stats")
async def get_merchant_stats(current_user: dict = Depends(get_current_user)):
    email = current_user["email"]
    db = get_database()
    
    email_regex = {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}
    query = {} if current_user.get("role") == "admin" else {"email": email_regex}
    
    current_time = datetime.now().timestamp()
    thirty_days_ago = current_time - (30 * 24 * 60 * 60)
    sixty_days_ago = current_time - (60 * 24 * 60 * 60)
    
    total_volume = 0
    success_count = 0
    
    current_volume = 0
    previous_volume = 0
    current_success = 0
    previous_success = 0
    
    async for payment in db.payments.find(query):
        amount_str = str(payment.get("amount", "0")).replace('₹', '').replace(',', '')
        try:
            amount = float(amount_str)
            timestamp = payment.get("creation_timestamp", 0)
            
            if payment.get("status") in ["Paid", "Success"]:
                total_volume += amount
                success_count += 1
                
                if timestamp >= thirty_days_ago:
                    current_volume += amount
                    current_success += 1
                elif timestamp >= sixty_days_ago:
                    previous_volume += amount
                    previous_success += 1
        except:
            pass
            
    # Calculate real growth
    if previous_volume > 0:
        volume_growth_val = ((current_volume - previous_volume) / previous_volume) * 100
    else:
        volume_growth_val = 100.0 if current_volume > 0 else 0.0
        
    if previous_success > 0:
        success_growth_val = ((current_success - previous_success) / previous_success) * 100
    else:
        success_growth_val = 100.0 if current_success > 0 else 0.0
        
    volume_growth = f"{'+' if volume_growth_val >= 0 else ''}{volume_growth_val:.1f}%"
    success_growth = f"{'+' if success_growth_val >= 0 else ''}{success_growth_val:.1f}%"
    
    # Net settlements as 98% of total volume (assuming 2% fee)
    net_settlements = total_volume * 0.98
    current_settlements = current_volume * 0.98
    previous_settlements = previous_volume * 0.98
    
    if previous_settlements > 0:
        settlement_growth_val = ((current_settlements - previous_settlements) / previous_settlements) * 100
    else:
        settlement_growth_val = 100.0 if current_settlements > 0 else 0.0
        
    settlement_growth = f"{'+' if settlement_growth_val >= 0 else ''}{settlement_growth_val:.1f}%"
    
    return {
        "total_volume": f"₹{total_volume:,.2f}",
        "success_count": success_count,
        "net_settlements": f"₹{net_settlements:,.2f}",
        "volume_growth": volume_growth,
        "success_growth": success_growth,
        "settlement_growth": settlement_growth
    }

async def initiate_cashfree_payout(amount: float, bank_account: str, ifsc: str, user_id: str = "") -> tuple[bool, str, str | None]:
    """
    Execute a real Cashfree Payouts API call.
    """
    app_id = os.getenv("CASHFREE_PAYOUT_APP_ID") or os.getenv("CASHFREE_APP_ID")
    secret_key = os.getenv("CASHFREE_PAYOUT_SECRET_KEY") or os.getenv("CASHFREE_SECRET_KEY")
    environment = os.getenv("CASHFREE_ENVIRONMENT", "sandbox")
    
    base_url = "https://sandbox.cashfree.com" if environment == "sandbox" else "https://api.cashfree.com"
    transfer_url = f"{base_url}/payout/transfers"
    
    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "x-client-id": app_id or "",
                "x-client-secret": secret_key or "",
                "x-api-version": "2024-01-01",
                "Content-Type": "application/json"
            }
            
            transfer_id = f"WD-{int(datetime.now().timestamp())}"
            payload = {
                "transfer_id": transfer_id,
                "transfer_amount": amount,
                "transfer_currency": "INR",
                "transfer_mode": "imps",
                "beneficiary_details": {
                    "beneficiary_name": user_id or "Customer",
                    "beneficiary_instrument_details": {
                        "bank_account_number": bank_account,
                        "bank_ifsc": ifsc
                    },
                    "beneficiary_contact_details": {
                        "beneficiary_email": "test@example.com",
                        "beneficiary_phone": "9999999999"
                    }
                }
            }
            
            response = await client.post(transfer_url, json=payload, headers=headers, timeout=10)
            
            if response.status_code == 200:
                print(f"[CASHFREE PAYOUT SUCCESS] Transfer {amount} to {bank_account} (IFSC: {ifsc})")
                return True, "Success", transfer_id
            else:
                try:
                    error_msg = response.json().get("message", "Transfer failed")
                except:
                    error_msg = response.text
                print(f"[CASHFREE PAYOUT ERROR] {response.text}")
                return False, f"Transfer Error: {error_msg}", None
                
    except Exception as e:
        print(f"Error initiating cashfree payout: {e}")
        return False, str(e), None

@router.get("/merchant/users/{user_id}")
async def get_user_details(user_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    
    # Check if user_id is a valid ObjectId string
    from bson.errors import InvalidId
    from bson import ObjectId
    
    query = {"$or": [{"id": user_id}, {"user_id": user_id}, {"merchant_id": user_id}]}
    
    try:
        obj_id = ObjectId(user_id)
        query["$or"].append({"user_id": obj_id})
        query["$or"].append({"_id": obj_id})
    except InvalidId:
        pass
        
    # Search in customers first
    customer = await db.customers.find_one(query, {"_id": 0})
    if customer:
        if 'user_id' in customer:
            customer['user_id'] = str(customer['user_id'])
        return {"type": "customer", "data": customer}
        
    # Search in merchants
    merchant = await db.merchants.find_one(query, {"_id": 0, "password": 0, "salt_key": 0, "merchant_key": 0})
    if merchant:
        if 'user_id' in merchant:
            merchant['user_id'] = str(merchant['user_id'])
        return {"type": "merchant", "data": merchant}
        
    # Search in signups
    signup = await db.sign_ups.find_one(query, {"_id": 0, "password": 0})
    if signup:
        if 'user_id' in signup:
            signup['user_id'] = str(signup['user_id'])
        return {"type": "inquiry", "data": signup}

    raise HTTPException(status_code=404, detail="User not found")


@router.post("/merchant/withdraw")
async def process_merchant_withdrawal(request: WithdrawRequest, current_user: dict = Depends(get_current_user)):
    email = current_user["email"]
    db = get_database()
    import re
    email_regex = {"$regex": f"^{re.escape(email)}$", "$options": "i"}
    collection = db.merchants
    merchant = await collection.find_one({"email": email_regex})
    
    if not merchant:
        # Check if they are an unactivated merchant in sign_ups
        merchant = await db.sign_ups.find_one({"email": email_regex})
        if merchant:
            collection = db.sign_ups
            
    if not merchant:
        # Create a real database record so they have an actual balance instead of throwing 404
        merchant = {
            "merchant_id": f"M-{random.randint(1000, 9999)}",
            "name": current_user.get("name", "Test User"),
            "email": email,
            "role": current_user.get("role", "merchant"),
            "wallet_balance": 0.0,
            "status": "Healthy",
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        await db.merchants.insert_one(merchant)
        collection = db.merchants
        if "_id" in merchant: del merchant["_id"]

    current_balance = float(merchant.get("wallet_balance", 0.0))
    if current_balance < request.amount:
        raise HTTPException(status_code=400, detail=f"Insufficient wallet balance. Your live balance is: {current_balance}")
        
    # Get user_id securely from the merchant table instead of relying on the request
    merchant_user_id = merchant.get("user_id") or merchant.get("_id")
    if isinstance(merchant_user_id, str) and ObjectId.is_valid(merchant_user_id):
        merchant_user_id = ObjectId(merchant_user_id)
    
    # Call Cashfree Payout API
    payout_success, error_message, transfer_id = await initiate_cashfree_payout(
        request.amount, 
        request.bank_account, 
        request.ifsc_code,
        str(merchant_user_id)
    )
    
    if not payout_success:
        raise HTTPException(status_code=400, detail=f"Cashfree Payout Failed: {error_message}")
        
    # Determine the status based on whether the API call was successful
    withdrawal_status = "Completed" if payout_success else "Pending"
    
    # Deduct balance from their actual record
    new_balance = current_balance - request.amount
    await collection.update_one(
        {"email": email_regex},
        {"$set": {"wallet_balance": new_balance}}
    )
    
    # Log the withdrawal in wallet_transactions
    transaction = {
        "merchant_email": email,
        "type": "DEBIT",
        "amount": request.amount,
        "description": f"Withdrawal to Bank Account ({request.bank_account[-4:]})",
        "timestamp": datetime.now(),
        "status": withdrawal_status,
        "transfer_id": transfer_id
    }
    await db.wallet_transactions.insert_one(transaction)
    
    # Add a formal settlement record for the table
    settlement_record = {
        "email": email,
        "amount": request.amount,
        "status": withdrawal_status,
        "bank": request.bank_account,
        "ifsc": request.ifsc_code,
        "user_id": merchant_user_id,
        "created_at": datetime.now(),
        "type": "withdrawal",
        "gateway_error": error_message if not payout_success else None,
        "transfer_id": transfer_id
    }
    await db.withdrawals.insert_one(settlement_record)
    
    # Broadcast update to both admin and merchant panels
    try:
        await sio.emit('payment_update', {
            'type': 'WALLET_UPDATED',
            'email': email,
            'wallet_balance': new_balance,
            'amount': request.amount
        })
    except Exception as e:
        print(f"Socket emit failed: {e}")
    
    msg = "Withdrawal processed successfully." if payout_success else "Withdrawal requested successfully but is Pending due to gateway configuration."
    return {"status": "success", "message": msg, "new_balance": new_balance, "payout_status": withdrawal_status}


@router.post("/admin/withdraw")
async def process_admin_withdrawal(request: AdminWithdrawRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    db = get_database()
    
    # Look up merchant by email, username, or merchant_id
    merchant = await db.merchants.find_one({
        "$or": [
            {"email": {"$regex": f"^{request.merchant_identifier}$", "$options": "i"}},
            {"username": {"$regex": f"^{request.merchant_identifier}$", "$options": "i"}},
            {"merchant_id": {"$regex": f"^{request.merchant_identifier}$", "$options": "i"}}
        ]
    })
    
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
        
    email = merchant.get("email")
    current_balance = float(merchant.get("wallet_balance", 0.0))
    
    if current_balance < request.amount:
        raise HTTPException(status_code=400, detail=f"Insufficient wallet balance. Live balance is: {current_balance}")
        
    merchant_user_id = merchant.get("user_id") or merchant.get("_id")
    if isinstance(merchant_user_id, str) and ObjectId.is_valid(merchant_user_id):
        merchant_user_id = ObjectId(merchant_user_id)
        
    # Call Cashfree Payout API
    if type(merchant_user_id) != str:
        merchant_user_id = str(merchant_user_id)
        
    payout_success, error_message, transfer_id = await initiate_cashfree_payout(
        request.amount, 
        request.bank_account, 
        request.ifsc_code,
        merchant_user_id
    )
    
    if not payout_success:
        raise HTTPException(status_code=400, detail=f"Cashfree Payout Failed: {error_message}")
        
    withdrawal_status = "Completed" if payout_success else "Pending"
    
    # Deduct balance
    new_balance = current_balance - request.amount
    await db.merchants.update_one(
        {"email": email},
        {"$set": {"wallet_balance": new_balance}}
    )
    
    # Log the withdrawal
    transaction = {
        "merchant_email": email,
        "type": "DEBIT",
        "amount": request.amount,
        "description": f"Admin Withdrawal to Bank Account ({request.bank_account[-4:]})",
        "timestamp": datetime.now(),
        "status": withdrawal_status,
        "processed_by": "admin",
        "transfer_id": transfer_id
    }
    await db.wallet_transactions.insert_one(transaction)
    
    # Add a formal settlement record
    settlement_record = {
        "email": email,
        "amount": request.amount,
        "status": withdrawal_status,
        "bank": request.bank_account,
        "ifsc": request.ifsc_code,
        "user_id": merchant_user_id,
        "created_at": datetime.now(),
        "type": "withdrawal",
        "processed_by": "admin",
        "gateway_error": error_message if not payout_success else None,
        "transfer_id": transfer_id
    }
    await db.withdrawals.insert_one(settlement_record)
    
    # Broadcast update to both admin and merchant panels
    try:
        await sio.emit('payment_update', {
            'type': 'WALLET_UPDATED',
            'email': email,
            'wallet_balance': new_balance,
            'amount': request.amount
        })
    except Exception as e:
        print(f"Socket emit failed: {e}")
    
    msg = "Withdrawal processed successfully." if payout_success else "Withdrawal requested successfully but is Pending due to gateway configuration."
    return {"status": "success", "message": msg, "new_balance": new_balance, "payout_status": withdrawal_status}


@router.get("/merchant/settlements")
async def get_merchant_settlements(current_user: dict = Depends(get_current_user)):
    email = current_user["email"]
    db = get_database()
    email_regex = {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}
    
    # Dynamically scan the payments collection for successful payments
    query = {"email": email_regex, "status": {"$in": ["Paid", "Success"]}}
    payments = await db.payments.find(query).to_list(length=1000)
    
    payments_by_date = {}
    for p in payments:
        date_str = None
        if "created" in p and p["created"]:
            created_str = str(p["created"]).strip()
            if len(created_str) >= 10:
                date_str = created_str[:10]
        if not date_str and "creation_timestamp" in p and p["creation_timestamp"]:
            try:
                date_str = datetime.fromtimestamp(float(p["creation_timestamp"])).strftime('%Y-%m-%d')
            except:
                pass
        if not date_str:
            date_str = datetime.now().strftime('%Y-%m-%d')
            
        amount_str = str(p.get("amount", "0")).replace('₹', '').replace(',', '')
        try:
            amount_val = float(amount_str)
        except:
            amount_val = 0.0
            
        if amount_val > 0:
            if date_str not in payments_by_date:
                payments_by_date[date_str] = 0.0
            payments_by_date[date_str] += amount_val
            
    settlements = []
    today_str = datetime.now().strftime('%Y-%m-%d')
    sorted_dates = sorted(payments_by_date.keys(), reverse=True)
    
    for date_str in sorted_dates:
        gross_amount = payments_by_date[date_str]
        net_amount = gross_amount * 0.98
        
        bank_suffix = str(abs(hash(email)) % 10000).zfill(4)
        bank_name = f"HDFC Bank (****{bank_suffix})"
        status = "Pending" if date_str == today_str else "Completed"
        
        settlement_hash = str(abs(hash(f"{email}-{date_str}")) % 1000000).zfill(6)
        settlement_id = f"SET-{settlement_hash}"
        
        settlements.append({
            "id": settlement_id,
            "amount": f"₹{net_amount:,.2f}",
            "status": status,
            "bank": bank_name,
            "date": date_str,
            "email": email,
            "user_id": str(await get_db_user_id_for_email(db, email))
        })
        
    # Fetch explicit withdrawals
    withdrawals = await db.withdrawals.find({"email": email_regex}).sort("created_at", -1).to_list(length=1000)
    for w in withdrawals:
        w_amount = w.get("amount", 0.0)
        date_obj = w.get("created_at")
        date_str = date_obj.strftime('%Y-%m-%d') if isinstance(date_obj, datetime) else datetime.now().strftime('%Y-%m-%d')
        
        bank_name = str(w.get("bank", "-"))
        if len(bank_name) >= 4 and not bank_name.startswith("HDFC"):
            bank_name = f"Account (****{bank_name[-4:]})"
            
        settlement_id = str(w.get("_id", ""))[-8:].upper()
        if not settlement_id:
            settlement_id = f"WD-{int(datetime.now().timestamp())}"
        else:
            settlement_id = f"WD-{settlement_id}"
            
        settlements.append({
            "id": settlement_id,
            "amount": f"₹{w_amount:,.2f}",
            "status": w.get("status", "Completed"),
            "bank": bank_name,
            "date": date_str,
            "email": w.get("email", email),
            "user_id": str(await get_db_user_id_for_email(db, email)),
            "type": w.get("type", "withdrawal")
        })

    # Sort all settlements by date descending
    settlements.sort(key=lambda x: x["date"], reverse=True)
        
    return settlements


@router.get("/merchant/customers")
async def get_merchant_customers(current_user: dict = Depends(get_current_user)):
    email = current_user["email"]
    db = get_database()
    email_regex = {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}
    customers = await db.customers.find({"merchant_email": email_regex}, {"_id": 0}).sort("joined", -1).to_list(length=100)
    for c in customers:
        if 'user_id' in c:
            c['user_id'] = str(c['user_id'])
    return customers

@router.post("/merchant/customers")
async def create_merchant_customer(customer: Customer, current_user: dict = Depends(get_current_user)):
    db = get_database()
    customer_data = customer.dict()
    # Force the merchant_email to be the current user
    customer_data["merchant_email"] = current_user["email"]
    customer_data["user_id"] = await get_db_user_id_for_email(db, current_user["email"])
    
    if not customer_data.get("id"):
        customer_data["id"] = f"CUST-{random.randint(1000, 9999)}"
    if not customer_data.get("joined"):
        customer_data["joined"] = datetime.now().strftime("%Y-%m-%d")
        
    if not customer_data.get("created_at"):
        customer_data["created_at"] = datetime.now()
    if not customer_data.get("updated_at"):
        customer_data["updated_at"] = datetime.now()
        
    await db.customers.insert_one(customer_data)
    if "_id" in customer_data: del customer_data["_id"]
    customer_data["user_id"] = str(customer_data["user_id"])
    return {"status": "success", "customer": customer_data}


@router.delete("/merchant/customers/{customer_id}")
async def delete_merchant_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    email = current_user["email"]
    import re
    email_regex = {"$regex": f"^{re.escape(email)}$", "$options": "i"}
    
    result = await db.customers.delete_one({"id": customer_id, "merchant_email": email_regex})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found or not owned by current merchant")
        
    return {"status": "success", "message": "Customer deleted successfully"}



@router.post("/admin/activate-merchant")
async def activate_merchant(req: ActivateRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if len(req.password) < 12:
        return {"status": "error", "message": "Password must be at least 12 characters long"}
    db = get_database()
    
    # 1. Find the inquiry
    inquiry = await db.sign_ups.find_one({"inquiry_id": req.inquiry_id})
    if not inquiry:
        # Try finding by mongo _id if inquiry_id is missing
        from bson import ObjectId
        try:
            inquiry = await db.sign_ups.find_one({"_id": ObjectId(req.inquiry_id)})
        except:
            raise HTTPException(status_code=404, detail="Inquiry not found")
            
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    # 2. Create a merchant from inquiry
    inq_id_part = inquiry.get('inquiry_id', '0000')
    # Clean up the ID part to get only digits or last 4 chars
    suffix = ''.join(filter(str.isdigit, inq_id_part))[-6:] or inq_id_part[-6:]
    suffix = suffix.zfill(6)
    
    # Extract or generate user_id
    user_id = inquiry.get("user_id")
    if not isinstance(user_id, (ObjectId, str)) or not user_id:
        user_id = ObjectId()
    elif isinstance(user_id, str) and ObjectId.is_valid(user_id):
        user_id = ObjectId(user_id)
    
    merchant_data = {
        "merchant_id": f"M-{suffix}",
        "user_id": user_id,
        "name": inquiry['name'],
        "email": inquiry['email'],
        "username": inquiry.get('username', ''),
        "password": req.password,
        "merchant_key": f"mk_live_{generate_secure_key()}",
        "salt_key": generate_salt(),
        "plan": "Standard", # Default
        "volume": "$0",
        "status": "Healthy",
        "joined": datetime.now().strftime("%Y-%m-%d"),
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    
    # Insert or Update merchant
    await db.merchants.update_one(
        {"email": inquiry['email']},
        {"$set": merchant_data},
        upsert=True
    )
    
    # 3. Mark inquiry as active and save user_id
    await db.sign_ups.update_one(
        {"email": inquiry['email']},
        {"$set": {"active": True, "user_id": user_id, "updated_at": datetime.now()}}
    )
    
    # 4. Notify via socket
    await sio.emit("admin_notification", {
        "type": "MERCHANT_ACTIVATED",
        "message": f"Merchant activated: {inquiry['name']} ({inquiry['email']})",
        "email": inquiry['email']
    })
    return {
        "status": "success", 
        "message": "Merchant activated",
        "merchant_id": merchant_data["merchant_id"],
        "merchant_key": merchant_data["merchant_key"],
        "salt_key": merchant_data["salt_key"]
    }



@router.post("/admin/create-merchant")
async def create_merchant(req: CreateMerchantRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    name = req.name.strip()
    email = req.email.strip()
    password = req.password.strip()
    username = req.username.strip() if req.username else email.split('@')[0]
    plan = req.plan.strip() if req.plan else "Standard"
    role = req.role.strip() if req.role else "merchant"
    
    if not name or not email or not password:
        return {"status": "error", "message": "Name, Email, and Password are required"}
        
    if len(password) < 8:
        return {"status": "error", "message": "Password must be at least 8 characters long"}
        
    db = get_database()
    
    # Check if user already exists
    email_regex = {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}
    existing = await db.merchants.find_one({"email": email_regex})
    if existing:
        role_label = "Admin" if existing.get("role") == "admin" else "Merchant"
        return {"status": "error", "message": f"{role_label} with this email already exists"}
        
    req_uid = req.user_id

    if role == "admin":
        admin_uid = req_uid or ObjectId()
        admin_data = {
            "user_id": admin_uid,
            "name": name,
            "email": email,
            "password": password,
            "role": "admin",
            "joined": datetime.now().strftime("%Y-%m-%d"),
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        await db.merchants.insert_one(admin_data)
        
        # Sync to sign_ups too
        inquiry_data = {
            "inquiry_id": f"INQ-{str(admin_uid)[-4:]}",
            "user_id": admin_uid,
            "name": name,
            "email": email,
            "username": username,
            "password": password,
            "phone": "",
            "active": True,
            "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        await db.sign_ups.update_one(
            {"email": email_regex},
            {"$set": inquiry_data},
            upsert=True
        )
        
        # Notify via socket
        await sio.emit("admin_notification", {
            "type": "ADMIN_CREATED",
            "message": f"Admin created: {name} ({email})",
            "email": email
        })
        
        return {"status": "success", "message": "Admin created successfully", "merchant_id": None}
        
    # Generate unique merchant_id for merchants
    while True:
        merchant_id = f"M-{random.randint(100000, 999999)}"
        existing_m = await db.merchants.find_one({"merchant_id": merchant_id})
        if not existing_m:
            break
            
    user_id = req_uid or ObjectId()
    merchant_data = {
        "merchant_id": merchant_id,
        "user_id": user_id,
        "name": name,
        "email": email,
        "username": username,
        "password": password,
        "merchant_key": f"mk_live_{generate_secure_key()}",
        "salt_key": generate_salt(),
        "plan": plan,
        "role": "merchant",
        "wallet_balance": req.wallet_balance,
        "volume": "$0",
        "status": "Healthy",
        "joined": datetime.now().strftime("%Y-%m-%d"),
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    
    await db.merchants.insert_one(merchant_data)
    
    # Sync with sign_ups collection to connect the tables each other
    inquiry_data = {
        "inquiry_id": f"INQ-{merchant_id[-4:]}",
        "user_id": user_id,
        "name": name,
        "email": email,
        "username": username,
        "password": password,
        "phone": "",
        "active": True,
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    await db.sign_ups.update_one(
        {"email": email_regex},
        {"$set": inquiry_data},
        upsert=True
    )
    
    # Notify via socket
    await sio.emit("admin_notification", {
        "type": "MERCHANT_CREATED",
        "message": f"Merchant created: {name} ({email})",
        "email": email
    })
    return {
        "status": "success", 
        "message": "Merchant created successfully", 
        "merchant_id": merchant_id,
        "merchant_key": merchant_data["merchant_key"],
        "salt_key": merchant_data["salt_key"]
    }

@router.post("/admin/merchants/{merchant_id}/wallet/add")
async def add_merchant_funds(merchant_id: str, req: AddFundsRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    
    merchant = await db.merchants.find_one({"merchant_id": merchant_id})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
        
    current_balance = float(merchant.get("wallet_balance", 0.0))
    new_balance = current_balance + req.amount
    
    await db.merchants.update_one(
        {"merchant_id": merchant_id},
        {"$set": {"wallet_balance": new_balance, "updated_at": datetime.now()}}
    )
    
    transaction = {
        "merchant_id": merchant_id,
        "amount": req.amount,
        "type": "CREDIT",
        "description": "Funds added by admin",
        "timestamp": datetime.now()
    }
    await db.wallet_transactions.insert_one(transaction)
    
    await sio.emit("payment_update", {
        "type": "WALLET_UPDATED",
        "message": f"An admin added ₹{req.amount:,.2f} to your wallet.",
        "new_balance": new_balance,
        "email": merchant.get("email")
    })
    
    return {
        "status": "success", 
        "message": f"Successfully added ₹{req.amount:,.2f} to wallet.", 
        "new_balance": new_balance
    }

@router.get("/merchant/wallet/history")
async def get_wallet_history(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "merchant":
        raise HTTPException(status_code=403, detail="Merchant access required")
    db = get_database()
    merchant = await db.merchants.find_one({"email": current_user.get("email")})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
        
    merchant_id = merchant.get("merchant_id")
    if not merchant_id:
        return []
        
    cursor = db.wallet_transactions.find({"merchant_id": merchant_id}).sort("timestamp", -1)
    history = await cursor.to_list(length=100)
    for entry in history:
        entry["_id"] = str(entry["_id"])
        # Format timestamp safely
        if "timestamp" in entry and isinstance(entry["timestamp"], datetime):
            entry["timestamp"] = entry["timestamp"].isoformat()
    return history

@router.get("/admin/payments")
async def get_admin_payments(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    # Return all payments for admin
    payments = await db.payments.find({}, {"_id": 0}).sort("creation_timestamp", -1).to_list(length=1000)
    res = []
    for p in payments:
        p = add_payment_links(p)
        if 'user_id' in p:
            p['user_id'] = str(p['user_id'])
        res.append(p)
    return res

@router.get("/admin/withdrawals")
async def get_admin_withdrawals(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db = get_database()
    withdrawals = await db.withdrawals.find({}).sort("created_at", -1).to_list(length=1000)
    res = []
    for w in withdrawals:
        if '_id' in w:
            w['id'] = str(w['_id'])
            del w['_id']
        if 'user_id' in w:
            w['user_id'] = str(w['user_id'])
        if 'created_at' in w and hasattr(w['created_at'], 'isoformat'):
            w['created_at'] = w['created_at'].isoformat()
        res.append(w)
    return res

@router.get("/merchant/payments")
async def get_payments(current_user: dict = Depends(get_current_user)):
    email = current_user["email"]
    db = get_database()
    # Return payments filtered by merchant email, or all if admin
    query = {} if current_user.get("role") == "admin" else {"email": {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}}
    payments = await db.payments.find(
        query, 
        {"_id": 0}
    ).sort("creation_timestamp", -1).to_list(length=1000)
    res = []
    for p in payments:
        p = add_payment_links(p)
        if 'user_id' in p:
            p['user_id'] = str(p['user_id'])
        res.append(p)
    return res

@router.get("/merchant/payments/{payment_id}")
async def get_payment(payment_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    email = current_user["email"]
    
    # Try finding by 'id' field first
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    
    # Fallback: Try finding by name (if id was somehow lost or mismatched)
    if not payment:
        payment = await db.payments.find_one({"name": payment_id}, {"_id": 0})
        
    if not payment:
        raise HTTPException(status_code=404, detail="Payment link not found")
        
    # Security: Ensure this payment belongs to the merchant or user is admin
    if payment.get("email", "").lower() != email.lower() and current_user.get("role") != "admin":
         raise HTTPException(status_code=403, detail=f"Access denied: This payment belongs to {payment.get('email')}")
         
    payment = add_payment_links(payment)
    if 'user_id' in payment:
        payment['user_id'] = str(payment['user_id'])
    return payment

@router.get("/checkout/{payment_id}")
async def get_checkout_payment(payment_id: str):
    """Public endpoint for checkout pages - no auth required."""
    db = get_database()
    
    # Try finding by 'id' field first
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    
    # Fallback: Try finding by name
    if not payment:
        payment = await db.payments.find_one({"name": payment_id}, {"_id": 0})
        
    if not payment:
        raise HTTPException(status_code=404, detail="Payment link not found")
        
    payment = add_payment_links(payment)
    if 'user_id' in payment:
        payment['user_id'] = str(payment['user_id'])
    return payment

@router.post("/merchant/payments/{payment_id}/refund")
async def refund_payment(payment_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    email = current_user["email"]
    
    # Verify ownership or admin role before refunding
    payment = await db.payments.find_one({"id": payment_id})
    if not payment or (payment.get("email", "").lower() != email.lower() and current_user.get("role") != "admin"):
        raise HTTPException(status_code=403, detail="Forbidden: Ownership required for refund")

    result = await db.payments.update_one(
        {"id": payment_id},
        {"$set": {"status": "Refunded", "updated_at": datetime.now()}}
    )
    return {"status": "success", "message": "Refund issued"}

@router.post("/merchant/payments/{payment_id}/flag")
async def flag_payment(payment_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    email = current_user["email"]
    
    # Verify ownership or admin role before flagging
    payment = await db.payments.find_one({"id": payment_id})
    if not payment or (payment.get("email", "").lower() != email.lower() and current_user.get("role") != "admin"):
        raise HTTPException(status_code=403, detail="Forbidden: Ownership required for flagging")

    result = await db.payments.update_one(
        {"id": payment_id},
        {"$set": {"status": "Flagged", "updated_at": datetime.now()}}
    )
    return {"status": "success", "message": "Transaction flagged"}

@router.post("/merchant/verify-utr")
async def verify_utr(req: dict):
    db = get_database()
    utr = req.get("utr")
    payment_id = req.get("payment_id")
    
    if not utr or not payment_id:
        raise HTTPException(status_code=400, detail="Missing UTR or payment_id")
        
    # Find the payment record
    existing = await db.payments.find_one({"id": payment_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment record not found")
        
    # Update the payment with the UTR and mark as Pending (not Paid yet)
    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {
            "utr_id": utr,
            "status": "Pending",
            "updated_at": datetime.now()
        }}
    )
    
    # Notify via Socket.IO for real-time dashboard updates
    await sio.emit('payment_update', {
        'type': 'UTR_SUBMITTED',
        'payment_id': payment_id,
        'utr': utr,
        'status': 'Pending',
        'message': f'New UTR: {utr} submitted for payment {payment_id}'
    })
    
    print(f"UTR_SUBMITTED for {payment_id} - Socket emission successful")
    return {"status": "success", "message": "UTR verified and saved successfully"}

@router.post("/merchant/payments")
async def create_payment(payment: Payment, current_user: dict = Depends(get_current_user)):
    db = get_database()
    payment_data = payment.dict()
    
    # Resolve email: prefer body email, fallback to authenticated user's email
    resolved_email = payment_data.get("email") or current_user.get("email")
    if not resolved_email:
        raise HTTPException(status_code=400, detail="Merchant email is required")
    payment_data["email"] = resolved_email
        
    merchant = await db.merchants.find_one({
        "email": {"$regex": f"^{payment_data['email'].replace('.', '\\.')}$", "$options": "i"}
    }, {"name": 1, "upi_id": 1})
    
    m_name = merchant["name"] if merchant and merchant.get("name") else "Luxury Merchant"
    m_upi = merchant["upi_id"] if merchant and merchant.get("upi_id") else "nexify@okicici"
    
    # Use merchant UPI if none provided in the request
    if not payment_data.get("upi_id"):
        payment_data["upi_id"] = m_upi
    
    # Use provided order_id or generate one
    payment_data["id"] = payment_data.get("order_id") or f"LNK-{random.randint(100000, 999999)}"
    payment_data["merchant_name"] = m_name
    payment_data["user_id"] = await get_db_user_id_for_email(db, payment_data["email"])
    payment_data["created"] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    payment_data["creation_timestamp"] = datetime.now().timestamp()
    payment_data["created_at"] = datetime.now()
    payment_data["updated_at"] = datetime.now()
    
    # Create Cashfree Order
    amount_val = float(str(payment_data["amount"]).replace('₹', '').replace(',', ''))
    session_id = await create_cashfree_order(
        amount=amount_val,
        customer_id=f"CUST-{random.randint(1000, 9999)}",
        customer_phone="9999999999", # Placeholder
        customer_email="customer@example.com", # Placeholder
        order_id=payment_data["id"],
        return_url=payment_data.get("return_url")
    )
    
    if session_id:
        payment_data["payment_session_id"] = session_id
        print(f"Created Cashfree Session: {session_id}")
        
        # New: Initiate Pay to get the official UPI Link
        cf_upi_link = await initiate_cashfree_upi_pay(session_id)
        if cf_upi_link:
            payment_data["cf_upi_link"] = cf_upi_link
            print(f"Stored Cashfree UPI Link: {cf_upi_link}")
    
    # Pre-calculate and store links permanently
    payment_data = add_payment_links(payment_data)
    
    await db.payments.insert_one(payment_data)
    if "_id" in payment_data: del payment_data["_id"]
    
    # Serialize user_id
    if "user_id" in payment_data:
        payment_data["user_id"] = str(payment_data["user_id"])
        
    # Notify via Socket.IO
    await sio.emit("payment_update", {
        "type": "PAYMENT_CREATED",
        "payment_id": payment_data["id"],
        "message": f"New payment page created: {payment_data['name']}",
        "redirect_url": f"/merchant/payments"
    })
    
    return {"status": "success", "payment": payment_data}

@router.post("/webhook/cashfree")
async def cashfree_webhook(payload: dict):
    """
    Handle Cashfree webhooks for payment success.
    """
    event_type = payload.get("type")
    
    if event_type == "PAYMENT_SUCCESS_WEBHOOK":
        data = payload.get("data", {})
        order_info = data.get("order", {})
        payment_info = data.get("payment", {})
        
        order_id = order_info.get("order_id")
        payment_status = payment_info.get("payment_status")
        
        if order_id and payment_status == "SUCCESS":
            db = get_database()
            
            # Check if the payment exists in the database first
            existing = await db.payments.find_one({"id": order_id})
            if not existing:
                # Payment not found — do NOT auto-create phantom records.
                # Only process webhooks for payments that were explicitly created by the merchant or admin.
                print(f"Webhook: Payment {order_id} not found in database. Ignoring to prevent phantom records.")
                return {"status": "ignored", "message": f"No payment found for order_id '{order_id}'. Webhook skipped."}
                
            # If the ID exists, check if it was already Paid or Success
            if existing.get("status") in ["Paid", "Success"]:
                print(f"Payment {order_id} is already marked as {existing.get('status')}. Emitting socket update to confirm.")
                await sio.emit("payment_update", {
                    "type": "PAYMENT_PAID",
                    "order_id": order_id,
                    "status": "Success",
                    "message": f"Payment Successful for Order: {order_id}",
                    "redirect_url": f"/merchant/payments"
                })
                return {"status": "success", "message": "Payment already processed"}
                
            # Get the payment amount from payment_info or order_info and update it
            amount_val = payment_info.get("payment_amount") or order_info.get("order_amount")
            update_fields = {
                "status": "Success",
                "cf_payment_id": payment_info.get("cf_payment_id"),
                "payment_time": payment_info.get("payment_time"),
                "payment_method": payment_info.get("payment_group")
            }
            if amount_val is not None:
                try:
                    update_fields["amount"] = f"₹{float(amount_val):,.2f}"
                except Exception as e:
                    print(f"Error parsing amount {amount_val}: {e}")

            # Update the payment status and amount in the database to Success
            update_fields["updated_at"] = datetime.now()
            await db.payments.update_one(
                {"id": order_id},
                {"$set": update_fields}
            )
            
            print(f"Successfully updated payment {order_id} to Success (Amount: {update_fields.get('amount')})")
            
            # --- Auto Wallet Top-up Logic ---
            try:
                if amount_val is not None:
                    parsed_amount = float(amount_val)
                    merchant_email = existing.get("email")
                    if merchant_email:
                        merchant = await db.merchants.find_one({"email": merchant_email})
                        if merchant:
                            merchant_id = merchant.get("merchant_id")
                            current_balance = float(merchant.get("wallet_balance", 0.0))
                            new_balance = current_balance + parsed_amount
                            
                            await db.merchants.update_one(
                                {"merchant_id": merchant_id},
                                {"$set": {"wallet_balance": new_balance, "updated_at": datetime.now()}}
                            )
                            
                            transaction = {
                                "merchant_id": merchant_id,
                                "amount": parsed_amount,
                                "type": "CREDIT",
                                "description": f"Payment received: {order_id}",
                                "timestamp": datetime.now()
                            }
                            await db.wallet_transactions.insert_one(transaction)
                            
                            # Emit WALLET_UPDATED event specifically for this merchant
                            await sio.emit("payment_update", {
                                "type": "WALLET_UPDATED",
                                "message": f"Payment of ₹{parsed_amount:,.2f} added to your wallet.",
                                "new_balance": new_balance,
                                "email": merchant_email
                            })
                            print(f"Auto-credited ₹{parsed_amount} to merchant {merchant_id}'s wallet.")
            except Exception as e:
                print(f"Error auto-crediting wallet for order {order_id}: {e}")
            
            # Notify via Socket.IO
            await sio.emit("payment_update", {
                "type": "PAYMENT_PAID",
                "order_id": order_id,
                "payment_id": order_id,
                "status": "Success",
                "message": f"Payment Successful for Order: {order_id}",
                "redirect_url": f"/merchant/payments"
            })
            
            return {"status": "success", "message": "Payment updated"}
            
    elif event_type == "PAYMENT_FAILED_WEBHOOK":
        data = payload.get("data", {})
        order_info = data.get("order", {})
        payment_info = data.get("payment", {})
        
        order_id = order_info.get("order_id")
        payment_status = payment_info.get("payment_status")
        
        if payment_status != "FAILED":
            return {"status": "error", "message": "THIS STATUS IS NOT AVAILABLE ON THIS."}
            
        if order_id and payment_status == "FAILED":
            db = get_database()
            
            # Check if the payment exists in the database first
            existing = await db.payments.find_one({"id": order_id})
            if not existing:
                # Payment not found — do NOT auto-create phantom records.
                print(f"Webhook: Payment {order_id} not found in database. Ignoring to prevent phantom records.")
                return {"status": "ignored", "message": f"No payment found for order_id '{order_id}'. Webhook skipped."}
                
            # If the ID exists, check if it was already Failed
            if existing.get("status") in ["Failed"]:
                print(f"Payment {order_id} is already marked as {existing.get('status')}. Emitting socket update to confirm.")
                await sio.emit("payment_update", {
                    "type": "PAYMENT_FAILED",
                    "order_id": order_id,
                    "payment_id": order_id,
                    "status": "Failed",
                    "message": f"Payment Failed for Order: {order_id}",
                    "redirect_url": f"/merchant/payments"
                })
                return {"status": "success", "message": "Payment already processed"}
                
            # Get the payment amount from payment_info or order_info and update it
            amount_val = payment_info.get("payment_amount") or order_info.get("order_amount")
            update_fields = {
                "status": "Failed",
                "cf_payment_id": payment_info.get("cf_payment_id"),
                "payment_time": payment_info.get("payment_time"),
                "payment_method": payment_info.get("payment_group")
            }
            if amount_val is not None:
                try:
                    update_fields["amount"] = f"₹{float(amount_val):,.2f}"
                except Exception as e:
                    print(f"Error parsing amount {amount_val}: {e}")

            # Update the payment status and amount in the database to Failed
            update_fields["updated_at"] = datetime.now()
            await db.payments.update_one(
                {"id": order_id},
                {"$set": update_fields}
            )
            
            print(f"Successfully updated payment {order_id} to Failed (Amount: {update_fields.get('amount')})")
            
            # Notify via Socket.IO
            await sio.emit("payment_update", {
                "type": "PAYMENT_FAILED",
                "order_id": order_id,
                "payment_id": order_id,
                "status": "Failed",
                "message": f"Payment Failed for Order: {order_id}",
                "redirect_url": f"/merchant/payments"
            })
            
            return {"status": "success", "message": "Payment updated"}
            
    return {"status": "ignored", "message": "Event type not handled or invalid"}


@router.post("/admin/withdrawals/sync-status")
@router.post("/merchant/withdrawals/sync-status")
async def sync_cashfree_withdrawals(current_user: dict = Depends(get_current_user)):
    db = get_database()
    
    app_id = os.getenv("CASHFREE_PAYOUT_APP_ID") or os.getenv("CASHFREE_APP_ID")
    secret_key = os.getenv("CASHFREE_PAYOUT_SECRET_KEY") or os.getenv("CASHFREE_SECRET_KEY")
    environment = os.getenv("CASHFREE_ENVIRONMENT", "sandbox")
    base_url = "https://sandbox.cashfree.com" if environment == "sandbox" else "https://api.cashfree.com"
    
    headers = {
        "x-client-id": app_id or "",
        "x-client-secret": secret_key or "",
        "x-api-version": "2024-01-01",
        "Content-Type": "application/json"
    }

    # Find pending or completed withdrawals (in case Completed was just RECEIVED in Cashfree)
    query = {"status": {"$in": ["Pending", "Completed", "RECEIVED", "PROCESSING"]}}
    if current_user.get("role") != "admin":
        query["email"] = current_user.get("email")

    withdrawals = await db.withdrawals.find(query).to_list(length=100)
    updated_count = 0
    
    async with httpx.AsyncClient() as client:
        for w in withdrawals:
            transfer_id = w.get("transfer_id")
            if not transfer_id:
                continue
                
            url = f"{base_url}/payout/transfers/{transfer_id}"
            try:
                res = await client.get(url, headers=headers, timeout=10)
                if res.status_code == 200:
                    data = res.json()
                    cf_status = data.get("status")
                    
                    new_status = w.get("status")
                    if cf_status == "SUCCESS":
                        new_status = "Completed"
                    elif cf_status in ["FAILED", "REJECTED"]:
                        new_status = "Failed"
                    elif cf_status in ["RECEIVED", "PROCESSING"]:
                        new_status = "Pending"
                        
                    if new_status != w.get("status"):
                        await db.withdrawals.update_one({"_id": w["_id"]}, {"$set": {"status": new_status}})
                        await db.wallet_transactions.update_many({"transfer_id": transfer_id}, {"$set": {"status": new_status}})
                        updated_count += 1
            except Exception as e:
                print(f"Failed to sync {transfer_id}: {e}")
                
    return {"status": "success", "message": f"Successfully synced statuses.", "synced": updated_count}


@router.post("/checkout/{payment_id}/simulate")
async def simulate_payment(payment_id: str, req: dict):
    db = get_database()
    status = req.get("status") # "success", "pending", "failed"
    
    if status not in ["success", "pending", "failed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    payment = await db.payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")
        
    if status == "success":
        update_fields = {
            "status": "Success",
            "cf_payment_id": f"cf_sim_{generate_secure_key()}",
            "payment_time": datetime.now().isoformat(),
            "payment_method": "upi_simulated",
            "updated_at": datetime.now()
        }
        await db.payments.update_one({"id": payment_id}, {"$set": update_fields})
        
        try:
            raw_amount = payment.get("amount", "0")
            amount_val = float(str(raw_amount).replace('₹', '').replace(',', ''))
            merchant_email = payment.get("email")
            if merchant_email:
                merchant = await db.merchants.find_one({"email": merchant_email})
                if merchant:
                    merchant_id = merchant.get("merchant_id")
                    current_balance = float(merchant.get("wallet_balance", 0.0))
                    new_balance = current_balance + amount_val
                    
                    await db.merchants.update_one(
                        {"merchant_id": merchant_id},
                        {"$set": {"wallet_balance": new_balance, "updated_at": datetime.now()}}
                    )
                    
                    transaction = {
                        "merchant_id": merchant_id,
                        "amount": amount_val,
                        "type": "CREDIT",
                        "description": f"Payment received (SIMULATION): {payment_id}",
                        "timestamp": datetime.now()
                    }
                    await db.wallet_transactions.insert_one(transaction)
                    
                    await sio.emit("payment_update", {
                        "type": "WALLET_UPDATED",
                        "message": f"Payment of ₹{amount_val:,.2f} added to your wallet.",
                        "new_balance": new_balance,
                        "email": merchant_email
                    })
        except Exception as e:
            print(f"Error simulation wallet topup: {e}")
            
        await sio.emit("payment_update", {
            "type": "PAYMENT_PAID",
            "order_id": payment_id,
            "payment_id": payment_id,
            "status": "Success",
            "message": f"Payment Successful for Order: {payment_id}",
            "redirect_url": f"/merchant/payments"
        })
        
    elif status == "failed":
        await db.payments.update_one(
            {"id": payment_id},
            {"$set": {
                "status": "Failed",
                "updated_at": datetime.now()
            }}
        )
        await sio.emit("payment_update", {
            "type": "PAYMENT_FAILED",
            "order_id": payment_id,
            "payment_id": payment_id,
            "status": "Failed",
            "message": f"Payment Failed for Order: {payment_id}"
        })
        
    elif status == "pending":
        await db.payments.update_one(
            {"id": payment_id},
            {"$set": {
                "status": "Pending",
                "updated_at": datetime.now()
            }}
        )
        await sio.emit("payment_update", {
            "type": "PAYMENT_PENDING",
            "order_id": payment_id,
            "payment_id": payment_id,
            "status": "Pending",
            "message": f"Payment Pending for Order: {payment_id}"
        })
        
    return {"status": "success", "message": f"Simulated status {status} successfully"}
