import { useState, useEffect } from 'react'
import './App.css'

const SPOTIFY_TYPES = ['track', 'album', 'playlist', 'artist', 'episode', 'show']

function parseSpotifyUrl(raw) {
  if (!raw) return null

  // Spotify URI format: spotify:track:ID
  if (raw.startsWith('spotify:')) {
    const [, type, id] = raw.split(':')
    if (type && id && SPOTIFY_TYPES.includes(type)) return { platform: 'spotify', type, id }
    return null
  }

  try {
    const url = new URL(raw)
    if (!url.hostname.endsWith('spotify.com')) return null

    // Pathname is either /type/id or /embed/type/id
    const parts = url.pathname.split('/').filter(Boolean)
    const offset = parts[0] === 'embed' ? 1 : 0
    const type = parts[offset]
    const id = parts[offset + 1]
    if (!type || !id || !SPOTIFY_TYPES.includes(type)) return null

    return { platform: 'spotify', type, id }
  } catch {
    return null
  }
}

function parseYouTubeUrl(raw) {
  try {
    const url = new URL(raw)
    const host = url.hostname.replace('www.', '')

    // youtu.be/VIDEO_ID
    if (host === 'youtu.be') {
      const videoId = url.pathname.slice(1).split('/')[0]
      return videoId ? { platform: 'youtube', videoId } : null
    }

    // youtube.com/watch?v=VIDEO_ID  or  music.youtube.com/watch?v=VIDEO_ID
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      const videoId = url.searchParams.get('v')
      return videoId ? { platform: 'youtube', videoId } : null
    }

    return null
  } catch {
    return null
  }
}

function parseUrl(raw) {
  if (!raw) return null
  return parseSpotifyUrl(raw) ?? parseYouTubeUrl(raw)
}

async function fetchArtwork(source) {
  if (source.platform === 'youtube') {
    console.log('[KansoRoom] source: youtube, videoId:', source.videoId)
    const { videoId } = source
    const candidates = [
      `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    ]
    for (const url of candidates) {
      // YouTube returns a 120×90 placeholder when a resolution doesn't exist
      const resolved = await new Promise(resolve => {
        const img = new Image()
        img.onload = () => resolve(img.naturalWidth > 120 ? url : null)
        img.onerror = () => resolve(null)
        img.src = url
      })
      if (resolved) {
        console.log('[KansoRoom] artworkUrl:', resolved)
        return resolved
      }
    }
    // Last-resort fallback — hqdefault always exists even if it has black bars
    console.log('[KansoRoom] artworkUrl: fallback hqdefault')
    return candidates[1]
  }
  // Spotify: use the public oEmbed endpoint (no API key required)
  try {
    console.log('[KansoRoom] source: spotify, id:', source.id)
    const spotifyUrl = `https://open.spotify.com/${source.type}/${source.id}`
    const res = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`
    )
    if (!res.ok) return null
    const { thumbnail_url } = await res.json()
    console.log('[KansoRoom] artworkUrl:', thumbnail_url)
    return thumbnail_url ?? null
  } catch {
    return null
  }
}

function VinylRecord({ isSpinning, artworkUrl }) {
  return (
    <div className="plinth">
      <div className="stage">
        <div className={`vinyl-glow${isSpinning ? ' active' : ''}`} />
        <div className="platter-ring" />
        <div className={`vinyl${isSpinning ? ' spinning' : ''}`}>
          {artworkUrl && (
            <img
              key={artworkUrl}
              src={artworkUrl}
              alt="Album artwork"
              className="vinyl-artwork"
            />
          )}
          <div className="vinyl-grooves" />
          <div className="vinyl-label">
            <div className="vinyl-label-shine" />
            {!artworkUrl && <span className="vinyl-label-text">KR</span>}
            <div className="vinyl-spindle" />
          </div>
          <div className="vinyl-sheen" />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [spinning, setSpinning] = useState(false)
  const [link, setLink] = useState('')
  const [embed, setEmbed] = useState(null)
  const [artworkUrl, setArtworkUrl] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!embed) { setArtworkUrl(null); return }
    let cancelled = false
    setArtworkUrl(null)

    fetchArtwork(embed).then(url => {
      if (!url || cancelled) return
      // Preload so the swap is instant with no flicker
      const img = new Image()
      img.src = url
      img.onload = () => { if (!cancelled) setArtworkUrl(url) }
    })

    return () => { cancelled = true }
  // cover both Spotify (type+id) and YouTube (videoId) identity fields
  }, [embed?.platform, embed?.id, embed?.videoId])

  useEffect(() => {
    setSpinning(false)
  }, [embed?.platform, embed?.id, embed?.videoId])

  function handleShare() {
    navigator.clipboard?.writeText('https://1dgj.com/kanso82')
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-pip" />
          KansoRoom
        </div>
      </header>

      <main className="main">
        <div className="col-left">
          <VinylRecord isSpinning={spinning} artworkUrl={artworkUrl} />
        </div>

        <div className="col-right">
        <div className="link-row">
          <input
            type="text"
            className="link-input"
            placeholder="Paste a Spotify, YouTube, or Apple Music link…"
            value={link}
            onChange={e => {
              setLink(e.target.value)
              setEmbed(parseUrl(e.target.value))
            }}
          />
        </div>

        <div className="controls-row">
          <button
            className={`spin-btn${spinning ? ' playing' : ''}`}
            onClick={() => setSpinning(s => !s)}
            disabled={!embed}
          >
            <span className="spin-icon">{spinning ? '■' : '▶'}</span>
            {spinning ? 'Stop' : 'Play'}
          </button>
          <button className="share-btn" onClick={handleShare}>
            {copied ? '✓  Copied' : '↗  Share'}
          </button>
        </div>

        <div className={[
          'player-zone',
          embed ? 'has-embed' : '',
          embed?.platform === 'youtube' ? 'youtube' : '',
        ].filter(Boolean).join(' ')}>
          {embed?.platform === 'youtube' ? (
            <div className="yt-wrapper">
              <iframe
                key={embed.videoId}
                title="YouTube video player"
                className="yt-embed"
                src={`https://www.youtube.com/embed/${embed.videoId}?autoplay=1&rel=0`}
                frameBorder="0"
                allowFullScreen
                allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                loading="lazy"
              />
            </div>
          ) : embed?.platform === 'spotify' ? (
            <iframe
              key={`${embed.type}/${embed.id}`}
              title={`Spotify ${embed.type} player`}
              className="spotify-embed"
              src={`https://open.spotify.com/embed/${embed.type}/${embed.id}?utm_source=generator&theme=0&autoplay=1`}
              height={embed.type === 'track' || embed.type === 'episode' ? 152 : 352}
              frameBorder="0"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          ) : /^(https?:|spotify:)/i.test(link.trim()) ? (
            <span className="player-zone-hint">Supports Spotify and YouTube links.</span>
          ) : (
            <span className="player-zone-label">Embedded player will live here.</span>
          )}
        </div>

        <div className="shortlink-row">
          <span className="shortlink-tag">room link</span>
          <span className="shortlink-url">1dgj.com/kanso82</span>
        </div>
        </div>
      </main>

      <footer className="footer">
        KansoRoom · A quiet listening room
      </footer>
    </div>
  )
}
