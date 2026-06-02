# Workspace Manifest - File Index & Content Descriptions

This document provides a complete directory catalog of every file within the **next gateway** payment repository (both `/backend` and `/frontend`), detailing the exact content and structural purpose of each file.

---

## 📂 Backend Workspace Directory (`/backend`)

The backend codebase is built on **Python**, powered by the **FastAPI** framework, uses **MongoDB (via Motor driver)** as its datastore, and implements **Socket.IO** for real-time notifications.

| Filename | Content Summary & Operational Purpose |
| :--- | :--- |
| **`main.py`** | **App Bootstrapper**: Configures and spins up the FastAPI web server, sets up global CORS allowances for frontend ports, and binds the ASGI Socket.IO real-time server wrapper. |
| **`routes.py`** | **REST API Routes**: Declares all application endpoints including Merchant/Admin logins, dynamic payment generation, manual UTR verifications, simulated checkouts, and Cashfree webhook receivers. |
| **`dependencies.py`** | **Integrations & Operations**: The core engine of the API. Implements deep integrations with Cashfree APIs (Orders, Payments, and Payout withdrawals), handles URL/QR decorators, verifies tokens, and emits WebSockets. |
| **`database.py`** | **Database Connection**: Initializes the asynchronous MongoDB database engine wrapper using the `Motor` driver. |
| **`schemas.py`** | **Data Models**: Formulates all request and response structures (e.g. `Payment`, `Settlement`, `SupportTicket`, `Customer`) using `Pydantic` for serialization and type checking. |
| **`socket_config.py`** | **Socket Config**: Exports the global Socket.IO `sio` object utilized by both `main.py` and helper hooks to communicate real-time updates. |
| **`.env`** | **Secrets Configuration**: Contains sensitive keys, database URLs, auth algorithm constants, and active Cashfree Sandbox integration credentials. |
| **`check_lnk.py`** | **Utility Script**: Simple test runner querying individual payment link objects (like `LNK-270`) to assert DB connection accuracy and view link parameters in console. |
| **`check_db.py`** | **Diagnostic Script**: Instantly verifies connection status between the backend API and MongoDB cluster.  |
| **`audit_db.py`** | **Audit Log Utility**: Fetches and formats system activity history records from the database. |
| **`create_test.py`** | **Seed Helper**: Creates fake test orders and merchant profiles for mock validations. |
| **`dump_lnk.py`**| **DB Inspector**: Utility that formats and prints payment entries directly in the console. |
| **`dump_passwords.py`** | **Credentials Dump**: Diagnostic tool that securely inspects password properties inside the database merchants table. |
| **`list_users.py`** | **User Directory**: Queries and lists all merchant names, emails, and usernames registered in MongoDB. |
| **`seed_db.py`** | **DB Seeder**: Automatically populates the database with basic dummy merchants, settlements, support tickets, and payments. |
| **`seed_pagination.py`**| **Pagination Seeder**: Generates large batches of mockup entries to test pagination behavior in merchant lists. |
| **`migrate_db.py`** | **Database Migration**: Handles database migrations when updating collection formats. |
| **`migrate_dates.py`** | **Migration Helper**: Standardizes date/timestamp formats in payments collections to unified ISO strings. |
| **`migrate_payments.py`**| **Migration Helper**: Alters schema attributes on dynamic payment records. |
| **`migrate_withdrawals.py`** | **Migration Helper**: Synchronizes withdrawal fields to support multi-currency payout statuses. |
| **`migrate_remove_user_id.py`** | **Migration Helper**: Sanitizes obsolete properties inside database profiles. |
| **`test_api.py`** | **Integration Test**: Asserts route integrity by issuing virtual mock requests. |
| **`test_cf.py`** | **Cashfree Connector Test**: Verifies sandbox orders initialization with Cashfree. |
| **`test_payment.py`** | **Payment API Test**: Asserts dynamic request creations and validations. |
| **`test_webhook.py`** | **Webhook Test**: Simulates webhook notifications from Cashfree to routes. |
| **`test_connection.py`** | **Socket Test**: Validates live handshake protocols for backend Socket.IO connections. |
| **`test_callback.py`** | **Payout Test**: Verifies merchant settlement triggers and automated withdrawal updates. |
| **`backend.log`** / **`live_debug.log`** | **Operational Logs**: Files holding historical console traces and endpoint errors. |

---

## 📂 Frontend Workspace Directory (`/frontend`)

The frontend is a **Next.js** modern web application built on **TypeScript**, styled with **TailwindCSS**, and utilizes **Socket.io-client** for instant real-time synchronization.

| Filename | Content Summary & Operational Purpose |
| :--- | :--- |
| **`src/app/checkout/[id]/page.tsx`** | **Checkout Page**: The dynamic, public payment page where consumers scan QR codes, view dynamic pricing, verify manually with UTR forms, and receive success feedback. |
| **`src/app/merchant/wallet/page.tsx`** | **Wallet Dashboard**: Merchant dashboard funding interface to deposit mock funds and inspect balance histories. |
| **`src/app/merchant/payments/page.tsx`** | **Payments Dashboard**: Merchant panel compiling invoice summaries, refund handlers, and payment page creations. |
| **`src/app/admin/merchants/page.tsx`** | **Merchants Manager**: Admin portal dashboard listing active merchants, modifying account tiers, and adding funds. |
| **`src/app/login/page.tsx`** | **Authentication Portal**: Beautiful secure dashboard login page for merchants and administrators. |
| **`src/app/contact/page.tsx`** | **Support Form**: Customer support inquiry hub forwarding support tickets to the database. |
| **`src/app/page.tsx`** | **Landing Page**: Main portal page showcasing statistics, features, and active dashboard links. |
| **`src/app/layout.tsx`** | **Root Layout**: The framework page defining global CSS injections, fonts, viewport layouts, and browser head metatags. |
| **`src/app/globals.css`** | **Global Styling**: Contains base TailwindCSS rules, smooth scroll definitions, and modern glassmorphism utility classes. |
| **`src/lib/api.ts`** | **Connection Endpoint**: Centralized library exporting active URL paths to reach the running Python API server. |
| **`.env.local`** | **Local Configurations**: Maps Next.js client-side variables (e.g. backend host address, Sandbox App Client ID). |
| **`package.json`** | **Dependencies Manifest**: Details lists of installed client packages (Next.js 16, React 19, Socket.io-client, Lucide Icons, Jimp). |
| **`tsconfig.json`** | **TypeScript Compiler**: Directs rules and compiling guidelines for static type validations. |
| **`next.config.ts`** | **Next.js Settings**: Contains Next compiler options and Turbopack compiler engines. |
| **`tailwind.config.ts`** / **`postcss.config.mjs`** | **Style Compilers**: Configuration engines mapping styling tokens and processing CSS variables. |
| **`user_qr.png`** / **`screenshot.png`** | **Mock Assets**: Static images used for interface mockup illustrations. |
