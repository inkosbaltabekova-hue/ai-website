// api/transcribe.js — Audio transcription using Groq Whisper
// Same as voice_service.py and ai_service.py

import formidable from 'formidable'
import fs from 'fs'
import FormData from 'form-data'

export const config = {
  api: {
    bodyParser: false // Required for multipart
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' })
  }

  try {
    // Parse multipart form data
    const form = formidable({ maxFileSize: 25 * 1024 * 1024 }) // 25MB max
    const [, files] = await form.parse(req)

    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio
    if (!audioFile) {
      return res.status(400).json({ error: 'audio file required' })
    }

    // Read the audio file
    const audioBuffer = fs.readFileSync(audioFile.filepath)

    // Send to Groq Whisper (same as voice_service.py)
    const formData = new FormData()
    formData.append('file', audioBuffer, {
      filename: 'audio.webm',
      contentType: audioFile.mimetype || 'audio/webm'
    })
    formData.append('model', 'whisper-large-v3')
    formData.append('response_format', 'json')

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    })

    // Cleanup temp file
    fs.unlink(audioFile.filepath, () => {})

    if (!response.ok) {
      const err = await response.text()
      console.error('Groq whisper error:', err)
      return res.status(502).json({ error: 'Transcription service error' })
    }

    const data = await response.json()
    const text = data.text || ''

    return res.status(200).json({ text })
  } catch (err) {
    console.error('Transcribe error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
