# 💊 MediTrack — Medicine Anti-Counterfeit Verification System

A full-stack supply chain tracking platform that combats pharmaceutical counterfeiting using **IoT hardware**, an **8-layer verification engine**, and **role-based dashboards** — all backed by a **PostgreSQL** relational database.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Vite | Single-page application |
| Backend | Node.js + Express | REST API server |
| Database | **PostgreSQL 18** + **Sequelize ORM** | Relational data storage |
| IoT | ESP32-CAM + OV3660 | QR scanning hardware |
| QR Generation | `qrcode` npm | GS1 serial QR codes |
| QR Decoding | `jsQR` + `Jimp` | Server-side image decoding |
| Auth | JWT + bcrypt | Role-based access control |
| Charts | Chart.js | Analytics visualization |

---

## System Architecture

```
┌───────────────────────────────────────────────────────────┐
│              FRONTEND (React + Vite :3000)                │
│  Manufacturer │ Middleman │ Pharmacy │ Regulator │ Patient│
└────────────────────────┬──────────────────────────────────┘
                         │ REST API (HTTP/JSON)
┌────────────────────────┼────────────────────────────────┐
│              BACKEND (Node.js + Express :5000)          │
│  Auth │ Scanner │ Manufacturer │ Middleman │ Pharmacy   │
│  Regulator │ Patient │ Analytics                        │
│                        │                                │
│          ┌─────────────┴─────────────┐                  │
│          │   Verification Service    │                  │
│          │   (8-Layer Check Engine)  │                  │
│          └─────────────┬─────────────┘                  │
└────────────────────────┼────────────────────────────────┘
                         │ Sequelize ORM
┌────────────────────────┼─────────────────────────────────┐
│            PostgreSQL Database (:5432)                   │
│  11 Tables │ 30+ Indexes │ Foreign Key Constraints       │
│  manufacturers │ products │ serial_numbers │ boxes       │
│  box_contents │ supply_chain_actors │ transactions       │
│  users │ verifications │ alerts │ recalls                │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│           IoT Layer (ESP32-CAM + OV3660)                 │
│  Captures JPEG → WiFi → /api/scanner/scan-image          │
│  Receives result → Green LED / Red LED + Buzzer          │
└──────────────────────────────────────────────────────────┘
```

---

## Database Design (PostgreSQL)

### Why PostgreSQL

- **ACID compliance** — Every medicine transaction is guaranteed to be atomic and consistent
- **ENUM types** — Native support for constrained values (roles, statuses, severities)
- **ARRAY columns** — `recalls.batch_numbers` stores multiple batch IDs in a single PostgreSQL array (`TEXT[]`), enabling batch-level queries without a join table
- **DECIMAL precision** — GPS coordinates stored as `DECIMAL(10,8)` and `DECIMAL(11,8)` for accurate checkpoint tracking
- **Connection pooling** — Sequelize pool configured with `max: 10, min: 2` for concurrent IoT scanner + web requests
- **Index-heavy schema** — 30+ indexes across tables for fast lookups on serial numbers, timestamps, and actor IDs

### Configuration

```env
# backend/.env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meditrack
DB_USER=postgres
DB_PASSWORD=your_password
```

```javascript
// backend/src/config/database.js
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT || 5432,
  dialect: 'postgres',
  pool: { max: 10, min: 2, acquire: 30000, idle: 10000 },
  define: { timestamps: true, underscored: true }  // snake_case columns + auto created_at/updated_at
});
```

### Entity Relationship Diagram

