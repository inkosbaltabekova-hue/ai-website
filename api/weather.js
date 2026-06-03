// api/weather.js — Real-time weather using Open-Meteo (free, no API key needed)
// + Geocoding to get lat/lon from city name

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { city } = req.query
  if (!city) {
    return res.status(400).json({ error: 'city parameter required' })
  }

  try {
    // Step 1: Geocode city name to lat/lon (Open-Meteo Geocoding)
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    )
    const geoData = await geoRes.json()

    if (!geoData.results || geoData.results.length === 0) {
      return res.status(404).json({ error: `City not found: ${city}` })
    }

    const place = geoData.results[0]
    const { latitude, longitude, name, country, timezone } = place

    // Step 2: Get weather data
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature` +
      `&timezone=${encodeURIComponent(timezone || 'auto')}` +
      `&forecast_days=1`
    )
    const weatherData = await weatherRes.json()
    const current = weatherData.current

    // Step 3: Get local time
    const localTime = new Date().toLocaleTimeString('en-US', {
      timeZone: timezone || 'UTC',
      hour: '2-digit', minute: '2-digit', hour12: false
    })

    // WMO weather code to description
    const weatherDescriptions = {
      0: 'Ашық аспан', 1: 'Негізінен ашық', 2: 'Бөлшек бұлтты', 3: 'Бұлтты',
      45: 'Тұманды', 48: 'Ылғалды тұман',
      51: 'Жеңіл жаңбыр', 53: 'Жаңбыр', 55: 'Күшті жаңбыр',
      61: 'Жаңбыр', 63: 'Орташа жаңбыр', 65: 'Күшті жаңбыр',
      71: 'Жеңіл қар', 73: 'Қар', 75: 'Күшті қар',
      80: 'Жаңбыр душы', 81: 'Орташа жаңбыр', 82: 'Күшті жаңбыр',
      95: 'Найзағайлы', 96: 'Бұршақты найзағай', 99: 'Күшті бұршақты найзағай'
    }

    const weatherEmojis = {
      0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
      45: '🌫️', 48: '🌫️',
      51: '🌦️', 53: '🌧️', 55: '🌧️',
      61: '🌧️', 63: '🌧️', 65: '🌧️',
      71: '🌨️', 73: '❄️', 75: '❄️',
      80: '🌦️', 81: '🌧️', 82: '⛈️',
      95: '⛈️', 96: '⛈️', 99: '⛈️'
    }

    const code = current.weather_code
    const description = weatherDescriptions[code] || 'Белгісіз'
    const emoji = weatherEmojis[code] || '🌡️'

    return res.status(200).json({
      city: `${emoji} ${name}, ${country}`,
      temperature: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      windspeed: Math.round(current.wind_speed_10m),
      description,
      emoji,
      localTime,
      timezone,
      latitude,
      longitude
    })
  } catch (err) {
    console.error('Weather error:', err)
    return res.status(500).json({ error: 'Weather service error' })
  }
}
