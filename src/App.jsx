import { useState, useRef, useEffect } from 'react'
import { chatGroq, transcribeGroq, analyzeImageGroq, getWeather, generateImage } from './api.js'

// Ауа райы сұрауын анықтау
function detectWeather(text) {
  const t = text.toLowerCase()
  const weatherKw = ['ауа райы','погода','weather','температура','temperature','климат','жел','дождь']
  const hasWeather = weatherKw.some(w => t.includes(w))
  if (!hasWeather) return null
  // Қаланы іздеу — кез келген сөз болуы мүмкін
  const words = text.split(/\s+/)
  // Ауа райы кілт сөздерін алып тастап, қалған сөзді қала деп есептейміз
  const skipWords = new Set(['ауа','райы','погода','weather','в','of','қандай','какая','what','is','the','мен','және'])
  const cityWord = words.find(w => w.length > 2 && !skipWords.has(w.toLowerCase()))
  return cityWord || null
}

// Сурет генерация сұрауын анықтау
function detectImageGen(text) {
  const t = text.toLowerCase()
  return t.includes('сурет жаса') || t.includes('сурет генера') ||
    t.includes('нарисуй') || t.includes('сгенерируй') ||
    t.includes('generate image') || t.includes('draw ') ||
    t.includes('create image') || t.includes('imagine ')
}