```
┌──────────────┐      1:N     ┌──────────────┐      1:N      ┌──────────────────┐
│ manufacturers│────────────▶│   products   │──────────────▶│  serial_numbers  │
│              │              │              │              │  (PRIMARY TABLE)  │
│ PK: mfr_id   │              │ PK: prod_id  │              │ PK: serial_number │
│ company_name │              │ FK: mfr_id   │              │ FK: product_id    │
│ license_no   │              │ product_name │              │ FK: box_id        │
│ city, state  │              │ generic_name │              │ batch_number      │
│ status       │              │ gtin (unique)│              │ status            │
└──────────────┘              │ strength     │              │ current_location  │
                              │ dosage_form  │              │ mfg_date, expiry  │
                              └──────┬───────┘              │ gs1_data, qr_url  │
                                     │                      │ dispensed_at/by   │
                                     │ 1:N                  └────────┬──────────┘
                              ┌──────┴───────┐                       │
                              │    boxes     │          N:M via      │
                              │ PK: box_id   │◀───── box_contents───┘
                              │ FK: prod_id  │     (box_id + serial_number)
                              │ batch_number │     (position within box)
                              │ box_qr_code  │
                              │ total_meds   │
                              │ status       │
                              └──────────────┘

┌───────────────────┐
│ supply_chain_actors│         ┌──────────────────┐
│ PK: actor_id      │────────▶│   transactions   │
│ actor_type (ENUM) │  as     │ PK: transaction_id│
│ company_name      │ from/to │ FK: serial_number │
│ license_number    │         │ FK: box_id        │
│ city, state       │         │ FK: from_actor_id │
│ lat, lon          │         │ FK: to_actor_id   │
│ status (ENUM)     │         │ type (ENUM)       │
└───────────────────┘         │ date, lat, lon    │
                              │ scanned_by        │
        ┌──────────┐          └──────────────────┘
        │  users   │
        │ PK: id   │          ┌──────────────────┐
        │ email    │          │  verifications   │
        │ pass_hash│          │ PK: verif_id     │
        │ role ENUM│          │ serial_number    │
        │ FK: mfr  │          │ result, reason   │
        │ FK: actor│          │ timestamp        │
        └──────────┘          │ ip, lat, lon     │
                              └──────────────────┘
┌──────────────┐
│    alerts    │              ┌──────────────────┐
│ PK: alert_id │              │     recalls      │
│ alert_type   │              │ PK: recall_id    │
│ serial_number│              │ FK: product_id   │
│ FK: actor_id │              │ batch_numbers[]  │◀── PostgreSQL ARRAY
│ severity ENUM│              │ recall_reason    │
│ description  │              │ severity (ENUM)  │
│ status (ENUM)│              │ status (ENUM)    │
└──────────────┘              └──────────────────┘
```

### Table Details

#### `serial_numbers` — Heart of the System
The most critical table. Every individual medicine unit has a row here.

| Column | Type | Description |
|--------|------|-------------|
| `serial_number` | `VARCHAR(100)` PK | Unique ID, format: `2026-PFZ-ASP-0000001` |
| `product_id` | `VARCHAR(50)` FK | References `products` |
| `box_id` | `VARCHAR(50)` FK | References `boxes` |
| `batch_number` | `VARCHAR(100)` | Batch grouping for recalls |
| `manufacturing_date` | `DATE` | When produced |
| `expiry_date` | `DATE` | Checked by verification engine |
| `gs1_data` | `TEXT` | GS1 DataMatrix encoded string |
| `qr_code_url` | `TEXT` | Base64 QR image |
| `status` | `VARCHAR(50)` | `manufactured → in_transit → at_middleman → at_pharmacy → dispensed` |
| `current_location` | `VARCHAR(100)` | Current actor_id holding this medicine |
| `dispensed_at` | `TIMESTAMP` | When given to patient |
| `dispensed_by` | `VARCHAR(100)` | Which pharmacy dispensed it |

**Indexes:** `product_id`, `box_id`, `batch_number`, `status`, `expiry_date`, `current_location`

#### `transactions` — Immutable Audit Trail
Every movement in the supply chain creates a row. Never deleted.

