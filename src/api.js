// Direct API calls from frontend
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || ''
const REPLICATE_TOKEN = import.meta.env.VITE_REPLICATE_API_TOKEN || ''

// ── CHAT ────────────────────────────────────────────────────
export async function chatGroq(messages) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Сен жоғары деңгейлі AI ассистентсің. Пайдаланушы қай тілде жазса, сол тілде жауап бер. Қазақша жазса қазақша, орысша орысша, ағылшынша ағылшынша. Жауаптарың нақты, сауатты болсын. Markdown қолдан.'
        },
        ...messages
      ],
      max_tokens: 2048,
      temperature: 0.7
    })
  })
  if (!res.ok) throw new Error('Groq API error: ' + res.status)
  const data = await res.json()
  return data.choices[0].message.content
}

// ── WHISPER АУДИО ────────────────────────────────────────────
export async function transcribeGroq(audioBlob) {
  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.webm')
  formData.append('model', 'whisper-large-v3')
  formData.append('response_format', 'json')
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: formData
  })
  if (!res.ok) throw new Error('Whisper error: ' + res.status)
  const data = await res.json()
  return data.text
}

// ── VISION ФОТО ТАЛДАУ ───────────────────────────────────────
export async function analyzeImageGroq(base64, prompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          { type: 'text', text: prompt || 'Суреттегі барлық мәтінді оқып бер. Егер мәтін жоқ болса, суретті толық сипатта.' }
        ]
      }],
      max_tokens: 2048
    })
  })
  if (!res.ok) throw new Error('Vision error: ' + res.status)
  const data = await res.json()
  return data.choices[0].message.content
}

// ── АУА РАЙЫ ─────────────────────────────────────────────────
export async function getWeather(city) {
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
  )
  const geoData = await geoRes.json()
  if (!geoData.results?.length) throw new Error('Қала табылмады: ' + city)

  const { latitude, longitude, name, country, timezone } = geoData.results[0]
  const wRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature` +
    `&timezone=${encodeURIComponent(timezone || 'auto')}&forecast_days=1`
  )
  const wData = await wRes.json()
  const c = wData.current

  const descriptions = {
    0:'Ашық аспан', 1:'Негізінен ашық', 2:'Бөлшек бұлтты', 3:'Бұлтты',
    45:'Тұманды', 51:'Жеңіл жаңбыр', 53:'Жаңбыр', 61:'Жаңбыр',
    63:'Орташа жаңбыр', 71:'Жеңіл қар', 73:'Қар', 80:'Жаңбыр', 95:'Найзағайлы'
  }
  const emojis = {
    0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️', 45:'🌫️', 51:'🌦️',
    53:'🌧️', 61:'🌧️', 63:'🌧️', 71:'🌨️', 73:'❄️', 80:'🌦️', 95:'⛈️'
  }
  const code = c.weather_code
  const localTime = new Date().toLocaleTimeString('en-US', {
    timeZone: timezone || 'UTC', hour: '2-digit', minute: '2-digit', hour12: false
  })

  return {
    city: `${emojis[code] || '🌡️'} ${name}, ${country}`,
    temperature: Math.round(c.temperature_2m),
    feelsLike: Math.round(c.apparent_temperature),
    humidity: c.relative_humidity_2m,
    windspeed: Math.round(c.wind_speed_10m),
    description: descriptions[code] || 'Белгісіз',
    localTime
  }
}

// ── ФОТО ГЕНЕРАЦИЯ (Replicate FLUX) ──────────────────────────
export async function generateImage(prompt) {
  if (!REPLICATE_TOKEN) throw new Error('VITE_REPLICATE_API_TOKEN .env.local файлында жоқ!')

  // 1. Prediction жасау
  const createRes = await fetch(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${REPLICATE_TOKEN}`
      },
      body: JSON.stringify({
        input: { prompt, num_outputs: 1, output_format: 'webp', output_quality: 80 }
      })
    }
  )
  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Replicate қатесі: ${createRes.status} — ${err}`)
  }

  const prediction = await createRes.json()

  // 2. Нәтижені күту (polling)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const pollRes = await fetch(
      `https://api.replicate.com/v1/predictions/${prediction.id}`,
      { headers: { 'Authorization': `Token ${REPLICATE_TOKEN}` } }
    )
    const result = await pollRes.json()
    if (result.status === 'succeeded') return result.output[0]
    if (result.status === 'failed') throw new Error('Сурет жасау сәтсіз: ' + result.error)
  }
  throw new Error('Уақыт шегі өтті — қайта көріңіз')
}
