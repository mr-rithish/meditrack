# 💊 MediTrack — Medicine Anti-Counterfeit Verification System

MediTrack is an IoT-enabled supply chain tracking platform that fights pharmaceutical counterfeiting. It tracks every medicine from the factory floor to the patient's hands — using unique QR codes, checkpoint scanning, an 8-layer verification engine, and an ESP32-CAM hardware scanner.

> **Built by:** M. Rithish, D. Hemember, R. Jaidev
> **Guide:** Dr. P. Kalpana | Vasavi College of Engineering, Hyderabad | 2026

---

## The Problem

- **WHO reports** 10% of medicines worldwide are counterfeit — rising to 30% in developing countries
- **1 million deaths** annually from fake medicines
- Existing anti-counterfeit measures (holograms, watermarks) are easily replicated
- Patients have **no way to independently verify** their medicine's authenticity
- Supply chains pass through 3–5 intermediaries where counterfeits can be injected with **zero traceability**

## Our Solution

MediTrack creates a **digital chain of custody** for every medicine. Each unit gets a unique QR-coded serial number at manufacturing. As it moves through wholesalers, distributors, and pharmacies, each intermediary scans the QR to log their checkpoint. When a patient finally buys the medicine, they can scan it to see the **entire journey** — and instantly know if it's genuine.

If anything is wrong — fake serial, cloned QR, expired medicine, recalled batch, suspicious location — the system catches it through an **8-layer verification engine** and alerts the regulatory authority in real time.

---

## How It Works

```
  🏭 Manufacturer                🚛 Middlemen                 💊 Pharmacy              👤 Patient
  ──────────────                ────────────                 ──────────              ─────────
  Registers product        Scans box at each           Receives box,           Scans QR code
  Generates QR serials     checkpoint (location        verifies each           on medicine
  Packs into boxes         updated, timestamped)       medicine, dispenses     Sees full journey
        │                        │                           │                        │
        └────── Ship ───────────►└────── Ship ──────────────►└──── Dispense ─────────►│
                                                                                      │
                               All monitored by 🏛️ Regulatory Authority               |
                              (alerts, analytics, batch blocking, recalls)            │
                                                                                      ▼
                                                                            ✅ GENUINE or ❌ FAKE
```

---

## Key Features

### 🔢 Unique Serial Numbers
Every individual medicine gets a unique serial in GS1 format (`2026-PFZ-ASP-0000001`) with its own QR code. Boxes also get QR codes linking to all medicines inside.

### 🚛 Supply Chain Tracking
Every middleman (wholesaler, distributor) scans the box QR at their checkpoint. Each scan creates a timestamped transaction record with actor ID and GPS coordinates. The medicine's `current_location` is updated in real time.

### 🛡️ 8-Layer Verification Engine
When anyone scans a medicine, it passes through 8 sequential security checks:

| Layer | What It Checks | What It Catches |
|-------|---------------|-----------------|
| 1 | Serial exists in database | Completely fake product |
| 2 | Not already dispensed | Cloned/photocopied QR code |
| 3 | Not destroyed or returned | Repackaged waste medicine |
| 4 | Not past expiry date | Expired medicine resale |
| 5 | Batch not under recall | Recalled batch still circulating |
| 6 | At the expected pharmacy | Diverted or stolen stock |
| 7 | Not scanned 3+ times in 1 hour | Mass-cloned QR codes (velocity attack) |
| 8 | Batch doesn't have 5+ alerts this week | Batch-level counterfeiting |

### 📷 IoT Hardware Scanner
An ESP32-CAM with OV3660 camera captures QR codes and sends JPEG frames to the backend over WiFi. The server decodes the QR, runs verification, and sends back a result. The scanner responds with:
- **Green LED + ascending beep** → Genuine medicine
- **Red LED + 3 alarm beeps** → Counterfeit / suspicious

Total hardware cost: **~₹800** (~$10)

### 👥 Role-Based Dashboards

| Role | What They Can Do |
|------|-----------------|
| **Manufacturer** | Register products, generate QR-coded serial batches, download QR PDFs |
| **Middleman** | Receive/ship boxes at checkpoints, report suspicious medicines |
| **Pharmacy** | Receive inventory, verify medicines before dispensing |
| **Regulator** | Monitor everything — manage actors, view alerts, block batches, issue recalls, see analytics |
| **Patient** | Scan QR (webcam or manual entry), see full supply chain journey with dates and cities |

### 📊 Journey Timeline
When a patient verifies their medicine, they don't just see "genuine" — they see an animated timeline:

