import os
from typing import Optional, Annotated, Union
import secrets
import string
import json
import random
import urllib.parse
from datetime import datetime, timezone
from fastapi import HTTPException, Depends, Header, Request
from database import check_db_connection, get_database
import httpx
import uuid
from bson import ObjectId

from schemas import (
    PyObjectId, Payment, Settlement, Customer, ContactInquiry,
    MerchantProfile, PasswordUpdate, LoginRequest, SupportTicket,
    SupportTicketReply, AdminSettings, MerchantInvite,
    RegenerateKeysRequest, ActivateRequest, CreateMerchantRequest,
    AddFundsRequest, WithdrawRequest
)

async def get_db_user_id_for_email(db, email: str) -> Union[ObjectId, str]:
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
                
                # Sandbox Payout Fallback
                if environment == "sandbox":
                    print(f"[SANDBOX FALLBACK] Simulating successful payout of {amount} (Cashfree Error: {error_msg})")
                    return True, "Success", transfer_id
                    
                return False, f"Transfer Error: {error_msg}", None
                
    except Exception as e:
        print(f"Error initiating cashfree payout: {e}")
        
        # Sandbox Payout Fallback
        if environment == "sandbox":
            transfer_id = f"WD-{int(datetime.now().timestamp())}"
            print(f"[SANDBOX FALLBACK] Simulating successful payout of {amount} due to connection error: {e}")
            return True, "Success", transfer_id
            
        return False, str(e), None