| Column | Type | Description |
|--------|------|-------------|
| `transaction_id` | `BIGINT` PK | Auto-incrementing |
| `serial_number` | `VARCHAR(100)` | Individual medicine (nullable for box-level) |
| `box_id` | `VARCHAR(50)` | Box-level tracking |
| `transaction_type` | `ENUM` | `manufacture, ship, receive, transfer, dispense, return, destroy` |
| `from_actor_id` | `VARCHAR(50)` FK | Who sent it |
| `to_actor_id` | `VARCHAR(50)` FK | Who received it |
| `transaction_date` | `TIMESTAMP` | When it happened |
| `location_lat` | `DECIMAL(10,8)` | GPS latitude of scan |
| `location_lon` | `DECIMAL(11,8)` | GPS longitude of scan |
| `scanned_by` | `VARCHAR(100)` | User who performed the scan |
| `device_id` | `VARCHAR(100)` | IoT scanner device ID |

**Indexes:** `serial_number`, `box_id`, `transaction_type`, `transaction_date`, `from_actor_id`, `to_actor_id`

#### `alerts` — Security Event Log
Auto-generated by the verification engine when threats are detected.

| Column | Type | Description |
|--------|------|-------------|
| `alert_id` | `VARCHAR(50)` PK | Unique alert identifier |
| `alert_type` | `VARCHAR(50)` | `invalid_code, duplicate_scan, velocity_attack, batch_poisoning, middleman_report` |
| `serial_number` | `VARCHAR(100)` | Related serial (nullable) |
| `actor_id` | `VARCHAR(50)` FK | Related actor |
| `severity` | `ENUM` | `low, medium, high, critical` |
| `description` | `TEXT` | Human-readable alert details |
| `status` | `ENUM` | `new → investigating → resolved / false_positive` |

#### `verifications` — Scan Audit Log
Every scan (patient, pharmacy, IoT) creates a verification record.

| Column | Type | Description |
|--------|------|-------------|
| `verification_id` | `BIGINT` PK | Auto-incrementing |
| `serial_number` | `VARCHAR(100)` | What was scanned |
| `requested_by` | `VARCHAR(50)` | `PATIENT, pharmacy, scanner` |
| `verification_result` | `VARCHAR(50)` | `valid, invalid, expired, already_used` |
| `failure_reason` | `VARCHAR(255)` | Why it failed (if applicable) |
| `request_timestamp` | `TIMESTAMP` | When scanned |
| `ip_address` | `VARCHAR(45)` | Scanner's IP (IPv4/IPv6) |
| `location_lat/lon` | `DECIMAL` | GPS of scan location |

#### `recalls` — Batch Recall Management
Uses PostgreSQL's native `TEXT[]` array type for batch numbers.

| Column | Type | Description |
|--------|------|-------------|
| `recall_id` | `VARCHAR(50)` PK | Unique recall ID |
| `product_id` | `VARCHAR(50)` FK | Which product |
| `batch_numbers` | `TEXT[]` | **PostgreSQL array** — list of affected batches |
| `recall_reason` | `TEXT` | Why recalled |
| `severity` | `ENUM` | `class_1` (most dangerous), `class_2`, `class_3` |
| `status` | `ENUM` | `active, completed, cancelled` |

### Model Associations (Sequelize)

```javascript
// Defined in models/index.js — 12 associations total

Manufacturer.hasMany(Product, { foreignKey: 'manufacturer_id' });
Product.belongsTo(Manufacturer, { foreignKey: 'manufacturer_id' });

Product.hasMany(Box, { foreignKey: 'product_id' });
Product.hasMany(SerialNumber, { foreignKey: 'product_id' });

Box.hasMany(SerialNumber, { foreignKey: 'box_id' });
Box.hasMany(BoxContent, { foreignKey: 'box_id' });

SerialNumber.hasMany(Transaction, { foreignKey: 'serial_number', sourceKey: 'serial_number' });
Box.hasMany(Transaction, { foreignKey: 'box_id' });

SupplyChainActor.hasMany(Transaction, { foreignKey: 'from_actor_id', as: 'outgoingTransactions' });
SupplyChainActor.hasMany(Transaction, { foreignKey: 'to_actor_id', as: 'incomingTransactions' });

User.belongsTo(Manufacturer, { foreignKey: 'manufacturer_id' });
User.belongsTo(SupplyChainActor, { foreignKey: 'actor_id' });
```

