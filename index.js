const { getPuterResponse } = require("./puter-ai");
const { saveOrder, getMenu, saveReport, saveHumanRequest, supabase } = require("./order-db");
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason, generateWAMessageFromContent, proto } = require("@whiskeysockets/baileys");
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

    const nativeParams = m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
    if (nativeParams) {
        try { return JSON.parse(nativeParams).id; } catch (e) {}
    }
    return "";
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

            let rawJid = msg.key.remoteJidAlt || msg.key.remoteJid || "";
            if (msg.key.participant) rawJid = msg.key.participantAlt || msg.key.participant;
            const realCustomerPhone = rawJid.split("@")[0].split(":")[0];

            const userCmd = text.trim().toLowerCase();
            const currentState = userState.get(sender);

            if (currentState === "AWAITING_REPORT") {
                const ticketNo = await saveReport(realCustomerPhone, text);
                userState.delete(sender);
                await sock.sendMessage(sender, { 
                    text: `⚠️ *Issue Registered Successfully!*\n\nAap ka Token Number: *#${ticketNo}*\n\nHamari support team aap ka masla review kar rahi hai aur jald aap se rabta karegi. Shukriya!` 
                });
                return;
            } 
            
            if (currentState === "AWAITING_HUMAN") {
                const ticketNo = await saveHumanRequest(realCustomerPhone, text);
                userState.delete(sender);
                await sock.sendMessage(sender, { 
                    text: `💬 *Support Request Created!*\n\nAap ka Ticket Number: *#${ticketNo}*\n\nHuman agent ko notify kar diya gaya hai. Hamara representative jald aap ko message karega.` 
                });
                return;
            }

            const humanTriggerKeywords = ["cmd_human", "4", "human", "insani", "contact human", "agent"];
            if (humanTriggerKeywords.some(kw => userCmd.includes(kw))) {
                userState.set(sender, "AWAITING_HUMAN");
                await sock.sendMessage(sender, { 
                    text: "💬 *Contact Human Agent*\n\nAap apna paigham ya masla yahan tafseel se likhein, hum human agent ko ticket assign kar rahe hain:" 
                });
                return;
            }

            const reportTriggerKeywords = ["cmd_report", "3", "report", "issue", "masla", "complaint"];
            if (reportTriggerKeywords.some(kw => userCmd.includes(kw))) {
                userState.set(sender, "AWAITING_REPORT");
                await sock.sendMessage(sender, { 
                    text: "📝 *Report an Issue*\n\nBaraye meherbani apne maslay ki tafseel likh kar bhejin taakay hum ticket create kar sakein:" 
                });
                return;
            }

            // GREETING WITH 4 OPTIONS
            if (["hi", "hello", "hey", "start", "assalam-o-alaikum", "assalam o alaikum"].includes(userCmd)) {
                const msgContent = generateWAMessageFromContent(sender, {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: proto.Message.InteractiveMessage.create({
                                body: proto.Message.InteractiveMessage.Body.create({
                                    text: "Welcome to *Suleman Digital Store* 🛒✨\n\nMain aap ki kis tarah rehnumai kar sakta hoon? Niche diye gaye options mein se chunain:"
                                }),
                                footer: proto.Message.InteractiveMessage.Footer.create({ text: "Select an option below" }),
                                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                    buttons: [
                                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🛒 Services / Subscriptions", id: "cmd_buy_sub" }) },
                                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🔥 Special Offers / Discounts", id: "cmd_offers" }) },
                                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "⚠️ Report an Issue", id: "cmd_report" }) },
                                        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "📞 Contact Human Agent", id: "cmd_human" }) }
                                    ]
                                })
                            })
                        }
                    }
                }, { userJid: sender, quoted: msg });

                await sock.relayMessage(sender, msgContent.message, { messageId: msgContent.key.id });
                return;
            }

            // AI Flow Response
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

                    const orderData = {
                        name: extract("Customer"),
                        phone: realCustomerPhone,
                        item: extract("Items"),
                        price: parseInt(extract("Total").replace(/[^0-9]/g, "")) || 0
                    };

                    await saveOrder(orderData);
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