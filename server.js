const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());
app.use(cors());

const TOKEN = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;

const bot = new TelegramBot(TOKEN, { polling: false });

const PORT = process.env.PORT || 5000;

app.post('/send-to-bot', async (req, res) => {
  const userMessage = req.body.message;

  try {
    await bot.sendMessage(chatId, `Website theke message: ${userMessage}`);
    res.json({ success: true, message: "Bot-e message chole geche!" });
  } catch (error) {
    console.error(error); // Ekhane console.error hobe
    res.status(500).json({ success: false, error: "Message pathano jayni" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
