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
    AddFundsRequest, WithdrawRequest
)


from socket_config import sio

async def startup_event():
    print("\n" + "="*50)
    print("PAYFLOW BACKEND STARTING")
    print(f"API URL: http://127.0.0.1:8000")
    print(f"Socket.IO: http://127.0.0.1:8000/socket.io")
    print("Running on: uvicorn main:app")
    print("="*50 + "\n")
    
    is_connected = await check_db_connection()
    if is_connected:
        print("MongoDB: Connected [OK]")
    else:
        print("MongoDB: Connection Failed [ERROR]")

# Add CORS middleware
    app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://0.0.0.0:3000",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def get_db_user_id_for_email(db, email: str) -> Union[ObjectId, str]:
    if not email:
        return ObjectId()
    email_regex = {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}
    merchant = await db.merchants.find_one({"email": email_regex})
    if merchant:
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

async def log_requests(request: Request, call_next):
    with open("live_debug.log", "a", encoding="utf-8") as f:
        f.write(f"\n--- REQUEST {datetime.utcnow()} ---\n")
        f.write(f"{request.method} {request.url}\n")
        f.write(f"Headers: {dict(request.headers)}\n")
    try:
        response = await call_next(request)
        with open("live_debug.log", "a", encoding="utf-8") as f:
            f.write(f"Response status: {response.status_code}\n")
        return response
    except Exception as e:
        with open("live_debug.log", "a", encoding="utf-8") as f:
            f.write(f"Exception: {str(e)}\n")
        raise e

# Socket.IO Events
async def connect(sid, environ):
    print(f"Socket connected: {sid}")

async def disconnect(sid):
    print(f"Socket disconnected: {sid}")

async def handle_admin_create_invite(sid, data):
    try:
        print(f"Socket event: admin_create_invite from {sid}")
        # Manual verification of token could go here
        
        db = get_database()
        name = data.get("name")
        email = data.get("email")
        amount = data.get("amount")
        
        if not name or not email:
            await sio.emit("error", {"message": "Name and Email are required"}, room=sid)
            return

        # 1. Check if merchant already exists (case-insensitive)
        merchant = await db.merchants.find_one({"email": {"$regex": f"^{email.replace('.', '\\.')}$", "$options": "i"}})
        
        if merchant:
            # Use the exact email from the merchant record to ensure dashboard visibility
            merchant_email = merchant.get("email")
            # If merchant exists, create a payment request instead of an invitation
            payment_id = f"ADM-{random.randint(1000, 9999)}"
            amount_val = amount if amount else "0"
            
            payment_data = {
                "id": payment_id,
                "name": f"Admin Request: {name}",
                "amount": f"₹{float(amount_val):,.2f}",
                "currency": "INR",
                "status": "Active",
                "merchant_name": merchant.get("name"),
                "email": merchant_email,
                "user_id": await get_db_user_id_for_email(db, merchant_email),
                "created": f"{datetime.now().strftime('%Y-%m-%d')} by Admin",
                "creation_timestamp": datetime.now().timestamp(),
                "created_by": "admin",
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "timestamp":True
            }

            # Integrate Cashfree Flow (simplified for socket)
            try:
                amount_float = float(amount_val)
                if amount_float > 0:
                    session_id = await create_cashfree_order(
                        amount=amount_float,
                        customer_id=f"CUST-{random.randint(1000, 9999)}",
                        customer_phone=merchant.get("phone", "9999999999"),
                        customer_email=email,
                        order_id=payment_id
                    )
                    if session_id:
                        payment_data["payment_session_id"] = session_id
                        cf_upi_link = await initiate_cashfree_upi_pay(session_id)
                        if cf_upi_link:
                            payment_data["cf_upi_link"] = cf_upi_link
            except: pass

            payment_data = add_payment_links(payment_data)
            await db.payments.insert_one(payment_data)
            
            # Notify via socket
            await sio.emit("payment_update", {
                "type": "NEW_PAYMENT",
                "message": f"Admin created a payment request for {name} (₹{amount_val})",
                "redirect_url": "/merchant/payments"
            })
            return {"status": "success", "type": "payment"}
        
        # 2. Otherwise, create a standard invitation
        invite_id = f"INV-{random.randint(1000, 9999)}"
        invite_data = {
            "name": name,
            "email": email,
            "amount": amount,
            "created": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "status": "Invited",
            "invite_id": invite_id,
            "user_id": await get_db_user_id_for_email(db, email),
            "created_at": datetime.now(),
            "updated_at": datetime.now()
            # "timestamp":True}
        }
        
        await db.invites.insert_one(invite_data)
        
        # Broadcast the new invite notification
        await sio.emit("admin_notification", {
            "type": "INVITE_CREATED",
            "message": f"New invite sent to {name} ({email})",
            "invite_id": invite_id
        })
        
        return {"status": "success", "type": "invite"}
    except Exception as e:
        print(f"Error in handle_admin_create_invite: {e}")
        await sio.emit("error", {"message": str(e)}, room=sid)

