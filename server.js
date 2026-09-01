require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.urlencoded({ extended: false }));

const SYSTEM_PROMPT = `You are the WhatsApp assistant for Sunrise Dental Clinic.

Rules:
- Only answer using the clinic info below. Never invent hours, prices, or policies.
- Keep replies short - 1 to 3 sentences, like a real front-desk person texting.
- If asked something not covered below, say you're not sure and offer to have the front desk call back.
- If the user wants to book, collect their name, phone number, and preferred day/time across the conversation.
- Never mention you are an AI model or name any AI company.

Clinic info:
Hours: Mon-Fri 9am-7pm, Sat 10am-4pm, closed Sunday.
Location: 14 Lakeview Road, Bhubaneswar.
Services: General checkups (₹800), teeth whitening (from ₹4,500), emergency care, kids' dentistry.
Dentists: Dr. Rao (general), Dr. Mehta (pediatric).
Insurance: Accepts Star Health, HDFC Ergo, ICICI Lombard, Niva Bupa.`;

// NEW: stores each person's conversation, keyed by their WhatsApp number
// Note: this resets if the server restarts - fine for now, a real DB comes later
const conversations = new Map();

app.post('/whatsapp', async (req, res) => {
  const userMessage = req.body.Body;
  const fromNumber = req.body.From;
  console.log(`Message from ${fromNumber}: ${userMessage}`);

  // NEW: get this person's existing history, or start a new one
  if (!conversations.has(fromNumber)) {
    conversations.set(fromNumber, []);
  }
  const history = conversations.get(fromNumber);

  // NEW: add their new message to the history
  history.push({ role: 'user', content: userMessage });

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
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: history   // CHANGED: send the whole conversation, not just one message
      })
    });

    const data = await response.json();
    const reply = data.content?.[0]?.text || "Sorry, could you rephrase that?";

    // NEW: save the bot's reply into history too, so it remembers what it said
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