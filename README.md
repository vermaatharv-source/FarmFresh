<div align="center">

# 🌾 FarmFresh

### Farm to Table. Directly.

*A full-stack marketplace where Farmer Producer Organizations (FPOs) manage farmers, grade produce and sell to consumers — with full traceability from farm to doorstep.*

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=JSON%20web%20tokens)

</div>

---

## 📖 The Problem

In traditional agricultural supply chains, produce typically passes through **3-5 intermediaries** before reaching a consumer — each one taking a margin. Farmers are frequently forced to sell at low, non-negotiable prices at local mandis, while consumers pay significantly inflated prices for the exact same produce.

There has never been a simple, trustworthy, and direct channel where a farmer can list what they've harvested today, and a nearby consumer can buy it — with no agent, no bureaucracy, and no opaque pricing in between.

**FarmFresh is that channel.**

---

## ✨ What It Does

FarmFresh has two purpose-built portals: an **FPO portal** and a **Consumer portal**. Farmers don't have accounts — the FPO onboards and manages them.

| For FPOs 🏢 | For Consumers 🛒 |
|---|---|
| Onboard and manage farmers (manual, CSV or Excel import) | Browse graded produce listed by FPOs |
| Record produce intake, grade batches, manage inventory | Cart, coupons and multi-item checkout |
| Publish listings from graded stock | Order tracking, cancel, return and invoices |
| Grade-based farmer payouts and reports | Subscribe & Save recurring deliveries |
| Process consumer orders end to end | Reviews, wishlist and traceability passport |

---

## 🧠 Engineering Highlights

### 1. Atomic Stock Management (Race Condition Safety)
**What happens when two consumers try to buy the last few kilograms of the same listing at the same time?**

A naive read → check → subtract → save flow can oversell. FarmFresh does the check and the decrement as **one atomic MongoDB operation**:

```javascript
const listing = await Listing.findOneAndUpdate(
  { _id: listingId, status: 'Published', availableQuantityKg: { $gte: qty } },
  { $inc: { availableQuantityKg: -qty } },
  { new: true }
);
```

### 2. Role-Based Access Control, Enforced Server-Side
FPO-only endpoints are protected by JWT + role middleware at the API layer, not just hidden in the UI.

### 3. Traceability
Every batch gets a public Digital Produce Passport (QR) linking a consumer's order back to the batch and farmer.

---

## 🛠️ Tech Stack

**Frontend**
- React 18 (Vite) — component-driven UI, fast HMR dev experience
- Tailwind CSS — utility-first styling, fully custom design (no UI library defaults)
- React Router DOM — client-side routing with role-based redirects
- Axios — centralized API layer with automatic JWT injection via interceptors

**Backend**
- Node.js + Express.js — REST API
- MongoDB + Mongoose — schema-based data modeling with relational references (`populate`)
- JSON Web Tokens (JWT) — stateless authentication
- bcrypt — one-way password hashing
- Multer — multipart image upload handling

---

## 📂 Core Data Models

**User** — `name, email, password (hashed), role [consumer|fpo_admin|fpo_staff|admin], location, addresses`

**Fpo** — profile, registration details, `adminUser`, staff

**Farmer** — FPO-managed record: `fpo (ref), name, phone, bank details, isActive, isVerified`

**Batch** — `fpo, farmer, produceType, rawQuantityKg, grading, payout status`

**Listing** — `fpo, produceType, grade, pricePerKg, availableQuantityKg, minOrderQtyKg, status [Draft|Published|Paused]`

**FpoOrder** — `fpo, listing, consumer, quantityKg, totalPrice, status`

---

## 🔌 API Reference (core)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create a consumer or FPO admin account |
| POST | `/api/auth/login` | Public | Authenticate and receive JWT |
| GET | `/api/listings/public` | Public | Browse published FPO listings |
| POST | `/api/orders/checkout` | Consumer | Multi-item checkout (atomic stock decrement) |
| POST | `/api/orders/validate-coupon` | Consumer | Validate a coupon |
| POST | `/api/fpo-orders` | Consumer | Place a single FPO order |
| GET | `/api/fpo-orders/mine` | Consumer | Own order history |
| GET/POST | `/api/fpo/farmers` | FPO | List / add farmers |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- A MongoDB Atlas connection string (free tier works)

### Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file inside `backend/`:
```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
PORT=5000
```

Run the server:
```bash
node server.js
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The app will be running at `http://localhost:5173`, connected to the API at `http://localhost:5000`.

---

## 🗺️ Future Scope

FarmFresh was built as a fully functional MVP with a clear extension path. The following were deliberately scoped out to prioritize a complete, well-tested core experience over a partially-working feature list:

- **Geospatial matching** — replace text-based location with real GPS coordinates and MongoDB `2dsphere` radius queries, so consumers only see farmers within an actual delivery distance
- **Live payment gateway** — the current checkout flow is a fully-built, realistic simulation (validation, processing state, confirmation); the next step is wiring in a live Razorpay/Stripe integration behind the same UI
- **Demand forecasting** — extend the trending-signal aggregation into a lightweight predictive model, helping farmers anticipate what to plant or stock more of
- **Real-time updates** — WebSocket-based live order notifications instead of manual refresh
- **Ratings & reviews** — trust signals between farmers and repeat consumers, closing the loop on quality accountability

---

## 👤 Author

**Atharv Verma**
B.Tech Computer Science & Engineering, SRM Institute of Science and Technology (Batch 2025–2029)

[GitHub](https://github.com/vermaatharv-source) · [LinkedIn](https://linkedin.com/in/atharvverma)

---

<div align="center">

*Built by a software engineer enthusiast as a demonstration of full-stack engineering fundamentals — authentication, data modeling, concurrency-safe operations, and production-minded design decisions.*

</div>