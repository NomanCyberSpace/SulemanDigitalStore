const db = require("./db");

async function getMenu() {
    try {
        // Assuming 'menu' table has 'item_name', 'price', 'category', and 'is_available'
        const [rows] = await db.execute("SELECT item_name, price, category FROM menu WHERE is_available = 1 ORDER BY category");
        
        if (rows.length === 0) {
            return "No items available in the menu right now.";
        }

        let menuText = "";
        let currentCategory = "";

        rows.forEach(item => {
            if (item.category !== currentCategory) {
                currentCategory = item.category;
                menuText += `\n--- 🍟 *${currentCategory.toUpperCase()}* ---\n\n`;
            }
            menuText += `• **${item.item_name}** - Rs. ${item.price}\n\n`;
        });

        return menuText;
    } catch (error) {
        console.error("❌ Database Menu Error:", error.message);
        // Professional fallback if DB is empty or table missing
        return "1. Zinger Burger - Rs. 450\n2. Chicken Pizza - Rs. 800\n3. Club Sandwich - Rs. 350\n4. Cold Drink - Rs. 100";
    }
}

async function saveOrder(orderData) {
    try {
        const query = `
            INSERT INTO orders 
            (customer_name, customer_phone, customer_address, item_name, quantity, total_price, payment_method, order_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        
        const values = [
            String(orderData.name || "N/A"),
            String(orderData.phone || "N/A"),
            String(orderData.address || "N/A"),
            String(orderData.item || "N/A"),
            Number(orderData.quantity || 1),
            Number(orderData.price || 0),
            String(orderData.payment || "COD")
        ];

        await db.execute(query, values);
        console.log("✅ Order saved to Database!");
        return true;
    } catch (error) {
        console.error("❌ Database Save Error:", error.message);
        return false;
    }
}

module.exports = { getMenu, saveOrder };
