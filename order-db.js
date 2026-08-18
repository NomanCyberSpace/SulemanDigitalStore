const WebSocket = require("ws");
global.WebSocket = WebSocket;

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://kvcqsmqqcmlbgrtgoeca.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2Y3FzbXFxY21sYmdydGdvZWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTMwMTksImV4cCI6MjEwMTU4OTAxOX0.BzNIMNu1LhEGAuvm8Wq1ka9hm-n6yq7VNjrO6m2vgdE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getMenu() {
    try {
        const { data: products, error } = await supabase
            .from("products")
            .select("*")
            .gt("stock", 0);

        if (error || !products || products.length === 0) {
            return "Currently no digital subscriptions are in stock.";
        }

        return products
            .map((p) => {
                let priceText = `Rs. ${p.price}`;
                if (p.discount_percent && p.discount_percent > 0) {
                    const discounted = Math.round(p.price - (p.price * p.discount_percent / 100));
                    priceText = `Original: Rs. ${p.price} | 🔥 DISCOUNTED: Rs. ${discounted} (${p.discount_percent}% OFF)`;
                }
                return `• ID ${p.id}: ${p.name} - ${priceText} (Stock: ${p.stock}) | ${p.description || ''}`;
            })
            .join("\n");
    } catch (e) {
        console.error("Error fetching menu:", e.message);
        return "Error loading subscriptions.";
    }
}

async function saveOrder(orderData) {
    try {
        // Find highest existing order ID for continuous counting
        let nextOrderId = 1;
        const { data: lastOrder } = await supabase
            .from("orders")
            .select("id")
            .order("id", { ascending: false })
            .limit(1);

        if (lastOrder && lastOrder.length > 0 && typeof lastOrder[0].id === "number") {
            nextOrderId = lastOrder[0].id + 1;
        }

        const insertPayload = {
            id: nextOrderId,
            customer_phone: String(orderData.phone || orderData.name || "Customer"),
            product_name: orderData.item || "Digital Product",
            amount: Number(orderData.price) || 0,
            payment_status: "pending",
            created_at: new Date().toISOString()
        };

        let { data, error } = await supabase.from("orders").insert([insertPayload]).select().single();

        // Fallback without manual ID if Supabase sequence handles it strictly
        if (error) {
            console.warn("⚠️ Retrying order insert with auto-generated ID:", error.message);
            delete insertPayload.id;
            const retry = await supabase.from("orders").insert([insertPayload]).select().single();
            data = retry.data;
            error = retry.error;
        }

        if (error) {
            console.error("❌ Supabase Save Order Error:", error.message);
            return null;
        }

        // Deduct product stock
        if (orderData.item) {
            const { data: prods } = await supabase.from("products").select("*");
            if (prods && prods.length > 0) {
                const matchedProd = prods.find(p => 
                    orderData.item.toLowerCase().includes(p.name.toLowerCase()) || 
                    p.name.toLowerCase().includes(orderData.item.toLowerCase())
                );

                if (matchedProd && matchedProd.stock > 0) {
                    const newStock = Math.max(0, matchedProd.stock - 1);
                    await supabase
                        .from("products")
                        .update({ stock: newStock })
                        .eq("id", matchedProd.id);
                }
            }
        }
        return data;
    } catch (e) {
        console.error("❌ Order Exception:", e.message);
        return null;
    }
}

function generateToken(prefix) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${randomDigits}`;
}

async function saveReport(phone, issue) {
    try {
        const ticketNum = generateToken("REP");
        const { data, error } = await supabase.from("reports").insert([
            { ticket_number: ticketNum, customer_phone: phone, issue_details: issue, status: "Open" }
        ]).select().single();

        if (error) return ticketNum;
        return data ? data.ticket_number : ticketNum;
    } catch (e) {
        return "REP-1001";
    }
}

async function saveHumanRequest(phone, msgText, retries = 3) {
    const ticketNum = generateToken("HUM");
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const { data, error } = await supabase.from("human_contacts").insert([
                { ticket_number: ticketNum, customer_phone: phone, message: msgText, status: "Pending" }
            ]).select().single();

            if (!error) return data ? data.ticket_number : ticketNum;
        } catch (e) {
            if (attempt === retries) return ticketNum;
            await new Promise((res) => setTimeout(res, 1000));
        }
    }
}

module.exports = { supabase, getMenu, saveOrder, saveReport, saveHumanRequest };