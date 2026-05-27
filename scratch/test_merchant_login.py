import requests
import json

URL = "http://127.0.0.1:8000/login"
DATA = {
    "email": "kenilhkdigiverse@gmail.com",
    "password": "password123"
}

try:
    response = requests.post(URL, json=DATA)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Error: {e}")
