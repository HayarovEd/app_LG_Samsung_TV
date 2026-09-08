import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiEpg, authorize, buildAuthenticatedStreamUrl, getCategories, getChannels, getEpg, isApiConfigured } from './api'
import { getTizenPlayer, startTizenPlayer, stopTizenPlayer } from './player'

type Screen = 'login' | 'channels' | 'player'
type FocusTarget = 'login' | 'categories' | 'channels' | 'player'

type Channel = {
  id: string
  name: string
  number: string
  url?: string
  category: string
  programme: string
  time: string
  color: string
}

const demoCategories = ['Все каналы', 'Новости', 'Кино', 'Познавательное', 'Детские']
const testStreamUrl = import.meta.env.VITE_TEST_STREAM_URL

const demoChannels: Channel[] = [
  { id: '1', name: 'Первый канал', number: '01', url: testStreamUrl, category: 'Новости', programme: 'Время', time: '21:00', color: '#d94b39' },
  { id: '2', name: 'Россия 1', number: '02', category: 'Новости', programme: 'Вести', time: '20:00', color: '#3478b8' },
  { id: '3', name: 'Пятый канал', number: '05', category: 'Кино', programme: 'След', time: '20:45', color: '#7c5aaa' },
  { id: '4', name: 'Победа', number: '12', category: 'Кино', programme: 'Т-34', time: '21:30', color: '#bb7a3c' },
  { id: '5', name: 'Наука', number: '24', category: 'Познавательное', programme: 'Космос рядом', time: '22:10', color: '#2d8b83' },
  { id: '6', name: 'Мульт', number: '31', category: 'Детские', programme: 'Ми-ми-мишки', time: '21:15', color: '#e08b4c' },
]