async def handle_admin_create_payment_link(sid, data):
    try:
        print(f"Socket event: admin_create_payment_link from {sid}")
        db = get_database()
        username = data.get("username")
        payment_input = data.get("payment", {})
        
        if not username or not payment_input:
            await sio.emit("error", {"message": "Username and Payment data are required"}, room=sid)
            return
            
        merchant = await db.merchants.find_one({
            "$or": [
                {"username": {"$regex": f"^{username}$", "$options": "i"}},
                {"merchant_id": {"$regex": f"^{username}$", "$options": "i"}},
                {"email": {"$regex": f"^{username}$", "$options": "i"}}
            ]
        })
        
        if not merchant:
            await sio.emit("error", {"message": f"No merchant found with username '{username}'"}, room=sid)
            return
            
        email = merchant.get("email")
        payment_data = {
            "id": payment_input.get("order_id") or f"LNK-{random.randint(100000, 999999)}",
            "name": payment_input.get("name", "Payment"),
            "amount": payment_input.get("amount", "₹0"),
            "currency": payment_input.get("currency", "INR"),
            "merchant_name": merchant.get("name", "Luxury Merchant"),
            "upi_id": merchant.get("upi_id", "nexify@okicici"),
            "email": email,
            "user_id": await get_db_user_id_for_email(db, email),
            "username": merchant.get("username", username),
            "created": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "creation_timestamp": datetime.now().timestamp(),
            "status": "Active",
            "created_by": "admin",
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        # Create Cashfree Order
        try:
            amount_val = float(str(payment_data["amount"]).replace('₹', '').replace(',', ''))
            session_id = await create_cashfree_order(
                amount=amount_val,
                customer_id=f"CUST-{random.randint(1000, 9999)}",
                customer_phone="9999999999",
                customer_email=email or "customer@example.com",
                order_id=payment_data["id"],
                return_url=payment_input.get("return_url")
            )
            
            if session_id:
                payment_data["payment_session_id"] = session_id
                cf_upi_link = await initiate_cashfree_upi_pay(session_id)
                if cf_upi_link:
                    payment_data["cf_upi_link"] = cf_upi_link
        except: pass
            
        payment_data = add_payment_links(payment_data)
        await db.payments.insert_one(payment_data)
        
        # Notify via socket
        await sio.emit("payment_update", {
            "type": "NEW_PAYMENT",
            "message": f"Admin created a payment link for {payment_data['username']}: {payment_data['amount']}",
            "redirect_url": "/merchant/payments"
        })
        
        return {"status": "success", "payment_id": payment_data["id"]}
    except Exception as e:
        print(f"Error in handle_admin_create_payment_link: {e}")
        await sio.emit("error", {"message": str(e)}, room=sid)

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

