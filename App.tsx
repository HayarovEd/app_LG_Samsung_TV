import { useEffect, useMemo, useState } from 'react'

type Screen = 'login' | 'channels' | 'player'
type FocusTarget = 'login' | 'categories' | 'channels' | 'player'

type Channel = {
  id: string
  name: string
  number: string
  category: string
  programme: string
  time: string
  color: string
}

const categories = ['Все каналы', 'Новости', 'Кино', 'Познавательное', 'Детские']

const channels: Channel[] = [
  { id: '1', name: 'Первый канал', number: '01', category: 'Новости', programme: 'Время', time: '21:00', color: '#d94b39' },
  { id: '2', name: 'Россия 1', number: '02', category: 'Новости', programme: 'Вести', time: '20:00', color: '#3478b8' },
  { id: '3', name: 'Пятый канал', number: '05', category: 'Кино', programme: 'След', time: '20:45', color: '#7c5aaa' },
  { id: '4', name: 'Победа', number: '12', category: 'Кино', programme: 'Т-34', time: '21:30', color: '#bb7a3c' },
  { id: '5', name: 'Наука', number: '24', category: 'Познавательное', programme: 'Космос рядом', time: '22:10', color: '#2d8b83' },
  { id: '6', name: 'Мульт', number: '31', category: 'Детские', programme: 'Ми-ми-мишки', time: '21:15', color: '#e08b4c' },
]

function App() {
  const [screen, setScreen] = useState<Screen>('login')
  const [focusTarget, setFocusTarget] = useState<FocusTarget>('login')
  const [selectedCategory, setSelectedCategory] = useState(categories[0])
  const [selectedChannel, setSelectedChannel] = useState(channels[0])
  const [loginError, setLoginError] = useState('')

  const visibleChannels = useMemo(
    () => selectedCategory === categories[0]
      ? channels
      : channels.filter((channel) => channel.category === selectedCategory),
    [selectedCategory],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        if (screen === 'player') {
          setScreen('channels')
          setFocusTarget('channels')
        }
        else if (screen === 'channels') setFocusTarget('categories')
        return
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        if (screen === 'channels' && focusTarget === 'categories') {
          const current = categories.indexOf(selectedCategory)
          const next = event.key === 'ArrowRight' ? current + 1 : current - 1
          if (categories[next]) setSelectedCategory(categories[next])
        }
        if (screen === 'channels' && focusTarget === 'channels') setFocusTarget('categories')
        return
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        if (screen === 'login') return
        setFocusTarget(focusTarget === 'categories' ? 'channels' : 'categories')
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        if (screen === 'login') {
          setLoginError('')
          setScreen('channels')
          setFocusTarget('categories')
        } else if (screen === 'channels' && focusTarget === 'categories') {
          setFocusTarget('channels')
        } else if (screen === 'channels' && focusTarget === 'channels') {
          setScreen('player')
          setFocusTarget('player')
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focusTarget, screen, selectedCategory])

  const openChannel = (channel: Channel) => {
    setSelectedChannel(channel)
    setScreen('player')
    setFocusTarget('player')
  }

  return (
    <main className="app-shell">
      <div className="noise" />
      <header className="topbar">
        <div className="brand-mark" aria-label="Tele TV">T<span>V</span></div>
        <div className="brand-copy">
          <strong>TELE TV</strong>
          <span>Телевидение без лишнего шума</span>
        </div>
        <div className="status-cluster">
          <span className="live-dot" /> LIVE
          <span className="clock">21:42</span>
        </div>
      </header>

      {screen === 'login' && (
        <section className="login-layout">
          <div className="login-copy">
            <span className="eyebrow">ДОМАШНИЙ ЭКРАН</span>
            <h1>Смотрите<br /><em>свое телевидение.</em></h1>
            <p>Каналы, прямой эфир и программа передач в одном спокойном пространстве.</p>
            <div className="signal-line"><span /> Сигнал стабильный</div>
          </div>
          <form className={`login-panel ${focusTarget === 'login' ? 'is-focused' : ''}`} onSubmit={(event) => { event.preventDefault(); setScreen('channels') }}>
            <div className="panel-kicker">ВХОД В АККАУНТ</div>
            <h2>Добрый вечер</h2>
            <p className="panel-note">Введите данные абонента, чтобы продолжить.</p>
            <label>ЛОГИН<input name="username" placeholder="Номер договора" autoComplete="username" /></label>
            <label>ПАРОЛЬ<input name="password" type="password" placeholder="••••••••" autoComplete="current-password" /></label>
            {loginError && <p className="error-note">{loginError}</p>}
            <button className="primary-button" type="submit">Войти <span>Enter ↵</span></button>
            <button className="ghost-button" type="button" onClick={() => setScreen('channels')}>Демо-режим</button>
          </form>
        </section>
      )}

      {screen === 'channels' && (
        <section className="channels-layout">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ПРЯМОЙ ЭФИР</span>
              <h1>Каналы</h1>
            </div>
            <div className="remote-hint"><span>← →</span> разделы <span>↑ ↓</span> фокус <span>Enter</span> открыть</div>
          </div>
          <nav className={`category-strip ${focusTarget === 'categories' ? 'is-focused' : ''}`} aria-label="Категории">
            {categories.map((category) => (
              <button key={category} className={selectedCategory === category ? 'active' : ''} onClick={() => { setSelectedCategory(category); setFocusTarget('categories') }}>{category}</button>
            ))}
          </nav>
          <div className="channel-grid">
            {visibleChannels.map((channel) => (
              <button key={channel.id} className={`channel-card ${focusTarget === 'channels' && selectedChannel.id === channel.id ? 'is-focused' : ''}`} onClick={() => openChannel(channel)}>
                <span className="channel-logo" style={{ background: channel.color }}>{channel.number}</span>
                <span className="channel-info"><strong>{channel.name}</strong><small>{channel.programme}</small></span>
                <span className="channel-time">{channel.time}</span>
              </button>
            ))}
          </div>
          <aside className="now-playing">
            <span className="eyebrow">ВЫБРАННЫЙ КАНАЛ</span>
            <div className="now-preview" style={{ background: `linear-gradient(135deg, ${selectedChannel.color}, #101820)` }}><span>{selectedChannel.number}</span><i>ON AIR</i></div>
            <strong>{selectedChannel.name}</strong>
            <p>{selectedChannel.programme} <span>сейчас</span></p>
          </aside>
        </section>
      )}

      {screen === 'player' && (
        <section className="player-layout">
          <div className="player-stage" style={{ background: `radial-gradient(circle at 70% 30%, ${selectedChannel.color}, transparent 38%), #0b1218` }}>
            <div className="player-placeholder"><span>{selectedChannel.number}</span><strong>{selectedChannel.name}</strong><small>Демо-поток готов к подключению</small></div>
            <div className="player-controls"><span className="play-icon">▶</span><div><strong>{selectedChannel.programme}</strong><small>Прямой эфир · {selectedChannel.time}</small></div><span className="quality">HD</span></div>
          </div>
          <div className="player-details"><span className="eyebrow">СЕЙЧАС В ЭФИРЕ</span><h1>{selectedChannel.name}</h1><p>{selectedChannel.programme}</p><button className="primary-button" onClick={() => setScreen('channels')}>Вернуться к каналам <span>Back</span></button></div>
        </section>
      )}

      <footer className="footer"><span>TELE TV · 2026</span><span>Доступно на LG webOS и Samsung Tizen</span></footer>
    </main>
  )
}

export default App
