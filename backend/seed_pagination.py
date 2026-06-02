import httpx
import time

API_URL = "http://127.0.0.1:8000"

def create_payment(name, amount, status="Active", creation_timestamp=None):
    payload = {
        "name": name,
        "amount": f"₹{amount}",
        "currency": "INR",
        "status": status,
        "merchant_name": "Luxury Merchant"
    }
    # Note: the backend sets creation_timestamp, but for testing expired links 
    # we might need to manually insert into DB or wait.
    # However, for testing pagination, just creating many is enough.
    resp = httpx.post(f"{API_URL}/merchant/payments", json=payload)
    data = resp.json()
    if data.get("status") == "success":
        payment = data.get("payment", {})
        print(f"Created: {payment.get('name')} | ID: {payment.get('id')} | QR: {payment.get('qr_link')}")
    return data

if __name__ == "__main__":
    # Create 15 payments to test pagination (8 items per page)
    for i in range(1, 16):
        # Make some of them expired by pretending they were created long ago?
        # Actually the backend sets it. I'll just create them.
        # To test "Expired" logic, I'd need to wait 12 mins or mock the clock.
        # But for now, I'll just create them so they are "Active".
        create_payment(f"Active Link {i}", f"{100 * i}.00")
        
    print("Created 15 active payments.")
