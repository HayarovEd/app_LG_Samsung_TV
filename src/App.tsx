import { FormEvent, useEffect, useMemo, useState } from 'react'
import { authorize, getChannels, isApiConfigured } from './api'

type Screen = 'login' | 'channels' | 'player'
type FocusTarget = 'login' | 'categories' | 'channels'
type Channel = { id: string; name: string; number: string; url?: string; category: string; programme: string; time: string; color: string }

const categories = ['Все каналы', 'Новости', 'Кино', 'Познавательное', 'Детские']
const demoChannels: Channel[] = [
  ['1', 'Первый канал', '01', 'Новости', 'Время', '21:00', '#d94b39'], ['2', 'Россия 1', '02', 'Новости', 'Вести', '20:00', '#3478b8'], ['3', 'Пятый канал', '05', 'Кино', 'След', '20:45', '#7c5aaa'], ['4', 'Победа', '12', 'Кино', 'Т-34', '21:30', '#bb7a3c'], ['5', 'Наука', '24', 'Познавательное', 'Космос рядом', '22:10', '#2d8b83'], ['6', 'Мульт', '31', 'Детские', 'Ми-ми-мишки', '21:15', '#e08b4c'],
].map(([id, name, number, category, programme, time, color]) => ({ id, name, number, category, programme, time, color }))

