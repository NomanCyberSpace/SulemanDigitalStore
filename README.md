# Restaurant WhatsApp Bot

A WhatsApp bot for DB Restaurant using Baileys, MySQL, and Gemini AI.

## Features
- Automated WhatsApp responses.
- MySQL integration for menu and order management.
- Gemini AI for natural language customer support.
- Pairing code connection (no QR scan needed if preferred).

## Setup Instructions

### 1. Prerequisites
- Node.js installed.
- MySQL Workbench installed and running.
- Gemini API Key from [Google AI Studio](https://aistudio.google.com/).

### 2. Database Setup
1. Open MySQL Workbench.
2. Run the commands in `schema.sql` to create the database and tables.

### 3. Configuration
1. Rename `.env.example` to `.env`.
2. Fill in your credentials:
   - `GEMINI_API_KEY`: Your Google Gemini API Key.
   - `DB_PASSWORD`: Your MySQL password.
   - `OWNER_NUMBER`: Your WhatsApp number in international format (e.g., `923462809972`).

### 4. Installation
```bash
pnpm install
# OR
npm install
```

### 5. Running the Bot
```bash
node index.js
```
- The bot will provide a **Pairing Code**.
- Enter this code in your WhatsApp: `Settings > Linked Devices > Link a Device > Link with phone number instead`.

## Project Structure
- `index.js`: Main bot logic and WhatsApp connection.
- `db.js`: MySQL connection pool.
- `gemini.js`: Gemini AI integration.
- `restaurant-ai.js`: AI prompt engineering for the restaurant.
- `restaurant-info.js`: Static restaurant data (menu, timing, etc.).
- `schema.sql`: Database structure.
- `test-*.js`: Scripts to test individual components.
