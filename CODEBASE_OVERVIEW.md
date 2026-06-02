# Codebase Overview - APIs and Configurations

This document provides a comprehensive structural guide to all API files, utility helpers, and configurations across the frontend and backend of this payment gateway application.

---

## 📂 Backend Core Files (`/backend`)

### 1. `backend/routes.py` (API Endpoints & Handlers)
*   **Purpose**: The primary routing controller for the FastAPI server, defining all HTTP endpoints that the frontend, admin panel, and third-party services interact with.
*   **Key Endpoints**:
    *   **User/Merchant Auth**: `@router.post("/login/admin")`, `@router.post("/login/merchant")` — Validates email/password credentials and issues sessions.
    *   **Payment links**: `@router.post("/merchant/payments")`, `@router.get("/merchant/payments/{payment_id}")` — Generates custom payment link sessions, records them to the database, and queries them.
    *   **Manual UTR Verification**: `@router.post("/merchant/verify-utr")` — Customer-facing form handler to submit 12-digit transaction numbers for bank-wire verification.
    *   **Simulate Payment**: `@router.post("/checkout/{payment_id}/simulate")` — Emulates payment state responses (Success/Failed/Pending) in sandbox environments.
    *   **Cashfree Webhooks**: `@router.post("/webhook/cashfree")` — Intercepts real-time events from Cashfree to update orders and wallet balances instantly.

---

### 2. `backend/dependencies.py` (Integrations, Webhooks & Utility Helpers)
*   **Purpose**: Houses core third-party APIs, authentication guards, and direct socket bindings.
*   **Key Operations**:
    *   **Cashfree SDK APIs**: `create_cashfree_order`, `initiate_cashfree_upi_pay`, and `initiate_cashfree_payout` — Direct integrations talking to Cashfree's Sandbox or Production servers.
    *   **URL/QR Decorators**: `add_payment_links` — Dynamically appends formatted `checkout_url`s, local `upi_string`s, and `qr_link`s.
    *   **Websocket Broadcaster**: Leverages `sio.emit()` to update dashboards dynamically without browser refresh.
    *   **Authentication Guard**: `get_current_user` — Standard FastAPI dependency checking Bearer Tokens against the MongoDB active `sessions` table.

---

### 3. `backend/main.py` (App Initializer & Listener)
*   **Purpose**: Bootstraps the application, mounts middlewares, and registers backend routes.
*   **Key Operations**:
    *   Creates the raw `FastAPI` instance.
    *   Configures CORS (Cross-Origin Resource Sharing) policies allowing frontend ports (e.g. `3000`, `3001`, `3002`) to request data.
    *   Mounts the real-time Socket.IO ASGI server.

---

### 4. `backend/database.py` & `backend/schemas.py` (Data Models & Connectors)
*   **Purpose**: Manages MongoDB interactions and Pydantic object models.
    *   **`database.py`**: Initiates the async MongoDB connection via the `Motor` driver.
    *   **`schemas.py`**: Formulates type-strict request validation structures (e.g., `PyObjectId`, `Payment`, `WithdrawRequest`).

---

### 5. `backend/check_lnk.py` (Console Testing Utility)
*   **Purpose**: A simple diagnostic developer utility designed to test connection parameters and print dynamic checkout records (e.g. `LNK-270`) directly to the console.

---

## 💻 Frontend Core Files (`/frontend`)

### 1. `frontend/src/app/checkout/[id]/page.tsx` (Secure Pay checkout Screen)
*   **Purpose**: The central consumer-facing payment screen.
*   **Key Operations**:
    *   **Dynamic QR Codes**: Generates high-clarity dynamic QR code graphics and simulator links.
    *   **Socket.IO Listener**: Synchronizes with `/payment_update` to instantly trigger success screen redirects once payment has cleared.
    *   **Manual UTR forms**: Feeds inputs to `/merchant/verify-utr` for manual payment reconciliations.

---

## ⚙️ Configuration Files

### 1. Backend Environment Configurations (`backend/.env`)
Stores secure database URIs and payment gateway credentials:
*   `DATABASE_URL`: Active MongoDB Atlas connection URI.
*   `CASHFREE_APP_ID` & `CASHFREE_SECRET_KEY`: Standard API access credentials for Cashfree Sandbox.
*   `CASHFREE_ENVIRONMENT`: Sandbox/production flag (`sandbox` or `production`).

### 2. Frontend Environment Configurations (`frontend/.env.local`)
Client-side address configurations:
*   `NEXT_PUBLIC_API_URL`: Fully qualified address of your Python API endpoint (e.g., `http://localhost:8000`).
*   `NEXT_PUBLIC_CASHFREE_APP_ID`: Standard Sandbox Client ID.
*   `NEXT_PUBLIC_CASHFREE_ENVIRONMENT`: Set to `sandbox`.