function App() {
  const [screen, setScreen] = useState<Screen>('login')
  const [focusTarget, setFocusTarget] = useState<FocusTarget>('login')
  const [selectedCategory, setSelectedCategory] = useState(categories[0])
  const [channelList, setChannelList] = useState(demoChannels)
  const [selectedChannel, setSelectedChannel] = useState(demoChannels[0])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [playerError, setPlayerError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const visibleChannels = useMemo(() => selectedCategory === categories[0] ? channelList : channelList.filter(channel => channel.category === selectedCategory), [channelList, selectedCategory])

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoginError('')
    if (!isApiConfigured) { setScreen('channels'); setFocusTarget('categories'); return }
    setIsLoading(true)
    try {
      await authorize(username, password)
      const remoteChannels = await getChannels(username, password)
      const colors = ['#d94b39', '#3478b8', '#7c5aaa', '#bb7a3c', '#2d8b83', '#e08b4c']
      const mapped = remoteChannels.map((channel, index) => ({ id: channel.id, name: channel.name, number: channel.number, url: channel.url, category: categories[0], programme: 'Прямой эфир', time: 'сейчас', color: colors[index % colors.length] }))
      setChannelList(mapped); setSelectedChannel(mapped[0] ?? demoChannels[0]); setScreen('channels'); setFocusTarget('categories')
    } catch (error) { setLoginError(error instanceof Error ? error.message : 'Не удалось подключиться к серверу') }
    finally { setIsLoading(false) }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Backspace') { event.preventDefault(); if (screen === 'player') { setScreen('channels'); setFocusTarget('channels') } else if (screen === 'channels') setFocusTarget('categories'); return }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); if (screen === 'channels' && focusTarget === 'categories') { const index = categories.indexOf(selectedCategory) + (event.key === 'ArrowRight' ? 1 : -1); if (categories[index]) setSelectedCategory(categories[index]) } else if (screen === 'channels' && focusTarget === 'channels') setFocusTarget('categories'); return }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); if (screen !== 'login') setFocusTarget(focusTarget === 'categories' ? 'channels' : 'categories'); return }
      if (event.key === 'Enter') { event.preventDefault(); if (screen === 'login') document.querySelector<HTMLFormElement>('.login-panel')?.requestSubmit(); else if (screen === 'channels' && focusTarget === 'categories') setFocusTarget('channels'); else if (screen === 'channels') setScreen('player') }
    }
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown)
  }, [focusTarget, screen, selectedCategory])

  const openChannel = (channel: Channel) => { setSelectedChannel(channel); setPlayerError(''); setScreen('player'); setFocusTarget('channels') }
  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">T<span>V</span></div><div className="brand-copy"><strong>TELE TV</strong><span>Телевидение без лишнего шума</span></div><div className="status-cluster"><span className="live-dot" /> LIVE <span className="clock">21:42</span></div></header>
    {screen === 'login' && <section className="login-layout"><div className="login-copy"><span className="eyebrow">ДОМАШНИЙ ЭКРАН</span><h1>Смотрите<br /><em>свое телевидение.</em></h1><p>Каналы, прямой эфир и программа передач в одном спокойном пространстве.</p><div className="signal-line"><span /> Сигнал стабильный</div></div><form className={`login-panel ${focusTarget === 'login' ? 'is-focused' : ''}`} onSubmit={submitLogin}><div className="panel-kicker">ВХОД В АККАУНТ</div><h2>Добрый вечер</h2><p className="panel-note">Введите данные абонента, чтобы продолжить.</p><label>ЛОГИН<input value={username} onChange={event => setUsername(event.target.value)} placeholder="Номер договора" /></label><label>ПАРОЛЬ<input value={password} onChange={event => setPassword(event.target.value)} type="password" placeholder="••••••••" /></label>{loginError && <p className="error-note">{loginError}</p>}<button className="primary-button" disabled={isLoading}>{isLoading ? 'Подключение...' : 'Войти'} <span>Enter ↵</span></button><button className="ghost-button" type="button" onClick={() => setScreen('channels')}>Демо-режим</button></form></section>}
    {screen === 'channels' && <section className="channels-layout"><div className="section-heading"><div><span className="eyebrow">ПРЯМОЙ ЭФИР</span><h1>Каналы</h1></div><div className="remote-hint"><span>← →</span> разделы <span>↑ ↓</span> фокус <span>Enter</span> открыть</div></div><nav className={`category-strip ${focusTarget === 'categories' ? 'is-focused' : ''}`}>{categories.map(category => <button key={category} className={selectedCategory === category ? 'active' : ''} onClick={() => { setSelectedCategory(category); setFocusTarget('categories') }}>{category}</button>)}</nav><div className="channel-grid">{visibleChannels.map(channel => <button key={channel.id} className={`channel-card ${focusTarget === 'channels' && selectedChannel.id === channel.id ? 'is-focused' : ''}`} onClick={() => openChannel(channel)}><span className="channel-logo" style={{ background: channel.color }}>{channel.number}</span><span className="channel-info"><strong>{channel.name}</strong><small>{channel.programme}</small></span><span className="channel-time">{channel.time}</span></button>)}</div><aside className="now-playing"><span className="eyebrow">ВЫБРАННЫЙ КАНАЛ</span><div className="now-preview" style={{ background: `linear-gradient(135deg, ${selectedChannel.color}, #101820)` }}><span>{selectedChannel.number}</span><i>ON AIR</i></div><strong>{selectedChannel.name}</strong><p>{selectedChannel.programme} <span>сейчас</span></p></aside></section>}
    {screen === 'player' && <section className="player-layout"><div className="player-stage" style={{ background: `radial-gradient(circle at 70% 30%, ${selectedChannel.color}, transparent 38%), #0b1218` }}>{selectedChannel.url && !playerError ? <video className="live-video" src={selectedChannel.url} autoPlay controls playsInline onError={() => setPlayerError('Поток недоступен в браузере телевизора')} /> : <div className="player-placeholder"><span>{selectedChannel.number}</span><strong>{selectedChannel.name}</strong><small>{playerError || 'Демо-поток готов к подключению'}</small></div>}<div className="player-controls"><span className="play-icon">▶</span><div><strong>{selectedChannel.programme}</strong><small>Прямой эфир · {selectedChannel.time}</small></div><span className="quality">HD</span></div></div><div className="player-details"><span className="eyebrow">СЕЙЧАС В ЭФИРЕ</span><h1>{selectedChannel.name}</h1><p>{selectedChannel.programme}</p><button className="primary-button" onClick={() => setScreen('channels')}>Вернуться к каналам <span>Back</span></button></div></section>}
    <footer className="footer"><span>TELE TV · 2026</span><span>Доступно на LG webOS и Samsung Tizen</span></footer>
  </main>
}

export default App
