require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.urlencoded({ extended: false }));

// General-purpose assistant, not tied to any one business
const SYSTEM_PROMPT = `You are a helpful, knowledgeable assistant reachable over WhatsApp.
Keep replies reasonably concise since this is a chat interface - break up longer explanations
into short paragraphs rather than one big wall of text. Be direct and substantive, like a
capable colleague, not overly formal.`;

const conversations = new Map();

// Optional: keep conversations from growing forever (controls cost + speed)
const MAX_HISTORY_MESSAGES = 20;

app.post('/whatsapp', async (req, res) => {
  const userMessage = req.body.Body;
  const fromNumber = req.body.From;
  console.log(`Message from ${fromNumber}: ${userMessage}`);

  if (!conversations.has(fromNumber)) {
    conversations.set(fromNumber, []);
  }
  const history = conversations.get(fromNumber);

  history.push({ role: 'user', content: userMessage });

  // NEW: trim old messages so history doesn't grow unbounded
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
        max_tokens: 800,   // CHANGED: higher, since research answers can run longer than a front-desk reply
        system: SYSTEM_PROMPT,
        messages: history
      })
    });

    const data = await response.json();
    let reply = data.content?.[0]?.text || "Sorry, could you rephrase that?";

    // NEW: WhatsApp messages have a length limit - truncate safely if a reply is huge
    if (reply.length > 1500) {
      reply = reply.slice(0, 1450) + "\n\n[Reply truncated - ask me to continue]";
    }

    history.push({ role: 'assistant', content: reply });

    res.set('Content-Type', 'text/xml');
    res.send(`<Response><Message>${reply}</Message></Response>`);

  } catch (err) {
    console.error(err);
    res.set('Content-Type', 'text/xml');
    res.send(`<Response><Message>Sorry, something went wrong. Please try again.</Message></Response>`);
  }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));