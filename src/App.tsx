import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiEpg, authorize, buildAuthenticatedStreamUrl, getCategories, getChannels, getEpg, isApiConfigured } from './api'
import { getPlayerMode, getTizenPlayer, startTizenPlayer, stopTizenPlayer } from './player'

type Screen = 'login' | 'channels' | 'guide' | 'player'
type FocusTarget = 'login' | 'recent' | 'categories' | 'channels' | 'player'
type PlayerState = 'idle' | 'connecting' | 'playing' | 'error'

type Channel = {
  id: string
  name: string
  number: string
  url?: string
  logo?: string
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
const radioChannel: Channel = {
  id: 'radio-impuls',
  name: 'Радио Импульс',
  number: '1000',
  url: 'https://impulsfm.ru/impuls',
  logo: 'https://radio.impulsfm.ru/images/logo3.svg',
  category: 'Радио',
  programme: 'Радио Импульс',
  time: 'эфир',
  color: '#28c42e',
}
const recentChannelsStorageKey = 'tele-tv-recent-channels'
const credentialsStorageKey = 'tele-tv-credentials'
const recentChannelsLimit = 8

function loadCredentials() {
  const stored = localStorage.getItem(credentialsStorageKey)
  if (!stored) return { username: '', password: '' }
  try {
    const parsed = JSON.parse(stored)
    return {
      username: typeof parsed.username === 'string' ? parsed.username : '',
      password: typeof parsed.password === 'string' ? parsed.password : '',
    }
  } catch {
    return { username: '', password: '' }
  }
}

function loadRecentChannels() {
  const stored = localStorage.getItem(recentChannelsStorageKey)
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed as Channel[] : []
  } catch {
    return []
  }
}