export default function App() {
  const [chats, setChats] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chats') || '[]') } catch { return [] }
  })
  const [activeChatId, setActiveChatId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  const endRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Чатты сақтау
  function saveChats(updated) {
    setChats(updated)
    localStorage.setItem('chats', JSON.stringify(updated))
  }

  function createChat() {
    const id = Date.now()
    const chat = { id, title: 'Жаңа чат', messages: [] }
    const updated = [chat, ...chats]
    saveChats(updated)
    setActiveChatId(id)
    setMessages([])
    return id
  }

  function loadChat(chat) {
    setActiveChatId(chat.id)
    setMessages(chat.messages || [])
  }

  function deleteChat(id, e) {
    e.stopPropagation()
    const updated = chats.filter(c => c.id !== id)
    saveChats(updated)
    if (activeChatId === id) { setActiveChatId(null); setMessages([]) }
  }

  function addMessage(msgs, newMsg) {
    const updated = [...msgs, newMsg]
    setMessages(updated)
    return updated
  }

  function updateChatMessages(chatId, msgs) {
    if (!chatId) return
    const title = msgs.find(m => m.role === 'user')?.content?.slice(0, 28) || 'Жаңа чат'
    setChats(prev => {
      const updated = prev.map(c => c.id === chatId ? { ...c, title, messages: msgs } : c)
      localStorage.setItem('chats', JSON.stringify(updated))
      return updated
    })
  }

  async function handleSend(textOverride) {
    const text = (textOverride ?? input).trim()
    if (!text || loading) return

    let chatId = activeChatId
    if (!chatId) chatId = createChat()

    const userMsg = { role: 'user', content: text, type: 'text' }
    const msgs1 = addMessage(messages, userMsg)
    setInput('')
    setLoading(true)

    try {
      // 1. Ауа райы?
      const city = detectWeather(text)
      if (city) {
        try {
          const w = await getWeather(city)
          const content =
            `${w.city}\n` +
            `🌡 Температура: ${w.temperature}°C (сезіледі ${w.feelsLike}°C)\n` +
            `🌤 ${w.description}\n` +
            `💧 Ылғалдылық: ${w.humidity}%\n` +
            `💨 Жел: ${w.windspeed} км/сағ\n` +
            `🕐 Жергілікті уақыт: ${w.localTime}`
          const msgs2 = addMessage(msgs1, { role: 'assistant', content, type: 'text' })
          updateChatMessages(chatId, msgs2)
          setLoading(false)
          return
        } catch {
          // Қала табылмаса — кәдімгі чатқа кетеді
        }
      }

      // 2. Сурет генерация?
      if (detectImageGen(text)) {
        const prompt = text
          .replace(/сурет жаса[а-я]*/gi, '').replace(/сурет генера[а-я]*/gi, '')
          .replace(/нарисуй|сгенерируй|generate image|draw |create image|imagine /gi, '')
          .trim() || text
        const imageUrl = await generateImage(prompt)
        const msgs2 = addMessage(msgs1, { role: 'assistant', content: '🎨 Сурет дайын!', type: 'image', imageUrl })
        updateChatMessages(chatId, msgs2)
        setLoading(false)
        return
      }

      // 3. Кәдімгі чат
      const history = msgs1
        .filter(m => m.type === 'text' || !m.type)
        .map(m => ({ role: m.role, content: m.content }))
      const reply = await chatGroq(history)
      const msgs2 = addMessage(msgs1, { role: 'assistant', content: reply, type: 'text' })
      updateChatMessages(chatId, msgs2)

    } catch (err) {
      const msgs2 = addMessage(msgs1, { role: 'assistant', content: '❌ Қате: ' + err.message, type: 'text' })
      updateChatMessages(chatId, msgs2)
    }
    setLoading(false)
  }

  async function handleImage(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''

    let chatId = activeChatId
    if (!chatId) chatId = createChat()
    setLoading(true)

    const reader = new FileReader()
    reader.onload = async ev => {
      const dataUrl = ev.target.result
      const base64 = dataUrl.split(',')[1]
      const userMsg = { role: 'user', content: '📸 Фото жіберілді', type: 'photo', imageData: dataUrl }
      const msgs1 = addMessage(messages, userMsg)
      try {
        const result = await analyzeImageGroq(base64)
        const msgs2 = addMessage(msgs1, { role: 'assistant', content: result, type: 'text' })
        updateChatMessages(chatId, msgs2)
      } catch (err) {
        const msgs2 = addMessage(msgs1, { role: 'assistant', content: '❌ Фото қатесі: ' + err.message, type: 'text' })
        updateChatMessages(chatId, msgs2)
      }
      setLoading(false)
    }
    reader.readAsDataURL(file)
  }

  async function toggleRecording() {
    if (recording) {
      mediaRef.current?.stop()
      setRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        setLoading(true)
        try {
          const text = await transcribeGroq(blob)
          if (text?.trim()) await handleSend(text.trim())
        } catch (err) {
          setMessages(prev => [...prev, { role: 'assistant', content: '❌ Аудио қатесі: ' + err.message, type: 'text' }])
        }
        setLoading(false)
      }
      mr.start()
      mediaRef.current = mr
      setRecording(true)
    } catch {
      alert('Микрофонға рұқсат беріңіз')
    }
  }

  const S = styles
  return (
    <div style={S.app}>
      {/* ── SIDEBAR ── */}
      <div style={{ ...S.sidebar, width: sidebarOpen ? 260 : 0 }}>
        <div style={S.sideHead}>
          <span style={S.logo}>🤖 AI Chat</span>
          <button style={S.newBtn} onClick={createChat}>+ Жаңа</button>
        </div>
        <div style={S.chatList}>
          {chats.length === 0 && <p style={S.empty}>Чат тарихы жоқ</p>}
          {chats.map(c => (
            <div key={c.id} style={{ ...S.chatItem, background: c.id === activeChatId ? '#23233a' : 'transparent' }}
              onClick={() => loadChat(c)}>
              <span style={S.chatTitle}>💬 {c.title}</span>
              <button style={S.delBtn} onClick={e => deleteChat(c.id, e)}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={S.main}>
        {/* Header */}
        <div style={S.header}>
          <button style={S.menuBtn} onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <span style={S.headerTitle}>🤖 AI Көмекші</span>
        </div>

        {/* Messages */}
        <div style={S.msgs}>
          {messages.length === 0 && (
            <div style={S.welcome}>
              <div style={S.wIcon}>🤖</div>
              <h2 style={S.wTitle}>Сәлем! Мен AI Көмекшімін</h2>
              <p style={S.wSub}>Кез келген тілде сұрақ қойыңыз · Аудио · Фото · Сурет генерация</p>
              <div style={S.hints}>
                {['Алматы ауа райы қандай?', 'Сурет жаса: күн батысы теңізде', 'Объясни квантовую физику', 'Write a poem about AI'].map(h => (
                  <button key={h} style={S.hintBtn} onClick={() => handleSend(h)}>{h}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ ...S.row, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'assistant' && <span style={S.ava}>🤖</span>}
              <div style={{
                ...S.bubble,
                background: m.role === 'user' ? 'linear-gradient(135deg,#6c63ff,#9b59b6)' : '#1a1a2e',
                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              }}>
                {/* Жүктелген фото */}
                {m.imageData && <img src={m.imageData} style={S.imgPrev} alt="upload" />}
                {/* Генерацияланған сурет */}
                {m.imageUrl && <img src={m.imageUrl} style={S.imgGen} alt="generated" />}
                {/* Мәтін */}
                <div style={S.msgText}>{m.content}</div>
              </div>
              {m.role === 'user' && <span style={S.ava}>👤</span>}
            </div>
          ))}

          {loading && (
            <div style={S.row}>
              <span style={S.ava}>🤖</span>
              <div style={{ ...S.bubble, background: '#1a1a2e' }}>
                <div style={S.dots}>
                  <span style={{ ...S.dot, animationDelay: '0s' }} />
                  <span style={{ ...S.dot, animationDelay: '0.2s' }} />
                  <span style={{ ...S.dot, animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div style={S.inputArea}>
          <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/*" onChange={handleImage} />
          <button style={S.iconBtn} onClick={() => fileRef.current?.click()} title="Фото жүктеу">📷</button>
          <button style={{ ...S.iconBtn, background: recording ? '#c0392b' : 'transparent' }}
            onClick={toggleRecording} title={recording ? 'Тоқтату' : 'Аудио жазу'}>
            {recording ? '⏹' : '🎤'}
          </button>
          <input style={S.input} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Хабарлама жазыңыз... (Enter — жіберу)"
            disabled={loading || recording}
          />
          <button style={{ ...S.sendBtn, opacity: loading || !input.trim() ? 0.4 : 1 }}
            onClick={() => handleSend()} disabled={loading || !input.trim()}>
            ➤
          </button>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d0d1a; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #2a2a40; border-radius: 4px; }
        @keyframes pulse {
          0%,100% { transform: scale(1); opacity:.5 }
          50% { transform: scale(1.4); opacity:1 }
        }
      `}</style>
    </div>
  )
}

const styles = {
  app: { display:'flex', height:'100vh', background:'#0d0d1a', color:'#ddd', fontFamily:"'Segoe UI',sans-serif", overflow:'hidden' },
  sidebar: { background:'#10101e', borderRight:'1px solid #1c1c30', display:'flex', flexDirection:'column', transition:'width .3s', overflow:'hidden', flexShrink:0 },
  sideHead: { padding:'16px', borderBottom:'1px solid #1c1c30', display:'flex', alignItems:'center', justifyContent:'space-between' },
  logo: { fontSize:16, fontWeight:700, color:'#9b59b6', whiteSpace:'nowrap' },
  newBtn: { background:'linear-gradient(135deg,#6c63ff,#9b59b6)', color:'#fff', border:'none', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:600, whiteSpace:'nowrap' },
  chatList: { flex:1, overflowY:'auto', padding:'6px 0' },
  empty: { padding:16, color:'#444', fontSize:13, textAlign:'center' },
  chatItem: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', cursor:'pointer', borderRadius:8, margin:'2px 6px' },
  chatTitle: { fontSize:13, color:'#bbb', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 },
  delBtn: { background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:11, padding:'2px 5px', borderRadius:4 },
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
  header: { background:'#10101e', borderBottom:'1px solid #1c1c30', padding:'13px 18px', display:'flex', alignItems:'center', gap:12 },
  menuBtn: { background:'none', border:'none', color:'#aaa', fontSize:20, cursor:'pointer' },
  headerTitle: { fontSize:17, fontWeight:700, color:'#9b59b6' },
  msgs: { flex:1, overflowY:'auto', padding:'18px 14px', display:'flex', flexDirection:'column', gap:12 },
  welcome: { textAlign:'center', margin:'auto', padding:32, maxWidth:560 },
  wIcon: { fontSize:60, marginBottom:14 },
  wTitle: { fontSize:22, fontWeight:700, color:'#9b59b6', marginBottom:8 },
  wSub: { color:'#777', fontSize:14, marginBottom:22, lineHeight:1.6 },
  hints: { display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' },
  hintBtn: { background:'#1a1a2e', border:'1px solid #252540', color:'#bbb', borderRadius:20, padding:'8px 14px', fontSize:13, cursor:'pointer' },
  row: { display:'flex', alignItems:'flex-end', gap:8 },
  ava: { fontSize:22, flexShrink:0 },
  bubble: { maxWidth:'72%', padding:'11px 15px', fontSize:14, lineHeight:1.65, color:'#e0e0e0', wordBreak:'break-word' },
  imgPrev: { maxWidth:200, borderRadius:10, marginBottom:8, display:'block' },
  imgGen: { maxWidth:300, borderRadius:12, marginBottom:8, display:'block' },
  msgText: { whiteSpace:'pre-wrap' },
  dots: { display:'flex', gap:5, padding:'4px 2px' },
  dot: { width:8, height:8, borderRadius:'50%', background:'#9b59b6', display:'inline-block', animation:'pulse 1.2s infinite' },
  inputArea: { background:'#10101e', borderTop:'1px solid #1c1c30', padding:'12px 14px', display:'flex', gap:8, alignItems:'center' },
  iconBtn: { background:'transparent', border:'1px solid #252540', color:'#bbb', borderRadius:8, padding:'8px 10px', fontSize:17, cursor:'pointer', flexShrink:0 },
  input: { flex:1, background:'#1a1a2e', border:'1px solid #252540', borderRadius:12, padding:'11px 15px', color:'#e0e0e0', fontSize:14, outline:'none' },
  sendBtn: { background:'linear-gradient(135deg,#6c63ff,#9b59b6)', border:'none', borderRadius:10, color:'#fff', fontSize:18, padding:'9px 15px', cursor:'pointer', flexShrink:0 },
}
