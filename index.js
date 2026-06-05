const { getPuterResponse } = require("./puter-ai");
const { saveOrder, getMenu } = require("./order-db");
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

const msgCache = new Map();

async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: "silent" }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
            },
            markOnlineOnConnect: true
        });

        sock.ev.on("creds.update", saveCreds);

        if (!sock.authState.creds.registered) {
            console.log("\n⚠️  No active session found. Let's link your account.");
            const phoneNumber = await question("Enter your WhatsApp number (with country code, e.g., 923462809972): ");
            const code = await sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ""));
            console.log(`\n✅ YOUR PAIRING CODE: ${code}\n`);
        }

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "close") {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) setTimeout(() => startBot(), 5000);
            } else if (connection === "open") {
                console.log("\n🚀 DB RESTURANT AI IS LIVE & READY!\n");
            }
        });

        const chatMemory = new Map();

        sock.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const msgId = msg.key.id;
            const sender = msg.key.remoteJid;

            if (msgCache.has(msgId)) return;
            msgCache.set(msgId, true);
            
            if (msgCache.size > 500) {
                const firstKey = msgCache.keys().next().value;
                msgCache.delete(firstKey);
            }

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            if (!text.trim()) return;

            if (!chatMemory.has(sender)) chatMemory.set(sender, []);
            let history = chatMemory.get(sender);

            try {
                const dynamicMenu = await getMenu();
                
                // FIXED: 'text' ko direct pass kiya, history push AI response ke BAAD hogi taake duplicate context na bane
                const aiResponse = await getPuterResponse(text, history, dynamicMenu);
                
                let cleanReply = aiResponse;

                if (aiResponse.includes("FINAL_ORDER_START")) {
                    const orderBlock = aiResponse.split("FINAL_ORDER_START")[1].split("FINAL_ORDER_END")[0];
                    
                    const extract = (key) => {
                        const regex = new RegExp(`${key}:\\s*(.*)`, "i");
                        const match = orderBlock.match(regex);
                        return match ? match[1].trim() : "N/A";
                    };

                    const orderData = {
                        name: extract("Customer"),
                        phone: extract("Phone"),
                        item: extract("Items"),
                        price: parseInt(extract("Total").replace(/[^0-9]/g, "")) || 0,
                        address: extract("Address"),
                        payment: extract("Payment")
                    };

                    await saveOrder(orderData);
                    cleanReply = aiResponse.split("FINAL_ORDER_START")[0].trim();
                    
                    if (orderData.payment.toLowerCase().includes("online")) {
                        cleanReply += "\n\n💳 *Online Payment Details:*\n\n- *Bank:* NayaPay\n\n- *Number:* 03462809972\n\n- *Name:* Muhammad Noman Naeem\n\nMeherbani karke payment ke baad screenshot bhej den! ✅";
                    }
                }

                await sock.sendMessage(sender, { text: cleanReply });
                
                // AI Response send hone ke baad memory track karein
                history.push({ role: "user", content: text });
                history.push({ role: "assistant", content: aiResponse });
                
                if (history.length > 20) history.splice(0, 2);

            } catch (e) {
                console.error("Error handling message:", e.message);
            }
        });
    } catch (err) {
        console.error("Global Startup Error:", err.message);
    }
}

startBot();