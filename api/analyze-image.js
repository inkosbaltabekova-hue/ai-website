// api/analyze-image.js — Image analysis using Groq Vision (llama-4-scout)
// Same vision model as ai_service.py

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { image, prompt } = req.body
  if (!image) {
    return res.status(400).json({ error: 'image (base64) required' })
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' })
  }

  try {
    const userPrompt = prompt || (
      'Суреттегі барлық мәтінді оқып бер. ' +
      'Егер мәтін жоқ болса, суретті толық сипатта. ' +
      'Жауапты пайдаланушы тілінде бер.'
    )

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${image}`
                }
              },
              {
                type: 'text',
                text: userPrompt
              }
            ]
          }
        ],
        max_tokens: 2048
      })
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Groq vision error:', err)
      return res.status(502).json({ error: 'Vision API error' })
    }

    const data = await response.json()
    const analysis = data.choices?.[0]?.message?.content || 'Талдау мүмкін болмады'

    return res.status(200).json({ analysis })
  } catch (err) {
    console.error('Analyze image error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
