import { useState, useEffect, useRef } from 'react'
import './App.css'

// MP3s and their manifest live in public/, so Netlify serves them as static files
const MUSIC_DIR = `${import.meta.env.BASE_URL}music/shpacones/`

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

// The listed cover first, then the same name with other image extensions,
// so "cover.jpg" in the manifest still finds cover.png (and vice versa)
function artworkCandidates(cover) {
  const match = cover.match(/^(.*)\.([a-z0-9]+)$/i)
  const base = match ? match[1] : cover
  const ext = match?.[2].toLowerCase()
  const names = [
    ...(match ? [cover] : []),
    ...IMAGE_EXTENSIONS.filter(e => e !== ext).map(e => `${base}.${e}`),
  ]
  return names.map(name => MUSIC_DIR + encodeURIComponent(name))
}

function imageLoads(url) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })
}

async function loadManifest() {
  try {
    const res = await fetch(`${MUSIC_DIR}tracks.json`, { cache: 'no-cache' })
    if (!res.ok) return []
    const { artist, artwork, tracks } = await res.json()
    if (!Array.isArray(tracks)) return []

    return tracks
      .filter(t => t && typeof t.file === 'string' && t.file.trim())
      .map(t => {
        const cover = t.artwork ?? artwork
        return {
          platform: 'mp3',
          file: t.file,
          title: t.title || t.file.replace(/\.mp3$/i, ''),
          artist: t.artist ?? artist ?? '',
          src: MUSIC_DIR + encodeURIComponent(t.file),
          artwork: cover ? artworkCandidates(cover) : [],
        }
      })
  } catch {
    // Missing or malformed manifest — the track picker simply shows no tracks
    return []
  }
}

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
  // Local tracks use the first cover candidate that actually exists
  if (source.platform === 'mp3') {
    for (const url of source.artwork) {
      if (await imageLoads(url)) return url
    }
    return null
  }

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

// Identity of a source: Spotify (type+id), YouTube (videoId) or MP3 (src)
function sourceKey(source) {
  if (!source) return ''
  return [source.platform, source.type, source.id, source.videoId, source.src].join('|')
}

function audioErrorMessage(track, err) {
  if (err?.name === 'NotAllowedError') return 'The browser blocked playback. Tap Play again.'
  return `Couldn't play “${track.title}”. Check that ${track.file} is in public/music/shpacones/.`
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
  const [tracks, setTracks] = useState([])
  const [audioError, setAudioError] = useState(null)
  const audioRef = useRef(null)

  const isMp3 = embed?.platform === 'mp3'

  useEffect(() => {
    loadManifest().then(setTracks)
  }, [])

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
  // cover Spotify (type+id), YouTube (videoId) and MP3 (src) identity fields
  }, [embed?.platform, embed?.id, embed?.videoId, embed?.src])

  function changeSource(next) {
    setEmbed(next)
    // Typing in the link box re-parses the same source on every keystroke
    if (sourceKey(next) === sourceKey(embed)) return
    setSpinning(false)
    setAudioError(null)
    // Switching away from (or between) MP3s must silence the previous track
    audioRef.current?.pause()
  }

  function handleTrackSelect(file) {
    setLink('')
    changeSource(tracks.find(t => t.file === file) ?? null)
  }

  function handlePlayStop() {
    if (!isMp3) { setSpinning(s => !s); return }

    const audio = audioRef.current
    if (!audio.paused) {
      audio.pause()
      audio.currentTime = 0
      return
    }
    setAudioError(null)
    audio.play().catch(err => {
      // AbortError just means a newer load/pause interrupted this play() call
      if (err.name !== 'AbortError') setAudioError(audioErrorMessage(embed, err))
    })
  }

  function handleAudioError() {
    setSpinning(false)
    setAudioError(audioErrorMessage(embed))
  }

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
              changeSource(parseUrl(e.target.value))
            }}
          />
        </div>

        <div className="track-row">
          <select
            className="track-select"
            aria-label="Choose a Shpacones track"
            value={isMp3 ? embed.file : ''}
            onChange={e => handleTrackSelect(e.target.value)}
            disabled={tracks.length === 0}
          >
            <option value="">
              {tracks.length ? 'Or choose a Shpacones track…' : 'No Shpacones tracks yet'}
            </option>
            {tracks.map(t => (
              <option key={t.file} value={t.file}>{t.title}</option>
            ))}
          </select>
        </div>

        <div className="controls-row">
          <button
            className={`spin-btn${spinning ? ' playing' : ''}`}
            onClick={handlePlayStop}
            disabled={!embed}
          >
            <span className="spin-icon">{spinning ? '■' : '▶'}</span>
            {spinning ? 'Stop' : 'Play'}
          </button>
          <button className="share-btn" onClick={handleShare}>
            {copied ? '✓  Copied' : '↗  Share'}
          </button>
        </div>

        <audio
          ref={audioRef}
          src={isMp3 ? embed.src : undefined}
          preload="metadata"
          onPlaying={() => setSpinning(true)}
          onPause={() => setSpinning(false)}
          onEnded={() => setSpinning(false)}
          onError={() => { if (isMp3) handleAudioError() }}
        />

        <div className={[
          'player-zone',
          embed && !isMp3 ? 'has-embed' : '',
          embed?.platform === 'youtube' ? 'youtube' : '',
        ].filter(Boolean).join(' ')}>
          {isMp3 ? (
            <div className="track-now">
              <span className="shortlink-tag">{embed.artist || 'Now playing'}</span>
              <span className="track-title">{embed.title}</span>
              {audioError && <span className="track-error" role="alert">{audioError}</span>}
            </div>
          ) : embed?.platform === 'youtube' ? (
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
