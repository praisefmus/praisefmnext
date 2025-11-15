'use client';

import { useState, useEffect, useRef, useReducer, useCallback } from 'react';
import { motion } from 'framer-motion'; // For animations
import { PlayIcon, PauseIcon, ShareIcon, VolumeUpIcon, VolumeOffIcon } from '@heroicons/react/24/solid';

// Theme reducer for dark/light mode
const themeReducer = (state, action) => {
  switch (action.type) {
    case 'TOGGLE_THEME':
      return { ...state, darkMode: !state.darkMode };
    default:
      return state;
  }
};

export default function RadioPlayer() {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [status, setStatus] = useState('Connecting...');
  const [coverUrl, setCoverUrl] = useState('');
  const [currentTitle, setCurrentTitle] = useState('Loading...');
  const [currentDate, setCurrentDate] = useState('—');
  const [currentTime, setCurrentTime] = useState('—');
  const [history, setHistory] = useState([]);
  const [lyrics, setLyrics] = useState(''); // New: Lyrics state
  const [error, setError] = useState(null); // New: Error handling
  const [bufferProgress, setBufferProgress] = useState(0); // New: Buffer indicator

  const [{ darkMode }, dispatch] = useReducer(themeReducer, { darkMode: false });

  const playerRef = useRef(null);

  const STREAM_URL = "https://stream.zeno.fm/hvwifp8ezc6tv";
  const NOWPLAYING_API = "https://api.zeno.fm/mounts/metadata/subscribe/hvwifp8ezc6tv";
  const LASTFM_KEY = process.env.NEXT_PUBLIC_LASTFM_KEY || "7744c8f90ee053fc761e0e23bfa00b89"; // Use env for security
  const DISCOGS_KEY = process.env.NEXT_PUBLIC_DISCOGS_KEY || "YhCDaUYXMEnfKtWtAltJfGbYPrSkYnpqhIncSWyX";
  const LYRICS_API = 'https://lyrics.ovh'; // Free lyrics API

  const STREAM_LOGO_URL = "/logo-praisefm.webp";
  const MAX_HISTORY = 5;

  const PROGRAM_COVERS = {
    "commercial break": "/commercial.webp",
    "praise fm carpool": "/carpool.webp"
  };

  const detectProgramCover = (artist, song) => {
    const text = `${artist} ${song}`.toLowerCase();
    for (const key in PROGRAM_COVERS) {
      if (text.includes(key)) return PROGRAM_COVERS[key];
    }
    return null;
  };

  const isCommercial = (text) => {
    if (!text) return true;
    const t = text.toLowerCase();
    const words = ["spot", "commercial", "publicidade", "advert", "break", "jingle", "intervalo"];
    return words.some(w => t.includes(w));
  };

  const isBadCover = (artist, song, url) => {
    if (!url) return true;
    const badWords = ["soundtrack", "film", "movie", "ost", "theme", "tv"];
    const low = url.toLowerCase();
    if (badWords.some(w => low.includes(w))) return true;
    if (low.includes("noimage") || low.includes("placeholder")) return true;
    return false;
  };

  const fetchLastFmCover = async (artist, song) => {
    try {
      const res = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(song)}&format=json`
      );
      const data = await res.json();
      const imgs = data?.track?.album?.image;
      if (!imgs) return null;
      const img = imgs.find(i => i.size === "extralarge") || imgs[imgs.length - 1];
      const url = img?.["#text"] ?? "";
      if (!isBadCover(artist, song, url)) return url;
    } catch (err) {
      console.error('LastFM error:', err);
    }
    return null;
  };

  const fetchDiscogsCover = async (artist, song) => {
    try {
      const q = encodeURIComponent(`${artist} ${song}`);
      const res = await fetch(
        `https://api.discogs.com/database/search?q=${q}&token=${DISCOGS_KEY}&type=release`
      );
      const data = await res.json();
      if (!data?.results || data.results.length === 0) return null;
      const release = data.results[0];
      if (!release.cover_image) return null;
      if (!isBadCover(artist, song, release.cover_image)) return release.cover_image;
    } catch (err) {
      console.error('Discogs error:', err);
    }
    return null;
  };

  const fetchCoverArt = useCallback(async (artist, song) => {
    if (isCommercial(song)) return PROGRAM_COVERS["commercial break"];
    const programCover = detectProgramCover(artist, song);
    if (programCover) return programCover;
    const last = await fetchLastFmCover(artist, song);
    if (last) return last;
    const disc = await fetchDiscogsCover(artist, song);
    if (disc) return disc;
    return STREAM_LOGO_URL;
  }, []);

  const fetchLyrics = async (artist, song) => {
    try {
      const res = await fetch(`${LYRICS_API}/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`);
      const data = await res.json();
      setLyrics(data.lyrics || 'Lyrics not found.');
    } catch (err) {
      setLyrics('Unable to fetch lyrics.');
      console.error('Lyrics error:', err);
    }
  };

  const addToHistory = (song, artist, cover) => {
    if (isCommercial(song)) return;
    setHistory(prev => {
      const key = `${artist} - ${song}`;
      let list = prev.filter(i => i.key !== key);
      list.unshift({ key, song, artist, coverUrl: cover });
      return list.slice(0, MAX_HISTORY);
    });
  };

  useEffect(() => {
    const audio = playerRef.current;
    audio.src = STREAM_URL;
    audio.volume = volume;

    // New: Buffer progress listener
    audio.addEventListener('progress', () => {
      if (audio.buffered.length > 0) {
        setBufferProgress((audio.buffered.end(0) / audio.duration) * 100 || 0);
      }
    });

    // New: Error handling
    audio.addEventListener('error', () => setError('Stream error. Try refreshing.'));
    audio.addEventListener('canplay', () => setError(null));

    const clock = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));
      setCurrentDate(now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }));
    }, 1000);

    const sse = new EventSource(NOWPLAYING_API);
    sse.onmessage = async e => {
      try {
        const data = JSON.parse(e.data);
        let raw = (data.streamTitle || "").trim();
        if (!raw) raw = "Praise FM U.S. - Spot";
        const parts = raw.split(" - ");
        const artist = parts[0];
        const song = parts.slice(1).join(" ");

        setCurrentTitle(isCommercial(song) ? "Commercial Break" : `${artist} - ${song}`);

        const cover = await fetchCoverArt(artist, song);
        setCoverUrl(cover);

        addToHistory(song, artist, cover);

        fetchLyrics(artist, song); // New: Fetch lyrics on song change

        setStatus(isCommercial(song) ? "Commercial Break" : `LIVE: ${artist} - ${song}`);
      } catch (err) {
        setCoverUrl(STREAM_LOGO_URL);
        setError('Metadata error.');
        console.error('SSE error:', err);
      }
    };

    // New: Keyboard shortcuts
    const handleKeyDown = (e) => {
      if (e.key === ' ') {
        e.preventDefault();
        handlePlayPause();
      }
      if (e.key === 'ArrowUp') setVolume(Math.min(1, volume + 0.1));
      if (e.key === 'ArrowDown') setVolume(Math.max(0, volume - 0.1));
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(clock);
      sse.close();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fetchCoverArt]); // Optimized dependencies

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.volume = volume;
    }
  }, [volume]);

  const handlePlayPause = () => {
    const p = playerRef.current;
    if (!playing) {
      p.play().catch((err) => {
        setError('Playback failed. Check browser permissions.');
        console.error('Play error:', err);
      });
    } else {
      p.pause();
    }
    setPlaying(!playing);
  };

  // Debounced volume change (optional, but good for performance)
  const handleVolumeChange = useCallback((e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
  }, []);

  const handleShare = () => {
    const shareText = `Listening to ${currentTitle} on Praise FM!`;
    if (navigator.share) {
      navigator.share({ text: shareText }).catch(console.error);
    } else {
      console.log('Share not supported');
    }
  };

  const handleHistoryClick = (song, artist) => {
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${artist} ${song}`)}`, '_blank');
  };

  return (
    <div className={`page ${darkMode ? 'dark' : ''}`}>
      <style jsx global>{`
        @import 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css'; // Tailwind CDN for quick setup
      `}</style>
      <style jsx>{`
        .page {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: ${darkMode ? '#1f2937' : '#fafafa'};
          padding: 20px;
          color: ${darkMode ? '#f3f4f6' : '#333'};
          font-family: Poppins, sans-serif;
        }
        .container {
          width: 100%;
          max-width: 980px;
          background: ${darkMode ? '#374151' : 'white'};
          border-radius: 22px;
          padding: 40px;
          display: flex;
          gap: 40px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.08);
        }
        @media (max-width: 780px) {
          .container { flex-direction: column; text-align: center; padding: 24px; }
        }
        @media (max-width: 480px) {
          .cover { width: 150px; height: 150px; }
          .playBtn { height: 50px; }
          .historyItem { flex-direction: column; text-align: center; }
        }
        .history { max-height: 300px; overflow-y: auto; }
        .lyrics { white-space: pre-wrap; }
        .playBtn {
          background: linear-gradient(180deg, #555, #3f3f3f);
          border-radius: 14px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.22);
          transition: transform 0.12s;
        }
        .playBtn:active { transform: translateY(1px) scale(0.99); }
        .shareBtn, .themeToggle { transition: background 0.2s; }
        .shareBtn:hover { background: #3b82f6; }
        .themeToggle:hover { background: #d1d5db; }
      `}</style>

      <div className="container">
        <div className="left flex-1 flex flex-col items-center">
          <h1 className="title font-bold text-2xl mb-2">Praise FM U.S.</h1>

          <motion.div
            className="cover w-64 h-64 rounded-full overflow-hidden shadow-xl mb-4 md:w-56 md:h-56 sm:w-48 sm:h-48"
            animate={playing ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          >
            <img src={coverUrl || STREAM_LOGO_URL} alt="Cover Art" className="w-full h-full object-cover" />
          </motion.div>

          <h3 className="text-lg font-semibold">{currentTitle}</h3>
          <p>{currentDate}</p>
          <p className="text-sm">LIVE • {currentTime}</p>

          {error && <p className="text-red-500 mt-2">{error}</p>}

          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4 dark:bg-gray-600">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${bufferProgress}%` }}></div>
          </div>
        </div>

        <div className="right flex-1">
          <button
            className="playBtn w-full h-16 flex justify-center items-center text-white"
            onClick={handlePlayPause}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8" />}
          </button>

          <div className="slider mt-5">
            <div className="flex items-center">
              <VolumeOffIcon className="w-5 h-5 mr-2" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="w-full"
                aria-label="Volume"
              />
              <VolumeUpIcon className="w-5 h-5 ml-2" />
            </div>
          </div>

          <button
            className="shareBtn mt-4 w-full py-2 bg-blue-500 text-white rounded-lg flex justify-center items-center"
            onClick={handleShare}
            aria-label="Share"
          >
            <ShareIcon className="w-5 h-5 mr-2" /> Share Current Song
          </button>

          <button
            className="themeToggle mt-4 w-full py-2 bg-gray-300 text-gray-800 rounded-lg dark:bg-gray-700 dark:text-white"
            onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
          >
            Toggle {darkMode ? 'Light' : 'Dark'} Mode
          </button>

          <h3 className="mt-6 text-xl font-bold">Lyrics</h3>
          <p className="lyrics text-sm overflow-y-auto max-h-32">{lyrics}</p>

          <h3 className="mt-6 text-xl font-bold">Recently Played</h3>
          <div className="history">
            {history.map((item, i) => (
              <motion.div
                key={i}
                className="historyItem flex items-center gap-3 mt-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded"
                onClick={() => handleHistoryClick(item.song, item.artist)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <img src={item.coverUrl} className="w-12 h-12 rounded-md object-cover" alt="History Cover" />
                <div>
                  <strong>{item.song}</strong>
                  <div className="text-sm">{item.artist}</div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="status mt-4 text-center text-sm">{status}</div>
        </div>

        <audio ref={playerRef} preload="auto" />
      </div>
    </div>
  );
}