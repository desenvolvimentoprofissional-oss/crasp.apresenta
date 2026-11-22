type PreviewCallbacks = {
  onReady: () => void
  onEnd: () => void
  onUnavailable: () => void
}

const waitingLimit = 15_000
const playerHost = /^player-[a-z0-9-]+\.tv\.pandavideo\.com\.br$/

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function readMessage(data: unknown) {
  if (typeof data !== 'string') return asRecord(data)
  if (data.length > 128_000) return
  try {
    return asRecord(JSON.parse(data))
  } catch {
    return undefined
  }
}

function seconds(value: unknown) {
  const count = typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : value
  return typeof count === 'number' && Number.isFinite(count) && count >= 0 ? count : undefined
}

function currentTime(message: Record<string, unknown>) {
  switch (message.message) {
    case 'panda_timeupdate': return seconds(message.currentTime)
    case 'panda_allData': return seconds(asRecord(message.playerData)?.currentTime)
    case 'panda_seek':
    case 'panda_seeking':
    case 'panda_seeked': return seconds(message.currentTime) ?? seconds(message.time)
    default: return undefined
  }
}

function pandaAddress(frame: HTMLIFrameElement): URL | undefined {
  try {
    const parsed = new URL(frame.src)
    if (parsed.protocol === 'https:' && !parsed.port && !parsed.username && !parsed.password &&
      playerHost.test(parsed.hostname)) return parsed
  } catch {
    return undefined
  }
}

export function watchPandaPreview(
  frame: HTMLIFrameElement,
  limitSeconds: number,
  callbacks: PreviewCallbacks,
): () => void {
  const address = pandaAddress(frame)
  const view = frame.ownerDocument.defaultView
  if (!address || !view || !Number.isFinite(limitSeconds) || limitSeconds <= 0) {
    callbacks.onUnavailable()
    return () => {}
  }

  const videoId = address.searchParams.get('v')
  let ready = false
  let stopped = false
  const timeout = view.setTimeout(() => settle(callbacks.onUnavailable), waitingLimit)

  function stop() {
    if (stopped) return
    stopped = true
    view!.clearTimeout(timeout)
    view!.removeEventListener('message', receive)
  }

  function settle(callback: () => void) {
    if (stopped) return
    stop()
    callback()
  }

  function receive(event: MessageEvent<unknown>) {
    if (stopped || event.origin !== address!.origin || !event.source || event.source !== frame.contentWindow) return
    const message = readMessage(event.data)
    if (!message || (videoId && typeof message.video === 'string' && message.video !== videoId)) return
    if (message.message === 'panda_error') return settle(callbacks.onUnavailable)
    const time = currentTime(message)
    if (time === undefined) return
    if (time >= limitSeconds) return settle(callbacks.onEnd)
    if (ready) return
    ready = true
    view!.clearTimeout(timeout)
    callbacks.onReady()
  }

  view.addEventListener('message', receive)
  return stop
}
