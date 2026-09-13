const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());
app.use(cors());

// Apnar BotFather theke pawa Token ekhane boshan
const TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
const chatId = 'YOUR_CHAT_ID'; // Jekhane message jabe

const bot = new TelegramBot(TOKEN, { polling: false });

const PORT = process.env.PORT || 5000;

// Website theke message powar endpoint
app.post('/send-to-bot', async (req, res) => {
  const userMessage = req.body.message;

  try {
    // Telegram bot-e message pathano
    await bot.sendMessage(chatId, `Website theke message: ${userMessage}`);
    res.json({ success: true, message: "Bot-e message chole geche!" });
  } catch (error) {
    console.res(error);
    res.status(500).json({ success: false, error: "Message pathano jayni" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
