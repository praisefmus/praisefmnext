// app/components/RadioPlayer.jsx
'use client';

import React, { useEffect, useRef, useState } from 'react';

export default function RadioPlayer() {
  // ---------- Config ----------
  const STREAM_URL = 'https://stream.zeno.fm/hvwifp8ezc6tv';
  const NOWPLAYING_API = 'https://api.zeno.fm/mounts/metadata/subscribe/hvwifp8ezc6tv';
  const LASTFM_API_KEY = '7744c8f90ee053fc761e0e23bfa00b89';
  const STREAM_LOGO_URL = '/logo-praisefm.webp'; // uses /public/logo-praisefm.webp on Vercel
  const LOGO_FALLBACK_SIZE = 260; // px
  const MAX_HISTORY = 6;

  // ---------- State & refs ----------
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [status, setStatus] = useState('Connecting...');
  const [currentTitle, setCurrentTitle] = useState('Loading...');
  const [currentArtist, setCurrentArtist] = useState('');
  const [currentSong, setCurrentSong] = useState('');
  const [coverUrl, setCoverUrl] = useState(STREAM_LOGO_URL);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('favorites') || '[]');
    } catch {
      return [];
    }
  });

  // for image fade/zoom key
  const [coverKey, setCoverKey] = useState(0);

  // ---------- Helpers ----------
  const isCommercial = (title = '') => {
    if (!title) return false;
    const keywords = [
      'commercial', 'advertisement', 'sponsor', 'spot',
      'publicidade', 'intervalo', 'break', 'jingle', 'comercial', 'anuncio', 'patrocinio'
    ];
    const lower = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return keywords.some(k => lower.includes(k));
  };

  const isValidCoverUrl = (url) => {
    return !!url && typeof url === 'string' && url.trim() !== '' && url.length > 10;
  };

  const fetchCoverArt = async (artist, song) => {
    // don't ask last.fm for commercials or blanks
    if (!artist || !song || isCommercial(song) || artist === 'Praise FM U.S.' ) return STREAM_LOGO_URL;
    try {
      const res = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(song)}&format=json`
      );
      const data = await res.json();
      const url = data?.track?.album?.image?.slice?.(-1)?.[0]?.['#text'] || '';
      return isValidCoverUrl(url) ? url : STREAM_LOGO_URL;
    } catch (e) {
      console.warn('Last.fm fetch failed', e);
      return STREAM_LOGO_URL;
    }
  };

  const pushToHistory = (song, artist, cover) => {
    const key = `${artist} - ${song}`;
    setHistory(prev => {
      const filtered = prev.filter(i => i.key !== key);
      const next = [{ key, song, artist, cover }, ...filtered];
      return next.slice(0, MAX_HISTORY);
    });
  };

  const toggleFavorite = (key) => {
    setFavorites(prev => {
      let copy = [...prev];
      const idx = copy.indexOf(key);
      if (idx === -1) copy.push(key);
      else copy.splice(idx, 1);
      localStorage.setItem('favorites', JSON.stringify(copy));
      return copy;
    });
  };

  // ---------- Image preload + validation ----------
  const tryUseCover = async (urlOrLogo) => {
    // if incoming url is invalid -> use logo
    if (!isValidCoverUrl(urlOrLogo) || urlOrLogo === STREAM_LOGO_URL) {
      setCoverUrl(STREAM_LOGO_URL);
      setCoverKey(k => k + 1);
      return;
    }
    // attempt to load image to ensure it resolves (onError fallback)
    return new Promise(resolve => {
      const img = new Image();
      let resolved = false;
      img.onload = () => {
        if (!resolved) {
          resolved = true;
          setCoverUrl(urlOrLogo);
          setCoverKey(k => k + 1);
          resolve(true);
        }
      };
      img.onerror = () => {
        if (!resolved) {
          resolved = true;
          setCoverUrl(STREAM_LOGO_URL);
          setCoverKey(k => k + 1);
          resolve(false);
        }
      };
      img.src = urlOrLogo;
      // safety timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          setCoverUrl(STREAM_LOGO_URL);
          setCoverKey(k => k + 1);
          resolve(false);
        }
      }, 4000);
    });
  };

  // ---------- Now Playing SSE ----------
  useEffect(() => {
    if (typeof window === 'undefined' || !('EventSource' in window)) {
      setStatus('SSE not supported.');
      return;
    }

    let es;
    try {
      es = new EventSource(NOWPLAYING_API);
    } catch (e) {
      console.warn('EventSource failed to open:', e);
      setStatus('Connection failed.');
      return;
    }

    es.onmessage = async (evt) => {
      try {
        const data = JSON.parse(evt.data);
        let title = (data.streamTitle || '').trim();
        if (!title || title.length < 2) title = 'Praise FM U.S. - Spot';
        const commercial = isCommercial(title);
        if (commercial) title = 'Praise FM U.S. - Spot';

        // split "Artist - Song" (some streams use that)
        const parts = title.split(' - ').map(p => p.trim()).filter(Boolean);
        const artist = parts[0] || 'Praise FM U.S.';
        const song = parts.length > 1 ? parts.slice(1).join(' - ') : (parts[0] || 'Live');

        setCurrentArtist(artist);
        setCurrentSong(song);
        setCurrentTitle(`${artist} - ${song}`);

        if (commercial) {
          setStatus('📢 Commercial');
          await tryUseCover(STREAM_LOGO_URL);
          pushToHistory(song, artist, STREAM_LOGO_URL);
          return;
        }

        // otherwise try to get cover from last.fm
        const cover = await fetchCoverArt(artist, song);
        await tryUseCover(cover || STREAM_LOGO_URL);
        pushToHistory(song, artist, cover || STREAM_LOGO_URL);
        setStatus('LIVE • Now Playing');
      } catch (err) {
        console.warn('SSE parse error', err);
        setCurrentTitle('Praise FM U.S. - Live');
        setCurrentArtist('Praise FM U.S.');
        setCurrentSong('Live');
        setStatus('LIVE');
        await tryUseCover(STREAM_LOGO_URL);
      }
    };

    es.onerror = () => {
      setStatus('Reconnecting...');
      // try reconnect logic: close + reopen after delay
      try {
        es.close();
      } catch {}
      setTimeout(() => {
        // re-run effect: easiest is to reload page or create new EventSource
        // but keep it simple: create new EventSource
        try {
          // create a fresh one
          const newEs = new EventSource(NOWPLAYING_API);
          es = newEs;
        } catch {}
      }, 10000);
    };

    return () => {
      try { es.close(); } catch {}
    };
  }, []);

  // ---------- Audio autoplay & setup ----------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.crossOrigin = 'anonymous';
    audio.src = STREAM_URL;
    audio.volume = volume;

    // attempt autoplay once
    audio.play()
      .then(() => {
        setPlaying(true);
        setStatus('LIVE • Now Playing');
      })
      .catch(() => {
        setPlaying(false);
        setStatus('Click play to listen');
      });

    return () => {
      try { audio.pause(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ---------- UI Handlers ----------
  const handlePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      setStatus('Paused');
    } else {
      try {
        await audio.play();
        setPlaying(true);
        setStatus('LIVE • Now Playing');
      } catch {
        setStatus('Failed to play — user interaction required');
      }
    }
  };

  const handleVolume = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    setStatus(`Volume: ${Math.round(v * 100)}%`);
  };

  const toggleFavForCurrent = () => {
    const key = `${currentArtist} - ${currentSong}`;
    toggleFavorite(key);
  };

  // ---------- Persist favorites to localStorage ----------
  useEffect(() => {
    try {
      localStorage.setItem('favorites', JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  // ---------- Utility render helpers ----------
  const isFavorited = (key) => favorites.includes(key);

  // ---------- Mark cover elements loaded class for fade ----------
  const coverImgRef = useRef(null);
  useEffect(() => {
    // whenever coverKey changes, we remove "loaded" class and wait for onLoad to add it back
    const el = coverImgRef.current;
    if (!el) return;
    el.classList.remove('loaded');
    // small timeout to allow transition reset
    const t = setTimeout(() => {
      // nothing here — onLoad handler will add 'loaded'
    }, 50);
    return () => clearTimeout(t);
  }, [coverKey]);

  // ---------- JSX ----------
  return (
    <>
      <style jsx>{`
        :root{
          --bg:#f3f5f7;
          --card:#fff;
          --muted:#6b7280;
          --accent:#ff527c;
          --shadow: 0 12px 30px rgba(15,23,42,0.06);
        }

        .player-wrap{
          max-width:1100px;
          margin:40px auto;
          padding:28px;
          background:var(--card);
          border-radius:18px;
          box-shadow:var(--shadow);
          display:flex;
          flex-direction:column;
          gap:22px;
        }

        @media(min-width:900px){
          .player-wrap{flex-direction:row; align-items:flex-start; padding:40px; gap:36px;}
        }

        .left {
          flex:1;
          display:flex;
          flex-direction:column;
          gap:18px;
          align-items:center;
          text-align:center;
        }

        @media(min-width:900px){
          .left{align-items:flex-start;text-align:left;}
        }

        .station-title{
          font-size:1.5rem;
          font-weight:800;
          color:var(--accent);
        }

        .station-sub{
          color:var(--muted);
          margin-top:4px;
          font-size:0.95rem;
        }

        .cover-wrap{
          width:260px;
          height:260px;
          border-radius:50%;
          overflow:hidden;
          margin:8px 0 0;
          box-shadow: 0 10px 30px rgba(20,20,20,0.06);
          display:flex;
          align-items:center;
          justify-content:center;
          background:linear-gradient(180deg,#f2f2f2,#e9eaeb);
          transition: transform .35s ease;
        }

        .cover-img{
          width:100%;
          height:100%;
          object-fit:cover;
          display:block;
          transform: scale(1);
          opacity:0;
          transition: opacity .65s ease, transform .65s ease;
        }

        .cover-img.loaded{
          opacity:1;
          transform: scale(1.03);
        }

        .info{
          margin-top:6px;
        }

        .now-text{
          color:var(--muted);
          font-size:0.9rem;
        }

        .title{
          font-weight:700;
          font-size:1.05rem;
          margin-top:6px;
        }

        /* Right pane */
        .right {
          width: 360px;
          max-width: 100%;
          display:flex;
          flex-direction:column;
          gap:14px;
        }

        .controls{
          background:linear-gradient(90deg,var(--accent),#ff8a5b);
          color:#fff;
          border:none;
          padding:14px 18px;
          border-radius:999px;
          font-weight:800;
          font-size:1.05rem;
          box-shadow: 0 8px 22px rgba(255,82,124,0.18);
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:8px;
        }

        .volume-row{
          display:flex;
          align-items:center;
          gap:12px;
          padding-top:8px;
        }

        .volume-row input[type="range"]{
          flex:1;
        }

        .history{
          background:#fbfbfb;
          padding:12px;
          border-radius:10px;
        }

        .history h4{margin:0 0 8px 0; font-size:0.95rem}
        .hist-item{
          display:flex;
          gap:10px;
          align-items:center;
          padding:10px 6px;
          border-bottom:1px solid #eee;
        }
        .hist-item:last-child{border-bottom:none;}
        .hist-thumb{
          width:46px; height:46px; border-radius:8px; overflow:hidden; background:#eee; flex-shrink:0;
        }
        .hist-thumb img{width:100%; height:100%; object-fit:cover; display:block; opacity:0; transition:opacity .6s}
        .hist-thumb img.loaded{opacity:1}

        .hist-meta{flex:1}
        .hist-title{font-weight:600}
        .hist-artist{font-size:0.85rem; color:var(--muted)}

        .status{font-size:0.9rem; color:var(--muted); padding-top:8px}

        /* favorite star */
        .fav-btn{
          background:transparent;
          border:none;
          font-size:1.25rem;
          cursor:pointer;
          color:#666;
        }
        .fav-btn.favorited{color:var(--accent)}

      `}</style>

      <div className="player-wrap" role="region" aria-label="Praise FM player">
        {/* LEFT: cover + info */}
        <div className="left">
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <div style={{flex:1}}>
              <div className="station-title">Praise FM U.S.</div>
              <div className="station-sub">Praise & Worship</div>
            </div>

            <button
              className={`fav-btn ${isFavorited(`${currentArtist} - ${currentSong}`) ? 'favorited' : ''}`}
              onClick={toggleFavForCurrent}
              aria-label="Favorite current track"
              title="Favorite current track"
            >
              {isFavorited(`${currentArtist} - ${currentSong}`) ? '★' : '☆'}
            </button>
          </div>

          <div className="cover-wrap" aria-hidden>
            <img
              ref={coverImgRef}
              key={coverKey}
              src={coverUrl}
              alt={currentTitle || 'Praise FM logo'}
              className="cover-img"
              onLoad={(e) => e.currentTarget.classList.add('loaded')}
              onError={(e) => {
                if (e.currentTarget.src !== STREAM_LOGO_URL) {
                  e.currentTarget.src = STREAM_LOGO_URL;
                }
                e.currentTarget.classList.add('loaded');
              }}
              style={{
                width: LOGO_FALLBACK_SIZE + 'px',
                height: LOGO_FALLBACK_SIZE + 'px',
                maxWidth: '100%',
                maxHeight: '100%'
              }}
            />
          </div>

          <div className="info">
            <div className="now-text">LIVE • <span>{new Date().toLocaleTimeString('en-US',{hour:'2-digit', minute:'2-digit', hour12:true})}</span></div>
            <div className="title" aria-live="polite">{currentTitle}</div>
          </div>
        </div>

        {/* RIGHT: controls + history */}
        <div className="right">
          <button
            className="controls"
            onClick={handlePlayPause}
            aria-pressed={playing}
            aria-label={playing ? 'Pause stream' : 'Play stream'}
          >
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>

          <div className="volume-row" aria-label="Volume control">
            <span aria-hidden>🔊</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolume}
              aria-label="Volume"
            />
          </div>

          <div className="history">
            <h4>Recently Played</h4>
            {history.length === 0 ? (
              <div style={{padding:'10px', color:'#777'}}>No songs yet…</div>
            ) : (
              history.map(item => (
                <div key={item.key} className="hist-item" title={`${item.artist} — ${item.song}`}>
                  <div className="hist-thumb">
                    <img
                      src={isValidCoverUrl(item.cover) && item.cover !== STREAM_LOGO_URL ? item.cover : STREAM_LOGO_URL}
                      alt={`${item.artist} - ${item.song}`}
                      onLoad={(e) => e.currentTarget.classList.add('loaded')}
                      onError={(e) => {
                        if (e.currentTarget.src !== STREAM_LOGO_URL) e.currentTarget.src = STREAM_LOGO_URL;
                        e.currentTarget.classList.add('loaded');
                      }}
                    />
                  </div>

                  <div className="hist-meta">
                    <div className="hist-title">{item.song}</div>
                    <div className="hist-artist">{item.artist}</div>
                  </div>

                  <div style={{marginLeft:8}}>
                    <button
                      aria-label={`Favorite ${item.artist} - ${item.song}`}
                      onClick={() => toggleFavorite(item.key || `${item.artist} - ${item.song}`)}
                      style={{background:'transparent', border:'none', cursor:'pointer', fontSize:18}}
                    >
                      {isFavorited(item.key || `${item.artist} - ${item.song}`) ? '★' : '☆'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="status" aria-live="polite">{status}</div>
        </div>

        <audio ref={audioRef} preload="auto" style={{display:'none'}} aria-hidden="true" />
      </div>
    </>
  );
}
