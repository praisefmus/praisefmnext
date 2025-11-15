// RadioPlayer.jsx — versão final 100% corrigida, responsiva, dark automático e com horário de Chicago

'use client';

import { useState, useEffect, useRef, useReducer, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from '@heroicons/react/24/solid';

// Reducer de tema com preferência automática do sistema
function themeReducer(state, action) {
  switch (action.type) {
    case 'SET_SYSTEM_THEME':
      return { ...state, darkMode: action.value };
    case 'TOGGLE_THEME':
      return { ...state, darkMode: !state.darkMode };
    default:
      return state;
  }
}

export default function RadioPlayer() {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [status, setStatus] = useState('Connecting...');
  const [coverUrl, setCoverUrl] = useState('');
  const [currentTitle, setCurrentTitle] = useState('Loading...');
  const [currentDate, setCurrentDate] = useState('—');
  const [currentTime, setCurrentTime] = useState('—');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  const [{ darkMode }, dispatch] = useReducer(themeReducer, { darkMode: false });

  const playerRef = useRef(null);

  const STREAM_URL = "https://stream.zeno.fm/hvwifp8ezc6tv";
  const NOWPLAYING_API = "https://api.zeno.fm/mounts/metadata/subscribe/hvwifp8ezc6tv";

  const STREAM_LOGO_URL = "/logo-praisefm.webp";
  const MAX_HISTORY = 6;

  // Detecta o tema do sistema automaticamente
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      dispatch({ type: 'SET_SYSTEM_THEME', value: mq.matches });
    };
    applyTheme();
    // older browsers: addEventListener may not exist on MediaQueryList
    if (mq.addEventListener) mq.addEventListener('change', applyTheme);
    else mq.addListener(applyTheme);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', applyTheme);
      else mq.removeListener(applyTheme);
    };
  }, []);

  const PROGRAM_COVERS = {
    "commercial break": "/commercial.webp",
    "praise fm carpool": "/carpool.webp",
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
    const words = ["spot", "publicidade", "advert", "break", "jingle", "intervalo"];
    return words.some(w => t.includes(w));
  };

  const fetchCoverArt = useCallback(async (artist, song) => {
    if (isCommercial(song)) return PROGRAM_COVERS["commercial break"];
    const programCover = detectProgramCover(artist, song);
    if (programCover) return programCover;
    return STREAM_LOGO_URL;
  }, []);

  const addToHistory = (song, artist, cover) => {
    if (isCommercial(song)) return;
    setHistory(prev => {
      const key = `${artist} - ${song}`;
      const list = prev.filter(i => i.key !== key);
      list.unshift({ key, song, artist, coverUrl: cover });
      return list.slice(0, MAX_HISTORY);
    });
  };

  // Dados do player e metadata
  useEffect(() => {
    const audio = playerRef.current;
    if (!audio) return;
    audio.src = STREAM_URL;
    audio.volume = volume;

    const clock = setInterval(() => {
      const now = new Date();

      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          timeZone: "America/Chicago",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );

      setCurrentDate(
        now.toLocaleDateString("en-US", {
          timeZone: "America/Chicago",
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      );
    }, 1000);

    const sse = new EventSource(NOWPLAYING_API);
    sse.onmessage = async e => {
      try {
        const data = JSON.parse(e.data);
        let raw = (data.streamTitle || "").trim();
        if (!raw) raw = "Praise FM U.S. - Spot";

        const parts = raw.split(" - ");
        const artist = parts[0] || '';
        const song = parts.slice(1).join(" ") || '';

        setCurrentTitle(isCommercial(song) ? "Commercial Break" : `${artist} - ${song}`);

        const cover = await fetchCoverArt(artist, song);
        setCoverUrl(cover);
        addToHistory(song, artist, cover);

        setStatus(isCommercial(song) ? "Commercial Break" : `LIVE • ${artist} - ${song}`);
      } catch (err) {
        console.error('SSE parse error', err);
        setError("Metadata error");
        setCoverUrl(STREAM_LOGO_URL);
      }
    };

    sse.onerror = (err) => {
      console.error('SSE error', err);
      setError('SSE connection error');
    };

    return () => {
      clearInterval(clock);
      try { sse.close(); } catch (e) {}
    };
  }, [fetchCoverArt, volume]);

  const handlePlayPause = async () => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (!playing) await p.play(); else p.pause();
      setPlaying(!playing);
    } catch (err) {
      console.error('Play error', err);
      setError('Playback failed. Check browser autoplay settings.');
    }
  };

  return (
    <div className={`page ${darkMode ? 'dark' : ''} min-h-screen transition-colors duration-500 bg-gray-100 dark:bg-gray-900`}>
      <style jsx global>{`
        @import 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      `}</style>

      <div className="container mx-auto max-w-6xl p-10 rounded-2xl shadow-xl bg-white dark:bg-gray-800 transition-all duration-500 mt-6">
        <div className="flex flex-col items-center md:flex-row md:items-start md:gap-8">

          {/* LEFT: Cover + info */}
          <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
            <motion.div
              className="w-64 h-64 md:w-80 md:h-80 xl:w-96 xl:h-96 rounded-2xl shadow-xl overflow-hidden mb-6"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <img src={coverUrl || STREAM_LOGO_URL} alt="Cover" className="w-full h-full object-cover" />
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="w-full px-2 md:px-0">
              <h2 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white">{currentTitle}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{currentDate} — <span className="font-medium">Chicago time</span></p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">LIVE • {currentTime}</p>

              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            </motion.div>
          </div>

          {/* RIGHT: Controls + history */}
          <div className="w-full md:w-1/2">
            <motion.button
              className="w-full mt-2 py-3 bg-gray-800 dark:bg-gray-700 text-white rounded-xl flex items-center justify-center"
              onClick={handlePlayPause}
              whileTap={{ scale: 0.96 }}
            >
              {playing ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8" />}
            </motion.button>

            <div className="w-full mt-4 px-2">
              <div className="flex items-center">
                <SpeakerXMarkIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full mx-3"
                />
                <SpeakerWaveIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-md font-semibold mb-2">Recently Played</h3>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-2">
                {history.length === 0 && <div className="text-sm text-gray-500">No recent tracks yet.</div>}
                {history.map((item) => (
                  <motion.div key={item.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                    <img src={item.coverUrl} alt="cover" className="w-12 h-12 rounded object-cover" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.song}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">{item.artist}</div>
                    </div>
                    <button onClick={() => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(item.artist + ' ' + item.song)}`, '_blank')} className="text-sm text-blue-600">Play</button>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="mt-6 text-sm text-gray-600 dark:text-gray-300">{status}</div>

          </div>

          <audio ref={playerRef} preload="auto" />
        </div>
      </div>
    </div>
  );
}