```
🏭 Manufactured → Pfizer India Ltd, Mumbai (Jan 1, 2026) ✓
🚛 Wholesaler  → MedSupply Wholesale, Delhi (May 11, 2026) ✓
🚛 Distributor → FastTrack Distributors, Bangalore (May 13, 2026) ✓
💊 Pharmacy    → Apollo Pharmacy, Delhi (May 14, 2026) ✓
```

### 🚨 Real-Time Alerts
The verification engine auto-generates alerts for the regulatory authority whenever threats are detected. Alert types include `invalid_code`, `duplicate_scan`, `velocity_attack`, `batch_poisoning`, `geographic_anomaly`, and `middleman_report`.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL + Sequelize ORM |
| IoT Hardware | ESP32-CAM (AI Thinker) + OV3660 |
| QR Generation | `qrcode` npm package (GS1 standard) |
| QR Decoding | `jsQR` + `Jimp` (server-side) |
| Authentication | JWT + bcrypt |
| Analytics | Chart.js + react-chartjs-2 |
| Webcam Scanner | html5-qrcode |

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (running)

### Setup

```bash
# 1. Create database
psql -U postgres -c "CREATE DATABASE meditrack;"

# 2. Backend
cd backend
npm install
cp .env.example .env        # Edit with your PostgreSQL credentials
npm run seed                 # Creates tables + demo data
npm start                    # Runs on port 5000

# 3. Frontend
cd frontend
npm install
npm run dev                  # Runs on port 3000
```

### Access
- **App:** http://localhost:3000
- **Patient Verify:** http://localhost:3000/verify
- **API:** http://localhost:5000

---

## Project Structure

```
meditrack/
├── backend/                  # Node.js + Express API
│   ├── src/
│   │   ├── config/           # PostgreSQL connection
│   │   ├── models/           # 11 Sequelize models
│   │   ├── controllers/      # Request handlers
│   │   ├── services/         # Verification, serialization, QR
│   │   ├── routes/           # API route definitions
│   │   ├── middleware/       # Auth, error handling
│   │   └── seeders/          # Database seeder
│   └── .env
├── frontend/                 # React + Vite SPA
│   └── src/
│       ├── pages/            # 5 role-based dashboards
│       ├── components/       # Shared UI components
│       └── services/         # API client (Axios)
├── hardware/                 # IoT firmware
│   └── esp32_scanner/
│       └── esp32_scanner.ino # ESP32-CAM Arduino code
├── README.md                 # This file
└── DATABASE_README.md        # Detailed database documentation
```

---

## Database Overview

PostgreSQL with **11 tables** and **30+ indexes**:

- **manufacturers** — Pharma companies (Pfizer, Cipla)
- **products** — Medicine catalog (name, strength, GTIN)
- **serial_numbers** — Individual medicine units (the core table)
- **boxes** — Shipping containers grouping serials
- **box_contents** — Many-to-many mapping (box ↔ serial)
- **supply_chain_actors** — Middlemen and pharmacies
- **transactions** — Every movement event (immutable audit trail)
- **users** — Authentication with role-based access
- **verifications** — Scan audit log
- **alerts** — Auto-generated security notifications
- **recalls** — Batch recall management (uses PostgreSQL arrays)

> See [DATABASE_README.md](DATABASE_README.md) for full schema details, ER diagrams, SQL queries, and index documentation.

---

## API Highlights

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/login` | JWT authentication |
| `POST /api/manufacturer/generate` | Generate QR-coded serial batches |
| `POST /api/middleman/receive` | Scan box at checkpoint |
| `POST /api/patient/verify` | Public medicine verification |
| `POST /api/scanner/scan-image` | ESP32-CAM sends JPEG for QR decoding |
| `GET /api/regulator/dashboard` | System-wide statistics |
| `POST /api/regulator/block-batch` | Quarantine an entire batch |

---

## IoT Hardware

| Component | Pin | Purpose |
|-----------|-----|---------|
| ESP32-CAM (AI Thinker) | — | Microcontroller + WiFi |
| OV3660 Camera | — | QR code image capture |
| Green LED | GPIO 15 | Genuine medicine signal |
| Red LED | GPIO 13 | Counterfeit warning |
| Active Buzzer | GPIO 14 | Audio feedback |
| ESP32-CAM-MB (CH340C) | USB | Power + programming |

**Architecture:** ESP32 captures JPEG → sends over WiFi → backend decodes QR with jsQR → runs 8-layer verification → returns result → ESP32 controls LEDs/buzzer.

---

## Future Scope

- Blockchain integration (Hyperledger Fabric) for tamper-proof records
- Native mobile app with offline verification
- GPS map visualization of medicine journeys
- Machine learning anomaly detection
- RFID/NFC tag integration
- Cloud deployment with auto-scaling
- Integration with CDSCO (India's drug regulatory body)

