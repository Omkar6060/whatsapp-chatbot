require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

const SYSTEM_PROMPT = `You are a helpful, knowledgeable assistant.
Keep replies reasonably concise - break up longer explanations into short paragraphs.
Be direct and substantive, like a capable colleague, not overly formal.`;

const conversations = new Map();
const MAX_HISTORY_MESSAGES = 20;

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text;
  console.log(`Message from ${chatId}: ${userMessage}`);

  if (!conversations.has(chatId)) {
    conversations.set(chatId, []);
  }
  const history = conversations.get(chatId);
  history.push({ role: 'user', content: userMessage });

  if (history.length > MAX_HISTORY_MESSAGES) {
    history.splice(0, history.length - MAX_HISTORY_MESSAGES);
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: history
      })
    });

    const data = await response.json();
    const reply = data.content?.[0]?.text || "Sorry, could you rephrase that?";

    history.push({ role: 'assistant', content: reply });
    bot.sendMessage(chatId, reply);

  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "Sorry, something went wrong. Please try again.");
  }
});

console.log('Telegram bot running...');