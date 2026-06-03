# AI Assistant Website 🤖

Telegram ботымен бірдей мүмкіндіктері бар толық AI веб-сайт.

## 🚀 Мүмкіндіктер

- 💬 **Кез келген тілде чат** — қазақша, орысша, ағылшынша және 100+ тіл
- 🎤 **Аудио хабарламалар** — Groq Whisper арқылы транскрипция
- 📸 **Сурет талдау** — Llama 4 Scout vision модель
- 🎨 **Сурет генерациясы** — Replicate FLUX Schnell
- 🌤️ **Ауа-райы** — Open-Meteo API (тегін, кілт керек емес)
- 📚 **Чат тарихы** — LocalStorage арқылы браузерде сақталады

## 📦 Жергілікті іске қосу

```bash
# Тәуелділіктерді орнату
npm install

# .env файл жасау
cp .env.example .env.local
# .env.local файлына API кілттерін енгізіңіз

# Dev сервер іске қосу
npm run dev
```

## 🌐 Vercel-ге орналастыру

### 1. GitHub-қа жүктеу
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USERNAME/ai-assistant-website.git
git push -u origin main
```

### 2. Vercel Dashboard
1. https://vercel.com жаңа жоба жасаңыз
2. GitHub репозиторийін байланыстырыңыз
3. **Settings → Environment Variables** бөліміне өтіңіз:
   - `GROQ_API_KEY` = `gsk_...` (Міндетті!)
   - `REPLICATE_API_TOKEN` = `r8_...` (Сурет генерациясы үшін)
4. Deploy басыңыз

### 3. API Кілттерін алу
- **Groq API Key**: https://console.groq.com → API Keys
- **Replicate Token**: https://replicate.com → Account Settings → API Tokens

## 🔧 Технологиялар

| Компонент | Технология |
|-----------|-----------|
| Frontend | React 18 + Vite |
| Hosting | Vercel |
| AI Chat | Groq (llama-3.3-70b-versatile) |
| Audio | Groq (whisper-large-v3) |
| Vision | Groq (llama-4-scout-17b) |
| Image Gen | Replicate (FLUX Schnell) |
| Weather | Open-Meteo (тегін) |
| Storage | Browser LocalStorage |

## 📁 Жоба құрылымы

```
ai-assistant-website/
├── api/                    # Vercel Serverless Functions
│   ├── chat.js            # AI чат (Groq)
│   ├── weather.js         # Ауа-райы (Open-Meteo)
│   ├── generate-image.js  # Сурет жасау (Replicate FLUX)
│   ├── analyze-image.js   # Сурет талдау (Groq Vision)
│   └── transcribe.js      # Аудио → Мәтін (Groq Whisper)
├── src/
│   ├── App.jsx            # Негізгі React компоненті
│   ├── main.jsx           # React entry point
│   └── index.css          # Глобал стильдер
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```
