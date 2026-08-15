const { getPuterResponse } = require("./puter-ai");
const { saveOrder, getMenu, saveReport, saveHumanRequest, supabase } = require("./order-db");
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const processedMsgs = new Set();
const userState = new Map(); 
let sock;

app.get("/", (req, res) => res.send("Bot & Server Active!"));
app.listen(PORT, () => console.log(`🤖 Server listening on port ${PORT}`));

function extractMessageText(m) {
    if (!m) return "";
    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
    if (m.buttonsResponseMessage?.selectedButtonId) return m.buttonsResponseMessage.selectedButtonId;
    if (m.listResponseMessage?.singleSelectReply?.selectedRowId) return m.listResponseMessage.singleSelectReply.selectedRowId;
    return "";
}

function extractRealPhoneNumber(msg) {
    const rawCandidates = [
        msg.key.remoteJidAlt,
        msg.key.participantAlt,
        msg.participant,
        msg.key.remoteJid,
        msg.key.participant
    ];

    for (const jid of rawCandidates) {
        if (jid && typeof jid === 'string' && jid.includes('@s.whatsapp.net')) {
            return jid.split('@')[0].split(':')[0];
        }
    }

    const firstValid = rawCandidates.find(j => j && typeof j === 'string');
    return firstValid ? firstValid.split('@')[0].split(':')[0] : "Customer";
}

async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            logger: pino({ level: "silent" }),
            printQRInTerminal: false,
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) },
            markOnlineOnConnect: true,
            syncFullHistory: false,
            retryRequestDelayMs: 250
        });

        sock.ev.on("creds.update", saveCreds);

        if (!sock.authState.creds.registered) {
            const rawPhoneNumber = process.env.WHATSAPP_NUMBER || "923462809972"; 
            const phoneNumber = rawPhoneNumber.replace(/[^0-9]/g, "");

            if (phoneNumber) {
                setTimeout(async () => {
                    try {
                        const code = await sock.requestPairingCode(phoneNumber);
                        console.log(`\n✅ YOUR WHATSAPP PAIRING CODE: ${code}\n`);
                    } catch (pairingError) {
                        console.error("❌ Error generating pairing code:", pairingError.message);
                    }
                }, 10000);
            }
        }

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "close") {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) setTimeout(() => startBot(), 5000);
            } else if (connection === "open") {
                console.log("\n🚀 SULEMAN DIGITAL STORE BOT IS LIVE!\n");
            }
        });

        const chatMemory = new Map();

        sock.ev.on("messages.upsert", async ({ messages, type }) => {
            if (type !== "notify") return;
            const msg = messages[0];
            if (!msg || !msg.message || msg.key.fromMe) return;

            const sender = msg.key.remoteJid;
            if (sender.endsWith("@g.us") || sender.endsWith("@newsletter") || sender.includes("status@broadcast")) return;

            const msgId = msg.key.id;
            if (processedMsgs.has(msgId)) return;
            processedMsgs.add(msgId);
            if (processedMsgs.size > 1000) processedMsgs.clear();

            const text = extractMessageText(msg.message);
            if (!text.trim()) return;

            const realCustomerPhone = extractRealPhoneNumber(msg);
            const userCmd = text.trim().toLowerCase();
            const currentState = userState.get(sender);

            // 🛑 PRIORITY 1: Report Input State
            if (currentState === "AWAITING_REPORT") {
                const ticketNo = await saveReport(realCustomerPhone, text);
                userState.delete(sender);
                await sock.sendMessage(sender, { 
                    text: `⚠️ *Issue Registered Successfully!*\n\nAap ka Token Number: *#${ticketNo}*\n\nHamari support team aap ka masla review kar rahi hai aur jald aap se rabta karegi. Shukriya! 🌟` 
                });
                return;
            } 
            
            // 🛑 PRIORITY 2: Human Support Input State
            if (currentState === "AWAITING_HUMAN") {
                const ticketNo = await saveHumanRequest(realCustomerPhone, text);
                userState.delete(sender);
                await sock.sendMessage(sender, { 
                    text: `💬 *Support Request Created!*\n\nAap ka Ticket Number: *#${ticketNo}*\n\nHuman agent ko notify kar diya gaya hai. Hamara representative jald aap ko message karega. Shukriya! 🌟` 
                });
                return;
            }

            if (["cmd_human", "3", "human", "insani", "contact human", "agent"].includes(userCmd)) {
                userState.set(sender, "AWAITING_HUMAN");
                await sock.sendMessage(sender, { 
                    text: "💬 *Contact Human Agent*\n\nAap apna paigham ya masla yahan tafseel se likhein, hum human agent ko ticket assign kar rahe hain: 👇" 
                });
                return;
            }

            if (["cmd_report", "2", "report", "issue", "masla", "complaint"].includes(userCmd)) {
                userState.set(sender, "AWAITING_REPORT");
                await sock.sendMessage(sender, { 
                    text: "📝 *Report an Issue*\n\nBaraye meherbani apne maslay ki tafseel likh kar bhejin taakay hum ticket create kar sakein: 👇" 
                });
                return;
            }

            // ⚡ AI Pipeline with Instant Order Save
            try {
                if (!chatMemory.has(sender)) chatMemory.set(sender, []);
                let history = chatMemory.get(sender);

                const dynamicMenu = await getMenu();
                const aiResponse = await getPuterResponse(text, history, dynamicMenu);
                let cleanReply = aiResponse;

                if (aiResponse.includes("FINAL_ORDER_START")) {
                    const orderBlock = aiResponse.split("FINAL_ORDER_START")[1].split("FINAL_ORDER_END")[0];
                    const extract = (key) => {
                        const match = orderBlock.match(new RegExp(`${key}:\\s*(.*)`, "i"));
                        return match ? match[1].trim() : "N/A";
                    };

                    const rawPrice = extract("Total");
                    const parsedPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, "")) || 0;

                    const orderData = {
                        name: extract("Customer"),
                        phone: realCustomerPhone,
                        item: extract("Items"),
                        price: parsedPrice
                    };

                    const saved = await saveOrder(orderData);
                    if (saved) {
                        console.log(`📦 ORDER SAVED: #${saved.id} - ${orderData.item} (${orderData.phone})`);
                    }

                    cleanReply = aiResponse.split("FINAL_ORDER_START")[0].trim();
                }

                await sock.sendMessage(sender, { text: cleanReply });

                history.push({ role: "user", content: text }, { role: "assistant", content: aiResponse });
                if (history.length > 20) history.splice(0, 2);

            } catch (e) {
                console.error("Error handling message:", e.message);
            }
        });
    } catch (err) {
        console.error("Startup Error:", err.message);
    }
}

startBot();