function App() {
  const [screen, setScreen] = useState<Screen>('login')
  const [focusTarget, setFocusTarget] = useState<FocusTarget>('login')
  const [categoryList, setCategoryList] = useState(demoCategories)
  const [selectedCategory, setSelectedCategory] = useState(demoCategories[0])
  const [channelList, setChannelList] = useState<Channel[]>(demoChannels)
  const [selectedChannel, setSelectedChannel] = useState(demoChannels[0])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [playerError, setPlayerError] = useState('')
  const playerStageRef = useRef<HTMLDivElement>(null)
  const [epg, setEpg] = useState<ApiEpg[]>([])

  const visibleChannels = useMemo(
    () => selectedCategory === categoryList[0]
      ? channelList
      : channelList.filter((channel) => channel.category === selectedCategory),
    [categoryList, channelList, selectedCategory],
  )

  useEffect(() => {
    if (visibleChannels.length > 0 && !visibleChannels.some((channel) => channel.id === selectedChannel.id)) {
      setSelectedChannel(visibleChannels[0])
    }
  }, [selectedChannel.id, visibleChannels])

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginError('')

    if (!isApiConfigured) {
      setScreen('channels')
      setFocusTarget('categories')
      return
    }

    setIsLoading(true)
    try {
      await authorize(username, password)
      const [channelsResult, epgResult, categoriesResult] = await Promise.allSettled([getChannels(username, password), getEpg(username, password), getCategories(username, password)])
      if (channelsResult.status === 'rejected') throw channelsResult.reason
      const remoteChannels = channelsResult.value
      const remoteCategories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : []
      const categoryNames = ['Все каналы', ...remoteCategories.map((category) => category.name)]
      const categoryByKey = new Map(remoteCategories.map((category) => [category.key, category.name]))
      const colors = ['#d94b39', '#3478b8', '#7c5aaa', '#bb7a3c', '#2d8b83', '#e08b4c']
      const mappedChannels: Channel[] = remoteChannels.map((channel, index) => ({
        id: channel.id,
        name: channel.name,
        number: channel.number,
        url: channel.url,
        category: channel.categoryIds.map((id) => categoryByKey.get(id)).find(Boolean) ?? categoryNames[0],
        programme: 'Прямой эфир',
        time: 'сейчас',
        color: colors[index % colors.length],
      }))
      setChannelList(mappedChannels)
      setCategoryList(categoryNames)
      setSelectedCategory(categoryNames[0])
      setEpg(epgResult.status === 'fulfilled' ? epgResult.value : [])
      setSelectedChannel(mappedChannels[0] ?? demoChannels[0])
      setScreen('channels')
      setFocusTarget('categories')
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Не удалось подключиться к серверу')
    } finally {
      setIsLoading(false)
    }
  }

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
          const current = categoryList.indexOf(selectedCategory)
          const next = event.key === 'ArrowRight' ? current + 1 : current - 1
          if (categoryList[next]) setSelectedCategory(categoryList[next])
        } else if (screen === 'channels' && focusTarget === 'channels' && visibleChannels.length > 0) {
          const current = visibleChannels.findIndex((channel) => channel.id === selectedChannel.id)
          const next = event.key === 'ArrowRight' ? current + 1 : current - 1
          if (visibleChannels[next]) setSelectedChannel(visibleChannels[next])
        }
        return
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        if (screen === 'login') return
        if (screen === 'channels' && focusTarget === 'channels' && visibleChannels.length > 0) {
          const current = visibleChannels.findIndex((channel) => channel.id === selectedChannel.id)
          const next = event.key === 'ArrowDown' ? current + 2 : current - 2
          if (visibleChannels[next]) setSelectedChannel(visibleChannels[next])
          else if (event.key === 'ArrowUp') setFocusTarget('categories')
        } else if (screen === 'channels' && event.key === 'ArrowDown') {
          if (!visibleChannels.some((channel) => channel.id === selectedChannel.id) && visibleChannels[0]) {
            setSelectedChannel(visibleChannels[0])
          }
          setFocusTarget('channels')
        } else {
          setFocusTarget('categories')
        }
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        if (screen === 'login') {
          document.querySelector<HTMLFormElement>('.login-panel')?.requestSubmit()
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
  }, [categoryList, focusTarget, screen, selectedCategory, selectedChannel, visibleChannels])

  const openChannel = (channel: Channel) => {
    setSelectedChannel(channel)
    setPlayerError('')
    setScreen('player')
    setFocusTarget('player')
  }

  const streamUrl = selectedChannel.url && username && password
    ? buildAuthenticatedStreamUrl(selectedChannel.url, username, password)
    : undefined
  const tizenPlayer = getTizenPlayer()
  const selectedEpg = epg
    .filter((item) => item.channelUuid === selectedChannel.id)
    .slice(0, 4)

  const formatEpgTime = (timestamp: number) => new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  useEffect(() => {
    if (screen !== 'player' || !streamUrl || !tizenPlayer || !playerStageRef.current) return

    const bounds = playerStageRef.current.getBoundingClientRect()
    try {
      startTizenPlayer(tizenPlayer, streamUrl, bounds, () => setPlayerError('Поток недоступен через Samsung AVPlay'))
    } catch {
      setPlayerError('Не удалось запустить Samsung AVPlay')
    }

    return () => stopTizenPlayer(tizenPlayer)
  }, [screen, streamUrl, tizenPlayer])

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
          <form className={`login-panel ${focusTarget === 'login' ? 'is-focused' : ''}`} onSubmit={submitLogin}>
            <div className="panel-kicker">ВХОД В АККАУНТ</div>
            <h2>Добрый вечер</h2>
            <p className="panel-note">Введите данные абонента, чтобы продолжить.</p>
            <label>ЛОГИН<input name="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Номер договора" autoComplete="username" /></label>
            <label>ПАРОЛЬ<input name="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="••••••••" autoComplete="current-password" /></label>
            {loginError && <p className="error-note">{loginError}</p>}
            <button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? 'Подключение...' : 'Войти'} <span>Enter ↵</span></button>
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
            {categoryList.map((category) => (
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
            {selectedEpg.length > 0 ? <div className="epg-list">{selectedEpg.map((item) => <div className="epg-item" key={item.eventId}><span>{formatEpgTime(item.start)}</span><strong>{item.title}</strong></div>)}</div> : <p>{selectedChannel.programme} <span>сейчас</span></p>}
          </aside>
        </section>
      )}

      {screen === 'player' && (
        <section className="player-layout">
          <div ref={playerStageRef} className="player-stage" style={{ background: `radial-gradient(circle at 70% 30%, ${selectedChannel.color}, transparent 38%), #0b1218` }}>
            {tizenPlayer && streamUrl && !playerError ? (
              <div className="native-player-surface" aria-label="Samsung AVPlay" />
            ) : streamUrl && !playerError ? (
              <video className="live-video" src={streamUrl} autoPlay controls playsInline onError={() => setPlayerError('Поток недоступен в браузере телевизора')} />
            ) : (
              <div className="player-placeholder"><span>{selectedChannel.number}</span><strong>{selectedChannel.name}</strong><small>{playerError || 'Демо-поток готов к подключению'}</small></div>
            )}
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