### Key Query Patterns

**Get full journey of a medicine:**
```sql
SELECT t.*, 
       fa.company_name AS from_name, fa.city AS from_city,
       ta.company_name AS to_name, ta.city AS to_city
FROM transactions t
LEFT JOIN supply_chain_actors fa ON t.from_actor_id = fa.actor_id
LEFT JOIN supply_chain_actors ta ON t.to_actor_id = ta.actor_id
WHERE t.serial_number = '2026-PFZ-ASP-0000001'
   OR t.box_id = (SELECT box_id FROM serial_numbers WHERE serial_number = '2026-PFZ-ASP-0000001')
ORDER BY t.transaction_date ASC;
```

**Velocity attack detection (3+ scans in 1 hour):**
```sql
SELECT serial_number, COUNT(*) AS scan_count
FROM verifications
WHERE verification_result = 'valid'
  AND request_timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY serial_number
HAVING COUNT(*) >= 3;
```

**Batch integrity check (alert count per batch in 7 days):**
```sql
SELECT COUNT(*) AS alert_count
FROM alerts
WHERE alert_type IN ('invalid_code', 'duplicate_scan', 'repackaged_medicine')
  AND created_at >= NOW() - INTERVAL '7 days';
```

**Recall check using PostgreSQL array:**
```sql
SELECT * FROM recalls
WHERE product_id = 'PROD-ASP-500'
  AND status = 'active'
  AND 'BATCH-2026-001' = ANY(batch_numbers);  -- PostgreSQL array contains
```

### Seeding the Database

```bash
cd backend
npm run seed
```

This creates: 2 manufacturers, 2 products, 4 supply chain actors, 8 users, 200 serial numbers, boxes with full supply chain transactions, 5 alerts, 1 recall, and verification analytics data.

---

### 1. Create PostgreSQL Database

```sql
-- Open psql or pgAdmin and run:
CREATE DATABASE meditrack;
```

### 2. Backend Setup

```bash
cd backend
npm install

# Create .env file
echo "PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meditrack
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=24h" > .env

# Seed the database (creates tables + demo data)
npm run seed

# Start backend
npm start        # or: npm run dev (with nodemon)
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev      # Opens at http://localhost:3000
```

### 4. Access the App

- **Frontend:** http://localhost:3000
- **Patient Verify:** http://localhost:3000/verify
- **Backend API:** http://localhost:5000

---

## API Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/login` | No | User login |
| POST | `/api/auth/register` | No | User registration |
| GET | `/api/manufacturer/products` | JWT | List products |
| POST | `/api/manufacturer/products` | JWT | Register product |
| POST | `/api/manufacturer/generate` | JWT | Generate serials + QR codes |
| POST | `/api/middleman/receive` | JWT | Receive box at checkpoint |
| POST | `/api/middleman/ship` | JWT | Ship box forward |
| POST | `/api/middleman/report` | JWT | Report suspicious medicine |
| POST | `/api/pharmacy/verify` | JWT | Verify individual medicine |
| POST | `/api/pharmacy/dispense` | JWT | Dispense to patient |
| POST | `/api/patient/verify` | No | Public verification |
| GET | `/api/regulator/dashboard` | JWT | Dashboard statistics |
| GET/POST | `/api/regulator/actors` | JWT | Actor CRUD |
| POST | `/api/scanner/scan` | No | IoT scanner (text) |
| POST | `/api/scanner/scan-image` | No | IoT scanner (JPEG image) |
| GET | `/api/analytics/*` | JWT | Verification trends, alerts |

