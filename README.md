<div align="center">

# 🌾 FarmFresh

### Farm to Table. Directly.

*A full-stack marketplace connecting farmers and consumers directly — eliminating middlemen, unfair markups, and unnecessary bureaucracy from India's produce supply chain.*

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

FarmFresh is a two-sided marketplace with distinct, purpose-built experiences for **Farmers** and **Consumers** — built as a real product, not a toy demo. Every feature below is fully functional, tested, and running on a live database.

| For Farmers 🚜 | For Consumers 🛒 |
|---|---|
| List produce with photos, price, and quantity in seconds | Browse fresh produce from verified local farmers |
| Track every incoming order in real time | Order directly, with live stock validation |
| Update order status: Placed → Confirmed → Delivered | Simulated secure checkout experience |
| Edit or delete listings (with safety checks) | View complete order history |
| See which produce is trending based on real demand | Discover trending produce automatically |

---

## 🧠 Engineering Highlights

This isn't just CRUD wrapped in a UI. A few specific decisions were made deliberately to reflect real-world production concerns:

### 1. Atomic Stock Management (Race Condition Safety)
The single hardest problem in any marketplace: **what happens when two consumers try to buy the last few kilograms of the same produce at the same time?**

A naive implementation (read stock → check quantity → subtract → save) is vulnerable to a race condition where both orders could succeed, overselling the farmer's stock. FarmFresh solves this using a single **atomic MongoDB operation**:

```javascript
const produce = await Produce.findOneAndUpdate(
  { _id: produceId, quantityAvailable: { $gte: quantity } },
  { $inc: { quantityAvailable: -quantity } },
  { new: true }
);
```

This guarantees the stock check and the decrement happen as **one indivisible database operation** — it is architecturally impossible to oversell, even under concurrent load, without needing external locks or transactions.

### 2. Real Demand-Based Trending Signal
Rather than hardcoding a "featured" flag, trending status is computed live from actual order data — a MongoDB aggregation pipeline counts orders per produce item over the last 7 days, and items crossing a threshold are flagged as trending. This is a genuine (if simplified) demand-signal system, the same category of logic that powers "popular near you" features in production marketplaces.

### 3. Referential Integrity on Deletion
Farmers cannot delete a produce listing that has active (non-delivered) orders attached to it — preventing orphaned order records and protecting consumers mid-transaction. This is a small detail, but it's the difference between a project that "works in the happy path" and one that's been thought through for real usage.

### 4. Role-Based Access Control, Enforced Server-Side
Every farmer-only and consumer-only action is protected by middleware at the API layer — not just hidden in the UI. A consumer cannot call the "create produce" endpoint even by bypassing the frontend entirely, because the JWT payload's role is verified on every protected request.

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

**User** — `name, email, password (hashed), role [farmer|consumer], location`

**Produce** — `farmerId (ref), name, category, pricePerKg, quantityAvailable, imageUrl, location`

**Order** — `consumerId (ref), produceId (ref), farmerId (ref), quantity, totalPrice, status [placed|confirmed|delivered]`

---

## 🔌 API Reference

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create a new account |
| POST | `/api/auth/login` | Public | Authenticate and receive JWT |
| GET | `/api/produce` | Public | Browse all produce (with trending signal) |
| POST | `/api/produce` | Farmer | Create a new listing (with image) |
| GET | `/api/produce/mine` | Farmer | View own listings |
| PUT | `/api/produce/:id` | Farmer | Edit own listing |
| DELETE | `/api/produce/:id` | Farmer | Delete listing (blocked if active orders exist) |
| POST | `/api/orders` | Consumer | Place an order (atomic stock decrement) |
| GET | `/api/orders/mine` | Consumer | View own order history |
| GET | `/api/orders/received` | Farmer | View incoming orders |
| PUT | `/api/orders/:id/status` | Farmer | Update order status |


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