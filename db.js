const mysql = require("mysql2/promise");
require("dotenv").config();

// Using a Pool is better for long-running bots to prevent connection timeouts
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "Adil.5454", // Change this to your Workbench password
    database: "restaurant_bot",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

module.exports = db;
