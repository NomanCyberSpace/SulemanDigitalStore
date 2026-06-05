const mysql = require("mysql2/promise");
require("dotenv").config();

// Cloud Database configuration with environment variables or fallback to Aiven defaults
const db = mysql.createPool({
    host: process.env.DB_HOST || "mysql-1afe6f08-resturantbot.g.aivencloud.com",
    user: process.env.DB_USER || "avnadmin",
    password: process.env.DB_PASSWORD || "AVNS_XbEYcyweZdnYYxXXRHE", // ⚠️ Yahan apna Aiven wala real password paste kar den
    database: process.env.DB_NAME || "defaultdb",
    port: process.env.DB_PORT || 10775,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    ssl: {
        rejectUnauthorized: false // Aiven cloud connections ke liye SSL zaroori hota hai
    }
});

module.exports = db;