export type NativePlayer = {
  open(url: string): void
  setDisplayRect(left: number, top: number, width: number, height: number): void
  setListener(listener: { onbufferingcomplete?: () => void; onerror?: (error: unknown) => void }): void
  prepareAsync(onSuccess: () => void, onError: (error: unknown) => void): void
  play(): void
  stop(): void
  close(): void
}

declare global {
  interface Window {
    webapis?: {
      avplay?: NativePlayer
    }
  }
}

export function getTizenPlayer() {
  return window.webapis?.avplay ?? null
}

export function startTizenPlayer(
  player: NativePlayer,
  url: string,
  bounds: { left: number; top: number; width: number; height: number },
  onError: (error: unknown) => void,
) {
  player.open(url)
  player.setDisplayRect(bounds.left, bounds.top, bounds.width, bounds.height)
  player.setListener({ onerror: onError })
  player.prepareAsync(() => player.play(), onError)
}

export function stopTizenPlayer(player: NativePlayer) {
  try {
    player.stop()
  } finally {
    player.close()
  }
}
