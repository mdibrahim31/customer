const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(cors());

const TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

// Render PostgreSQL connection pool setup
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Render PostgreSQL-er jonno SSL connection lagbe
  }
});

const bot = new TelegramBot(TOKEN, { polling: true });
const PORT = process.env.PORT || 5000;

// Server start hole automatic table create korar function
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS menus (
        id SERIAL PRIMARY KEY,
        item_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Database & 'menus' table ready successfully!");
  } catch (err) {
    console.error("Table creation error:", err.message);
  }
}

// Telegram Bot Listener: Vendor bot-e kichu pathalei database-e save hobe
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const menuText = msg.text;

  if (menuText === '/start') {
    bot.sendMessage(chatId, "Welcome! Menu item ekhane pathan.");
    return;
  }

  try {
    await pool.query(
      'INSERT INTO menus (item_name) VALUES ($1)',
      [menuText]
    );
    bot.sendMessage(chatId, `Saved to Database: "${menuText}"`);
  } catch (err) {
    console.error("Insert error:", err.message);
    bot.sendMessage(chatId, "Database-e save korte somoshsha hoyeche.");
  }
});

// Website API Endpoint: Database theke menu fetch korbe
app.get('/get-menu', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM menus ORDER BY created_at DESC');
    res.json({ success: true, menu: result.rows });
  } catch (err) {
    console.error("Fetch error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await initDB();
});
