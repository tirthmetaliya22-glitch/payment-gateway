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
from routes import (
    router, create_cashfree_order, initiate_cashfree_upi_pay,
    add_payment_links, get_db_user_id_for_email
)

app = FastAPI()

# Wrap with Socket.IO ASGI app so both app and socket_app are exported
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

@app.on_event("startup")
async def startup_event():
    print("\n" + "="*50)
    print("PAYFLOW BACKEND STARTING")
    print(f"API URL: http://127.0.0.1:8000")
    print(f"Socket.IO: http://127.0.0.1:8000/socket.io")
    print("Running on: uvicorn main:app or uvicorn main:socket_app")
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
    allow_origin_regex="https://.*\\.vercel\\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
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

@sio.event
async def connect(sid, environ):
    print(f"Socket connected: {sid}") 

@sio.event
async def disconnect(sid):
    print(f"Socket disconnected: {sid}")

@sio.on("admin_create_invite")
async def handle_admin_create_invite(sid, data):
    try:
        print(f"Socket event: admin_create_invite from {sid}")
        
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
            merchant_email = merchant.get("email")
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
                "timestamp": True
            }

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
            
            await sio.emit("payment_update", {
                "type": "NEW_PAYMENT",
                "message": f"Admin created a payment request for {name} (₹{amount_val})",
                "redirect_url": "/merchant/payments"
            })
            return {"status": "success", "type": "payment"}
        
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
        }
        
        await db.invites.insert_one(invite_data)
        
        await sio.emit("admin_notification", {
            "type": "INVITE_CREATED",
            "message": f"New invite sent to {name} ({email})",
            "invite_id": invite_id
        })
        
        return {"status": "success", "type": "invite"}
    except Exception as e:
        print(f"Error in handle_admin_create_invite: {e}")
        await sio.emit("error", {"message": str(e)}, room=sid)

@sio.on("admin_create_payment_link")
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
        
        await sio.emit("payment_update", {
            "type": "NEW_PAYMENT",
            "message": f"Admin created a payment link for {payment_data['username']}: {payment_data['amount']}",
            "redirect_url": "/merchant/payments"
        })
        
        return {"status": "success", "payment_id": payment_data["id"]}
    except Exception as e:
        print(f"Error in handle_admin_create_payment_link: {e}")

# Include the main modular router
app.include_router(router)
