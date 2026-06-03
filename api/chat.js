// api/chat.js — Vercel Serverless Function
// Uses Groq API with llama-3.3-70b model (same as Telegram bot)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { messages } = req.body
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' })
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' })
  }

  try {
    // Build messages with system prompt (same logic as ai_service.py)
    const systemMessage = {
      role: 'system',
      content: `Сен жоғары деңгейлі AI ассистентсің. 
Пайдаланушы қай тілде жазса, сол тілде жауап бер.
Қазақша жазса — қазақша, орысша — орысша, ағылшынша — ағылшынша, 
кез келген басқа тілде жазса — сол тілде жауап бер.
Жауаптарың нақты, сауатты, жоғары деңгейде болсын.
Markdown форматтауды қолдан: **қалың**, *курсив*, \`код\`, тізімдер.
Ауа-райы туралы сұрақта қала атауын шығарып бер: FORMAT: WEATHER_CITY:<city_name>`
    }

    // Keep last 20 messages max (same as bot)
    let chatMessages = messages.slice(-20)

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [systemMessage, ...chatMessages],
        max_tokens: 2048,
        temperature: 0.7,
        stream: false
      })
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Groq error:', err)
      return res.status(502).json({ error: 'AI service error' })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ content })
  } catch (err) {
    console.error('Chat handler error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
