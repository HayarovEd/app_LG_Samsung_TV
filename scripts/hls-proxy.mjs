import { createServer } from 'node:http'
import { mkdir, readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const port = Number(process.env.HLS_PROXY_PORT || 8787)
const sourceBaseUrl = (process.env.HLS_SOURCE_URL || 'http://iptv.teletvperm.ru:9981')
  .replace(/\/$/, '')
const ffmpegPath = process.env.FFMPEG_PATH || 'C:\\Users\\Impuls\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-essentials_build\\bin\\ffmpeg.exe'
const sessions = new Map()

async function readWhenReady(filePath, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      return await readFile(filePath)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  return null
}

async function startSession(channelId, authorization) {
  const id = randomUUID()
  const directory = join(tmpdir(), `tele-tv-hls-${id}`)
  await mkdir(directory, { recursive: true })
  const inputUrl = `${sourceBaseUrl}/stream/channel/${encodeURIComponent(channelId)}`
  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-fflags', '+discardcorrupt+genpts',
    '-analyzeduration', '10M',
    '-probesize', '10M',
    '-err_detect', 'ignore_err',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '2',
    ...(authorization ? ['-headers', `Authorization: ${authorization}\r\n`] : []),
    '-i', inputUrl,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-sn',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-profile:v', 'main',
    '-pix_fmt', 'yuv420p',
    '-x264-params', 'repeat-headers=1:keyint=100:min-keyint=25:scenecut=0',
    '-force_key_frames', 'expr:gte(t,n_forced*4)',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-f', 'hls',
    '-hls_time', '4',
    '-hls_list_size', '6',
    '-hls_flags', 'delete_segments+append_list+independent_segments',
    join(directory, 'index.m3u8'),
  ]
  const process = spawn(ffmpegPath, args, { windowsHide: true })
  const session = { channelId, authorization, directory, process }
  sessions.set(id, session)
  process.stderr.on('data', (chunk) => console.error(`[ffmpeg:${channelId}] ${chunk.toString().trim()}`))
  process.on('close', () => {
    sessions.delete(id)
  })
  return { id, session }
}

function send(response, status, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  })
  response.end(body)
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`)
    const match = requestUrl.pathname.match(/^\/stream\/channel\/([^/]+)\/(index\.m3u8|[^/]+\.ts)$/)
    if (!match) {
      send(response, 404, 'Not found')
      return
    }

    const [, channelId, fileName] = match
    const authToken = requestUrl.searchParams.get('auth')
    const authorization = request.headers.authorization || (authToken ? `Basic ${authToken}` : undefined)
    console.log(`[hls] ${channelId} ${fileName} authorization=${Boolean(authorization)}`)
    let session = [...sessions.values()].find((item) => item.channelId === channelId && (!authorization || item.authorization === authorization))
    if (!session) {
      const started = await startSession(channelId, authorization)
      session = started.session
    }

    const filePath = join(session.directory, fileName)
    const file = await readWhenReady(filePath)
    if (!file) {
      send(response, 504, 'HLS stream did not become ready')
      return
    }
    if (fileName.endsWith('.m3u8')) {
      const playlist = file.toString('utf8').replace(
        /^(index\d+\.ts)$/gm,
        (_, segmentName) => `${segmentName}${authToken ? `?auth=${encodeURIComponent(authToken)}` : ''}`,
      )
      send(response, 200, playlist, 'application/vnd.apple.mpegurl')
      return
    }
    send(response, 200, file, 'video/mp2t')
  } catch (error) {
    console.error(error)
    send(response, 500, 'HLS proxy failed')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`HLS proxy listening on http://127.0.0.1:${port}`)
})
