

export function buildAuthenticatedStreamUrl(url: string, username: string, password: string) {
  const streamUrl = new URL(url)
  streamUrl.username = username
  streamUrl.password = password
  return streamUrl.toString()
}
