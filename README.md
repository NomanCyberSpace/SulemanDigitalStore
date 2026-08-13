# 🛒 Digital Subscriptions WhatsApp Bot & Admin Dashboard

An automated WhatsApp bot for selling digital subscriptions (Netflix, Canva, Spotify, etc.) integrated with a real-time **Supabase** database and a lightweight **React Admin Dashboard**.

---

## 🌟 Key Features

### 🤖 WhatsApp Bot
* **Automated Product Catalog:** Fetches live stock and subscription prices directly from Supabase.
* **Smart AI Conversations:** Handles customer queries using Puter AI.
* **Order Processing:** Captures customer phone numbers, selected items, and logs pending orders automatically.
* **Payment Instructions:** Binds payment details (NayaPay / Bank Transfer) directly into the chat.
* **24/7 Cloud Support:** Built-in self-ping web server to prevent cloud hosts (e.g., Render) from sleeping.

### 📊 Admin Dashboard
* **Secure Access:** Protected with a custom PIN/Passcode.
* **Live Inventory Management:** Add new digital products, edit pricing, or update stock quantities in real time.
* **Order Tracker:** View incoming WhatsApp orders and update status (`Pending`, `Paid`, `Delivered`).
* **Zero Complex Setup:** Single-file standalone HTML/React application (hostable on Vercel/Netlify/GitHub Pages).

---

## 🛠️ Tech Stack

* **Bot Core:** Node.js, `@whiskeysockets/baileys`
* **Database:** Supabase (PostgreSQL)
* **AI Engine:** Puter AI Integration
* **Dashboard:** React, Tailwind CSS, Supabase JS Client

---

## 🚀 Setup & Installation

### 1. Database Setup (Supabase)
1. Create a project at [Supabase](https://supabase.com).
2. Go to **SQL Editor** and execute the following queries to create the tables:

```sql
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    customer_phone VARCHAR(50) NOT NULL,
    product_name VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);