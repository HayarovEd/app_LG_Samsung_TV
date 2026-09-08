export type ApiChannel = {
  id: string
  name: string
  number: string
  url: string
  logo?: string
  categoryIds: string[]
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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

function requireApiBaseUrl() {
  if (!apiBaseUrl) throw new Error('VITE_API_BASE_URL is not configured')
  return apiBaseUrl
}

function authHeader(username: string, password: string) {
  return `Basic ${btoa(`${username}:${password}`)}`
}

export async function authorize(username: string, password: string) {
  const response = await fetch(`${requireApiBaseUrl()}/login`, {
    headers: { Authorization: authHeader(username, password) },
  })
  if (!response.ok) throw new Error(response.status === 403 ? 'Неверный логин или пароль' : `Ошибка авторизации: ${response.status}`)
}

export async function getChannels(username: string, password: string): Promise<ApiChannel[]> {
  const response = await fetch(`${requireApiBaseUrl()}/api/channel/grid`, {
    method: 'POST',
    headers: { Authorization: authHeader(username, password), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ limit: '500', sort: 'number' }),
  })
  if (!response.ok) throw new Error(response.status === 403 ? 'Сессия авторизации истекла' : `Ошибка загрузки каналов: ${response.status}`)
  const payload = await response.json() as ChannelGridResponse
  return payload.entries.map(channel => ({
    id: channel.uuid,
    name: channel.name,
    number: String(channel.number).padStart(2, '0'),
    url: `${requireApiBaseUrl()}/stream/channel/${channel.uuid}`,
    logo: channel.icon_public_url ?? undefined,
    categoryIds: channel.tags ?? [],
  }))
}

export const isApiConfigured = Boolean(apiBaseUrl)
