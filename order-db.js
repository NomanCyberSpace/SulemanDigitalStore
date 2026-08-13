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
        const { data, error } = await supabase.from("orders").insert([
            {
                customer_phone: orderData.phone || orderData.name,
                product_name: orderData.item,
                amount: orderData.price,
                payment_status: "pending",
                created_at: new Date().toISOString()
            }
        ]).select().single();

        if (error) return null;

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