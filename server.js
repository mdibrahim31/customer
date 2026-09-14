const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(cors());

const TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const bot = new TelegramBot(TOKEN, { polling: true });
const PORT = process.env.PORT || 5000;

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const menuText = msg.text;

  if (!menuText) {
    bot.sendMessage(chatId, "Doy kore kono text ba menu item likhe pathan.");
    return;
  }

  if (menuText === '/start') {
    bot.sendMessage(chatId, "Welcome! Menu item ekhane pathan.");
    return;
  }

  try {
    const { error } = await supabase
      .from('menus')
      .insert([{ item_name: menuText }]);

    if (error) throw error;
    bot.sendMessage(chatId, `Saved to Supabase: "${menuText}"`);
  } catch (err) {
    console.error("Insert error:", err.message);
    bot.sendMessage(chatId, `Supabase error: ${err.message}`);
  }
});

app.get('/get-menu', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('menus')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;
        res.json({ success: true, menu: data });
    } catch (err) {
        console.error("Fetch error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
