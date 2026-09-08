export type ApiChannel = {
  id: string
  name: string
  number: string
  url: string
  logo?: string
  categoryIds: string[]
}

export type ApiCategory = { key: string; name: string }

export type ApiEpg = {
  eventId: number
  channelUuid: string
  channelName: string
  channelNumber: string
  title: string
  description: string | null
  start: number
  stop: number
  ageRating: number
}

type ChannelGridResponse = {
  entries: Array<{
    name: string
    number: number
    uuid: string
    icon_public_url?: string | null
    tags?: string[]
  }>
}

type EpgResponse = { entries: ApiEpg[]; totalCount: number }
type CategoryResponse = { entries: Array<{ key: string; val: string }> }

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
const requestTimeoutMs = 12000

function requireApiBaseUrl() {
  if (!apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL is not configured')
  }
  return apiBaseUrl
}

function authHeader(username: string, password: string) {
  return `Basic ${btoa(`${username}:${password}`)}`
}

async function request(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Сервер не отвечает. Проверьте подключение к сети')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function authorize(username: string, password: string) {
  const response = await request(`${requireApiBaseUrl()}/login`, {
    headers: { Authorization: authHeader(username, password) },
  })

  if (!response.ok) {
    throw new Error(response.status === 403 ? 'Неверный логин или пароль' : `Ошибка авторизации: ${response.status}`)
  }
}

export async function getChannels(username: string, password: string): Promise<ApiChannel[]> {
  const response = await request(`${requireApiBaseUrl()}/api/channel/grid`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(username, password),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ limit: '500', sort: 'number' }),
  })

  if (!response.ok) {
    throw new Error(response.status === 403 ? 'Сессия авторизации истекла' : `Ошибка загрузки каналов: ${response.status}`)
  }

  const payload = await response.json() as ChannelGridResponse
  return payload.entries.map((channel) => ({
    id: channel.uuid,
    name: channel.name,
    number: String(channel.number).padStart(2, '0'),
    url: `${requireApiBaseUrl()}/stream/channel/${channel.uuid}`,
    logo: channel.icon_public_url ?? undefined,
    categoryIds: channel.tags ?? [],
  }))
}

export async function getEpg(username: string, password: string): Promise<ApiEpg[]> {
  const response = await request(`${requireApiBaseUrl()}/api/epg/events/grid`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(username, password),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ dir: 'ASC', start: '0', limit: '300' }),
  })

  if (!response.ok) {
    throw new Error(response.status === 403 ? 'Сессия авторизации истекла' : `Ошибка загрузки программы: ${response.status}`)
  }

  return (await response.json() as EpgResponse).entries
}

export async function getCategories(username: string, password: string): Promise<ApiCategory[]> {
  const response = await request(`${requireApiBaseUrl()}/api/channeltag/list`, {
    headers: { Authorization: authHeader(username, password) },
  })
  if (!response.ok) throw new Error(`Ошибка загрузки категорий: ${response.status}`)
  return (await response.json() as CategoryResponse).entries
    .filter((category) => !['TV channels', 'SDTV'].includes(category.val))
    .map((category) => ({ key: category.key, name: category.val }))
}

export function buildAuthenticatedStreamUrl(url: string, username: string, password: string) {
  const streamUrl = new URL(url, window.location.origin)
  streamUrl.username = username
  streamUrl.password = password
  return streamUrl.toString()
}

export const isApiConfigured = Boolean(apiBaseUrl)