function App() {
  const savedCredentials = useMemo(() => loadCredentials(), [])
  const [screen, setScreen] = useState<Screen>('login')
  const [focusTarget, setFocusTarget] = useState<FocusTarget>('login')
  const [categoryList, setCategoryList] = useState(demoCategories)
  const [selectedCategory, setSelectedCategory] = useState(demoCategories[0])
  const [channelList, setChannelList] = useState<Channel[]>(demoChannels)
  const [channelsByCategory, setChannelsByCategory] = useState<Record<string, Channel[]>>(
    Object.fromEntries(demoCategories.map((category) => [
      category,
      category === demoCategories[0] ? demoChannels : demoChannels.filter((channel) => channel.category === category),
    ])),
  )
  const [selectedChannel, setSelectedChannel] = useState(demoChannels[0])
  const [recentChannels, setRecentChannels] = useState<Channel[]>(() => loadRecentChannels())
  const [selectedRecentChannel, setSelectedRecentChannel] = useState<Channel | undefined>(() => loadRecentChannels()[0])
  const [username, setUsername] = useState(savedCredentials.username)
  const [password, setPassword] = useState(savedCredentials.password)
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [playerError, setPlayerError] = useState('')
  const [playerState, setPlayerState] = useState<PlayerState>('idle')
  const [playerMenuVisible, setPlayerMenuVisible] = useState(false)
  const [playerEpgVisible, setPlayerEpgVisible] = useState(false)
  const [playerMenuIndex, setPlayerMenuIndex] = useState(0)
  const [playerInfoVisible, setPlayerInfoVisible] = useState(false)
  const playerStageRef = useRef<HTMLDivElement>(null)
  const [epg, setEpg] = useState<ApiEpg[]>([])
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const gridColumns = 8

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const formatHeaderDate = (date: Date) => date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const weekday = currentTime.toLocaleDateString('ru-RU', { weekday: 'long' })

  const logout = () => {
    setUsername('')
    setPassword('')
    setEpg([])
    setRecentChannels([])
    setSelectedRecentChannel(undefined)
    localStorage.removeItem(recentChannelsStorageKey)
    localStorage.removeItem(credentialsStorageKey)
    setScreen('login')
    setFocusTarget('login')
  }

  const visibleChannels = useMemo(() => {
    return channelsByCategory[selectedCategory] ?? []
  }, [categoryList, channelList, channelsByCategory, selectedCategory])
  const playerChannels = channelList.length > 0 ? channelList : visibleChannels

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

    if (!username.trim() || !password) {
      setLoginError('Введите логин и пароль')
      return
    }

    setIsLoading(true)
    try {
      await authorize(username, password)
      localStorage.setItem(credentialsStorageKey, JSON.stringify({ username, password }))
      const [channelsResult, epgResult, categoriesResult] = await Promise.allSettled([getChannels(username, password), getEpg(username, password), getCategories(username, password)])
      if (channelsResult.status === 'rejected') throw channelsResult.reason
      const remoteChannels = channelsResult.value
      const remoteCategories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : []
      const categoryByKey = new Map(remoteCategories.map((category) => [category.key, category.name]))
      const colors = ['#d94b39', '#3478b8', '#7c5aaa', '#bb7a3c', '#2d8b83', '#e08b4c']
      const mappedChannels: Channel[] = remoteChannels.map((channel, index) => ({
        id: channel.id,
        name: channel.name,
        number: channel.number,
        url: channel.url,
        logo: channel.logo,
        category: channel.categoryIds.map((id) => categoryByKey.get(id)).find(Boolean) ?? 'Все каналы',
        programme: 'Прямой эфир',
        time: 'сейчас',
        color: colors[index % colors.length],
      }))
      const groupedChannels = remoteCategories.reduce<Record<string, Channel[]>>((groups, category) => {
        const channels = mappedChannels.filter((channel, index) => remoteChannels[index].categoryIds.includes(category.key))
        if (channels.length > 0) groups[category.name] = channels
        return groups
      }, {      })
      groupedChannels['Все каналы'] = mappedChannels
      groupedChannels[radioChannel.category] = [radioChannel]
      const federalCategory = Object.keys(groupedChannels).find((category) => category.toLocaleLowerCase('ru-RU') === 'федеральные')
      const categoryNames = [
        'Все каналы',
        ...(federalCategory ? [federalCategory] : []),
        ...Object.keys(groupedChannels).filter((category) => category !== 'Все каналы' && category !== radioChannel.category && category !== federalCategory),
        radioChannel.category,
      ]
      setChannelList(mappedChannels)
      setChannelsByCategory(groupedChannels)
      setCategoryList(categoryNames)
      setSelectedCategory(categoryNames[0] ?? radioChannel.category)
      setEpg(epgResult.status === 'fulfilled' ? epgResult.value : [])
      setSelectedChannel(groupedChannels[categoryNames[0]]?.[0] ?? radioChannel)
      setRecentChannels((current) => current.filter((recent) => mappedChannels.some((channel) => channel.id === recent.id) || recent.id === radioChannel.id))
      setScreen('channels')
      setFocusTarget('categories')
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Не удалось подключиться к серверу')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isApiConfigured && savedCredentials.username && savedCredentials.password) {
      document.querySelector<HTMLFormElement>('.login-panel')?.requestSubmit()
    }
  }, [savedCredentials.password, savedCredentials.username])

  useEffect(() => {
    if (screen !== 'player') {
      setPlayerInfoVisible(false)
      return
    }
    setPlayerInfoVisible(true)
    const timer = window.setTimeout(() => setPlayerInfoVisible(false), 5000)
    return () => window.clearTimeout(timer)
  }, [screen, selectedChannel.id])

  useEffect(() => {
    if (screen !== 'player' || !playerMenuVisible) return
    const timer = window.setTimeout(() => {
      setPlayerMenuVisible(false)
      setPlayerEpgVisible(false)
    }, 10000)
    return () => window.clearTimeout(timer)
  }, [playerEpgVisible, playerMenuIndex, playerMenuVisible, screen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        if (screen === 'player') {
          if (playerEpgVisible) setPlayerEpgVisible(false)
          else if (playerMenuVisible) setPlayerMenuVisible(false)
          else {
            setScreen('channels')
            setFocusTarget('channels')
          }
        }
        else if (screen === 'guide') {
          setScreen('channels')
          setFocusTarget('channels')
        }
        else if (screen === 'channels') setFocusTarget('categories')
        return
      }

      if (['g', 'guide', 'info'].includes(event.key.toLowerCase()) && (screen === 'channels' || screen === 'player')) {
        event.preventDefault()
        setScreen('guide')
        return
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        if (screen === 'player') {
          if (event.key === 'ArrowLeft') {
            if (playerEpgVisible) setPlayerEpgVisible(false)
            else {
              setPlayerMenuVisible(true)
              setPlayerMenuIndex(Math.max(0, playerChannels.findIndex((channel) => channel.id === selectedChannel.id)))
            }
          } else if (playerMenuVisible) {
            setPlayerEpgVisible(true)
          }
          return
        }
        if (screen === 'channels' && focusTarget === 'recent' && recentChannels.length > 0) {
          const current = Math.max(0, recentChannels.findIndex((channel) => channel.id === selectedRecentChannel?.id))
          const next = event.key === 'ArrowRight' ? current + 1 : current - 1
          if (recentChannels[next]) {
            setSelectedRecentChannel(recentChannels[next])
            setSelectedChannel(recentChannels[next])
          }
        } else if (screen === 'channels' && focusTarget === 'categories') {
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
        if (screen === 'player' && playerChannels.length > 0) {
          if (playerMenuVisible) {
            const current = Math.max(0, playerMenuIndex)
            const next = event.key === 'ArrowDown' ? current + 1 : current - 1
            if (playerChannels[next]) setPlayerMenuIndex(next)
            return
          }
          const current = playerChannels.findIndex((channel) => channel.id === selectedChannel.id)
          const next = event.key === 'ArrowUp'
            ? (current + 1) % playerChannels.length
            : (current - 1 + playerChannels.length) % playerChannels.length
          setSelectedChannel(playerChannels[next])
          setPlayerError('')
          return
        }
        if (screen === 'channels' && focusTarget === 'channels' && visibleChannels.length > 0) {
          const current = visibleChannels.findIndex((channel) => channel.id === selectedChannel.id)
          if (event.key === 'ArrowUp' && current >= 0 && current < gridColumns) {
            setFocusTarget('categories')
            return
          }
          const next = event.key === 'ArrowDown' ? current + gridColumns : current - gridColumns
          if (visibleChannels[next]) setSelectedChannel(visibleChannels[next])
          else if (event.key === 'ArrowUp') setFocusTarget('categories')
        } else if (screen === 'channels' && focusTarget === 'recent') {
          if (event.key === 'ArrowDown') setFocusTarget('categories')
        } else if (screen === 'channels' && event.key === 'ArrowDown') {
          if (visibleChannels[0]) {
            setSelectedChannel(visibleChannels[0])
            setFocusTarget('channels')
          }
        } else if (screen === 'channels' && event.key === 'ArrowUp' && focusTarget === 'categories' && recentChannels.length > 0) {
          setFocusTarget('recent')
          setSelectedRecentChannel(recentChannels[0])
          setSelectedChannel(recentChannels[0])
        } else {
          setFocusTarget('categories')
        }
        return
      }

      if (screen === 'player' && (event.key === 'PageUp' || event.key === 'PageDown')) {
        event.preventDefault()
        const current = visibleChannels.findIndex((channel) => channel.id === selectedChannel.id)
        const next = event.key === 'PageDown' ? current + 1 : current - 1
        if (visibleChannels[next]) {
          setSelectedChannel(visibleChannels[next])
          setPlayerError('')
        }
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        if (screen === 'login') {
          document.querySelector<HTMLFormElement>('.login-panel')?.requestSubmit()
        } else if (screen === 'player') {
          if (playerMenuVisible && playerChannels[playerMenuIndex]) {
            openChannel(playerChannels[playerMenuIndex])
          } else {
            setPlayerMenuVisible(true)
            setPlayerMenuIndex(Math.max(0, playerChannels.findIndex((channel) => channel.id === selectedChannel.id)))
          }
        } else if (screen === 'channels' && focusTarget === 'categories') {
          setFocusTarget('channels')
          if (visibleChannels[0]) setSelectedChannel(visibleChannels[0])
        } else if (screen === 'channels' && (focusTarget === 'channels' || focusTarget === 'recent')) {
          if (focusTarget === 'recent' && selectedRecentChannel) openChannel(selectedRecentChannel)
          else openChannel(selectedChannel)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [categoryList, focusTarget, gridColumns, playerChannels, playerEpgVisible, playerMenuIndex, playerMenuVisible, recentChannels, screen, selectedCategory, selectedChannel, selectedRecentChannel, visibleChannels])

  const openChannel = (channel: Channel) => {
    setRecentChannels((current) => {
      const next = [channel, ...current.filter((recent) => recent.id !== channel.id)].slice(0, recentChannelsLimit)
      localStorage.setItem(recentChannelsStorageKey, JSON.stringify(next))
      return next
    })
    setSelectedRecentChannel(channel)
    setSelectedChannel(channel)
    setPlayerError('')
    setPlayerState('idle')
    setPlayerMenuVisible(false)
    setPlayerEpgVisible(false)
    setScreen('player')
    setFocusTarget('player')
  }

  const streamUrl = selectedChannel.url && username && password
    ? buildAuthenticatedStreamUrl(selectedChannel.url, username, password)
    : undefined
  const tizenPlayer = getTizenPlayer()
  const playerMode = getPlayerMode(tizenPlayer)
  const epgByChannel = useMemo(() => {
    const grouped = new Map<string, ApiEpg[]>()
    epg.forEach((item) => {
      const channelEvents = grouped.get(item.channelUuid) ?? []
      channelEvents.push(item)
      grouped.set(item.channelUuid, channelEvents)
    })
    grouped.forEach((events) => events.sort((a, b) => a.start - b.start))
    return grouped
  }, [epg])
  const selectedEpg = epgByChannel.get(selectedChannel.id) ?? []
  const now = Math.floor(Date.now() / 1000)
  const currentEpgByChannel = useMemo(() => {
    const current = new Map<string, ApiEpg>()
    epgByChannel.forEach((events, channelId) => {
      const currentEvent = events.find((item) => item.start <= now && item.stop > now) ?? events.find((item) => item.start > now)
      if (currentEvent) current.set(channelId, currentEvent)
    })
    return current
  }, [epgByChannel, now])
  const currentProgramme = currentEpgByChannel.get(selectedChannel.id)
  const programmeProgress = currentProgramme
    ? Math.min(100, Math.max(0, ((now - currentProgramme.start) / Math.max(1, currentProgramme.stop - currentProgramme.start)) * 100))
    : 0
  const playerMenuChannel = playerChannels[playerMenuIndex] ?? selectedChannel
  const playerMenuEpg = epgByChannel.get(playerMenuChannel.id) ?? []

  const formatEpgTime = (timestamp: number) => new Date(timestamp * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  useEffect(() => {
    if (screen !== 'player' || !streamUrl || !tizenPlayer || !playerStageRef.current) return

    const bounds = playerStageRef.current.getBoundingClientRect()
    setPlayerState('connecting')
    try {
      startTizenPlayer(
        tizenPlayer,
        streamUrl,
        bounds,
        () => {
          setPlayerState('error')
          setPlayerError('Поток недоступен через Samsung AVPlay')
        },
        () => setPlayerState('playing'),
      )
    } catch {
      setPlayerState('error')
      setPlayerError('Не удалось запустить Samsung AVPlay')
    }

    return () => stopTizenPlayer(tizenPlayer)
  }, [screen, streamUrl, tizenPlayer])

  return (
    <main className={`app-shell screen-${screen}`}>
      <div className="noise" />
      <header className="topbar">
        <img className="brand-logo" src="/tele-logo.png" alt="Телевизионное интернет телевидение" />
        <div className="brand-copy">
          <strong>TELE TV</strong>
          <span>Телевидение без лишнего шума</span>
        </div>
        <div className="status-cluster">
          {screen !== 'login' && username && <span className="status-user">{username}</span>}
          {screen !== 'login' && <button className="logout-button" type="button" onClick={logout} aria-label="Выйти">↪</button>}
          <span className="clock">{currentTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="date-block"><strong>{formatHeaderDate(currentTime)}</strong><small>{weekday}</small></span>
        </div>
      </header>

      {screen === 'login' && (
        <section className="login-layout">
          <div className="login-copy">
          </div>
          <form className={`login-panel ${focusTarget === 'login' ? 'is-focused' : ''}`} onSubmit={submitLogin}>
            <img className="login-logo" src="/tele-logo.png" alt="Tele TV" />
            <h2>Вход в систему</h2>
            <label>ЛОГИН<input name="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Номер договора" autoComplete="username" /></label>
            <label>ПАРОЛЬ<input name="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="••••••••" autoComplete="current-password" /></label>
            {loginError && <p className="error-note">{loginError}</p>}
            <button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? 'Подключение...' : 'Войти'} <span>Enter ↵</span></button>
          </form>
        </section>
      )}

      {screen === 'channels' && (
        <section className="channels-layout">
          {recentChannels.length > 0 && (
            <section className="recent-channels" aria-label="Последние просмотренные каналы">
              <div className="recent-heading"><span className="eyebrow">ПОСЛЕДНИЕ ПРОСМОТРЕННЫЕ</span></div>
              <div className="recent-channel-list">
                {recentChannels.map((channel) => (
                  <button key={channel.id} className={`recent-channel ${focusTarget === 'recent' && selectedRecentChannel?.id === channel.id ? 'is-selected' : ''} ${focusTarget === 'recent' && selectedRecentChannel?.id === channel.id ? 'is-focused' : ''}`} onClick={() => openChannel(channel)} aria-label={channel.name}>
                    <span className="channel-logo">
                      {channel.logo ? <img src={channel.logo} alt="" /> : channel.number}
                    </span>
                    <strong>{channel.name}</strong>
                  </button>
                ))}
              </div>
            </section>
          )}
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
            {visibleChannels.length === 0 ? (
              <p className="empty-state">В этой категории нет доступных каналов</p>
            ) : visibleChannels.map((channel) => (
              <button key={channel.id} className={`channel-card ${focusTarget === 'channels' && selectedChannel.id === channel.id ? 'is-selected' : ''} ${focusTarget === 'channels' && selectedChannel.id === channel.id ? 'is-focused' : ''}`} onClick={() => openChannel(channel)}>
               {(() => {
                 const programme = currentEpgByChannel.get(channel.id)
                 return (
                   <>
                     <span className="channel-logo">
                       {channel.logo ? <img src={channel.logo} alt="" onError={(event) => { event.currentTarget.hidden = true }} /> : channel.number}
                     </span>
                     <span className="channel-info"><strong>{channel.name}</strong><small>{programme?.title ?? channel.programme}</small></span>
                     <span className="channel-time">{programme ? formatEpgTime(programme.start) : channel.time}</span>
                   </>
                 )
               })()}
             </button>
            ))}
          </div>
          <aside className="now-playing">
            <span className="eyebrow">ВЫБРАННЫЙ КАНАЛ</span>
            <div className="now-preview" style={{ background: `linear-gradient(135deg, ${selectedChannel.color}, #101820)` }}><span>{selectedChannel.number}</span><i>ON AIR</i></div>
            <strong>{selectedChannel.name}</strong>
            {selectedEpg.length > 0 ? <div className="epg-list">{selectedEpg.slice(0, 4).map((item) => <div className="epg-item" key={item.eventId}><span>{formatEpgTime(item.start)} {item.ageRating > 0 ? `· ${item.ageRating}+` : ''}</span><strong>{item.title}</strong>{item.description && <small>{item.description}</small>}</div>)}</div> : <p>Программа передач недоступна</p>}
            <button className="guide-button" type="button" onClick={() => setScreen('guide')}>Программа <span>G</span></button>
          </aside>
        </section>
      )}

      {screen === 'guide' && (
        <section className="guide-layout">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ПРОГРАММА ПЕРЕДАЧ</span>
              <h1>{selectedChannel.name}</h1>
            </div>
            <div className="remote-hint"><span>G</span> открыть · <span>Esc</span> назад</div>
          </div>
          <div className="guide-channel">
            <span className="channel-logo" style={{ background: selectedChannel.color }}>{selectedChannel.number}</span>
            <div><strong>Канал {selectedChannel.number}</strong><small>Полная программа передач</small></div>
          </div>
          {selectedEpg.length > 0 ? (
            <div className="guide-list">
              {selectedEpg.map((item) => (
                <article className={`guide-item ${item.start <= now && item.stop > now ? 'is-current' : ''}`} key={item.eventId}>
                  <time>{formatEpgTime(item.start)} – {formatEpgTime(item.stop)}</time>
                  <div><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}</div>
                  {item.ageRating > 0 && <span className="guide-rating">{item.ageRating}+</span>}
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">Программа передач для этого канала недоступна</p>
          )}
        </section>
      )}

      {screen === 'player' && (
        <section className="player-layout">
          <div ref={playerStageRef} className="player-stage" style={{ background: `radial-gradient(circle at 70% 30%, ${selectedChannel.color}, transparent 38%), #0b1218` }}>
            {tizenPlayer && streamUrl && !playerError ? (
              <div className="native-player-surface" aria-label="Samsung AVPlay" />
            ) : streamUrl && !playerError ? (
              <video className="live-video" src={streamUrl} autoPlay controls playsInline onPlaying={() => setPlayerState('playing')} onWaiting={() => setPlayerState('connecting')} onError={() => { setPlayerState('error'); setPlayerError('Поток недоступен в браузере телевизора') }} />
            ) : (
              <div className="player-placeholder"><span>{selectedChannel.number}</span><strong>{selectedChannel.name}</strong><small>{playerError || 'Демо-поток готов к подключению'}</small></div>
            )}
            {playerMenuVisible && (
              <aside className={`player-side-menu ${playerEpgVisible ? 'with-epg' : ''}`}>
                <div className="player-menu-list">
                  <strong className="player-menu-title">КАНАЛЫ</strong>
                  {playerChannels.map((channel, index) => (
                    (() => {
                      const programme = currentEpgByChannel.get(channel.id)
                      const progress = programme
                        ? Math.min(100, Math.max(0, ((now - programme.start) / Math.max(1, programme.stop - programme.start)) * 100))
                        : 0
                      return (
                        <button
                          key={channel.id}
                          className={`${playerMenuIndex === index ? 'is-focused' : ''} ${selectedChannel.id === channel.id ? 'is-current' : ''}`}
                          style={{ background: `linear-gradient(90deg, rgba(201, 224, 235, .5) ${progress}%, transparent ${progress}%)` }}
                          onClick={() => openChannel(channel)}
                        >
                      <span>{channel.number}</span>
                      <span className="player-menu-channel-name">{channel.name}</span>
                      {programme && <small className="programme-title">{programme.title}</small>}
                        </button>
                      )
                    })()
                  ))}
                </div>
                {playerEpgVisible && (
                  <div className="player-epg-panel">
                    <div className="player-epg-heading">
                      <strong>{playerMenuChannel.name}</strong>
                      <small>ПРОГРАММА ПЕРЕДАЧ</small>
                    </div>
                    {playerMenuEpg.length > 0 ? playerMenuEpg.map((item) => (
                      <article className={item.start <= now && item.stop > now ? 'is-current' : ''} key={item.eventId}>
                        <time>{formatEpgTime(item.start)}</time>
                        <strong>{item.title}</strong>
                        {item.description && <small>{item.description}</small>}
                      </article>
                    )) : <p>Программа недоступна</p>}
                  </div>
                )}
              </aside>
            )}
            {!playerMenuVisible && playerInfoVisible && (
              <div
                className="player-channel-toast"
                style={{ background: `linear-gradient(90deg, rgba(201, 224, 235, .5) ${programmeProgress}%, rgba(4, 10, 14, .78) ${programmeProgress}%)` }}
              >
                <span className="eyebrow">СЕЙЧАС В ЭФИРЕ</span>
                <strong>{selectedChannel.number} · {selectedChannel.name}</strong>
                <small className="programme-title">{currentProgramme?.title ?? selectedChannel.programme}</small>
                {currentProgramme && <time>{formatEpgTime(currentProgramme.start)} – {formatEpgTime(currentProgramme.stop)}</time>}
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="footer"><span>TELE TV · 2026</span><span>Доступно на LG webOS и Samsung Tizen</span></footer>
    </main>
  )
}

export default App
