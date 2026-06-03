// api/generate-image.js — Image generation using Replicate FLUX Schnell
// Same as image_service.py in the Telegram bot

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { prompt } = req.body
  if (!prompt) {
    return res.status(400).json({ error: 'prompt required' })
  }

  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN
  const GROQ_API_KEY = process.env.GROQ_API_KEY

  if (!REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: 'REPLICATE_API_TOKEN not configured' })
  }

  try {
    // Step 1: Translate/enhance prompt to English using Groq (same as bot)
    let englishPrompt = prompt
    if (GROQ_API_KEY) {
      try {
        const translateRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              {
                role: 'system',
                content: `You are an expert at writing Stable Diffusion / FLUX image generation prompts.
The user writes in Kazakh, Russian, or English.
CRITICAL CONTEXT RULES:
- 'Алма' in Kazakh = the city 'Almaty' (Kazakhstan), NOT apple fruit.
- Proper nouns keep their meaning.
OUTPUT RULES:
1. Write ONLY in English
2. Add quality: masterpiece, best quality, ultra detailed, 8k
3. Add lighting: cinematic lighting
4. Add style: photorealistic OR digital art
5. Max 120 words
6. Return ONLY the prompt text, nothing else`
              },
              { role: 'user', content: prompt }
            ],
            max_tokens: 200,
            temperature: 0.2
          })
        })
        const translateData = await translateRes.json()
        englishPrompt = translateData.choices?.[0]?.message?.content?.trim() || prompt
      } catch (e) {
        console.warn('Translation failed, using original prompt')
      }
    }

    // Step 2: Generate image with Replicate FLUX Schnell
    const replicateRes = await fetch(
      'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait'
        },
        body: JSON.stringify({
          input: {
            prompt: englishPrompt,
            num_outputs: 1,
            num_inference_steps: 4,
            output_format: 'jpg',
            output_quality: 90,
            width: 1024,
            height: 1024
          }
        })
      }
    )

    if (!replicateRes.ok) {
      const err = await replicateRes.text()
      console.error('Replicate error:', err)
      return res.status(502).json({ error: 'Image generation service error' })
    }

    const data = await replicateRes.json()

    // Handle immediate response (Prefer: wait)
    if (data.status === 'succeeded') {
      const output = data.output
      const imageUrl = Array.isArray(output) ? output[0] : output
      return res.status(200).json({ imageUrl, englishPrompt })
    }

    // Handle async polling
    const predId = data.id
    if (!predId) {
      return res.status(502).json({ error: 'No prediction ID returned' })
    }

    // Poll for result (max 40 attempts, 3s each = 2 min)
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const pollRes = await fetch(
        `https://api.replicate.com/v1/predictions/${predId}`,
        { headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` } }
      )
      const pollData = await pollRes.json()

      if (pollData.status === 'succeeded') {
        const output = pollData.output
        const imageUrl = Array.isArray(output) ? output[0] : output
        return res.status(200).json({ imageUrl, englishPrompt })
      }

      if (pollData.status === 'failed') {
        return res.status(500).json({ error: 'Image generation failed' })
      }
    }

    return res.status(504).json({ error: 'Image generation timed out' })
  } catch (err) {
    console.error('Generate image error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
