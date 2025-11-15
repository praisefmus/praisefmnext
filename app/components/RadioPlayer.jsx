// RadioPlayer.jsx com tema dark automático, transições animadas e responsivo para telas grandes

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
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      dispatch({ type: 'SET_SYSTEM_THEME', value: mq.matches });
    };
    applyTheme();
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
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
    audio.src = STREAM_URL;
    audio.volume = volume;

    const clock = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { timeZone: "America/Chicago", "en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));
      setCurrentDate(now.toLocaleDateString("en-US", { timeZone: "America/Chicago", "en-US", { day: "2-digit", month: "short", year: "numeric" }));
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

        setStatus(isCommercial(song) ? "Commercial Break" : `LIVE • ${artist} - ${song}`);
      } catch {
        setError("Metadata error");
        setCoverUrl(STREAM_LOGO_URL);
      }
    };

    return () => {
      clearInterval(clock);
      sse.close();
    };
  }, [fetchCoverArt, volume]);

  const handlePlayPause = () => {
    const p = playerRef.current;
    if (!playing) p.play(); else p.pause();
    setPlaying(!playing);
  };

  return (
    <div className={`page ${darkMode ? 'dark' : ''} min-h-screen transition-colors duration-500 bg-gray-100 dark:bg-gray-900`}>      
      <div className="container mx-auto max-w-4xl p-6 rounded-2xl shadow-xl bg-white dark:bg-gray-800 transition-all duration-500 mt-6">
        <div className="flex flex-col items-center">

          {/* CAPA COM TRANSIÇÃO SUAVE */}
          <motion.div
            className="w-56 h-56 md:w-72 md:h-72 xl:w-80 xl:h-80 rounded-2xl shadow-xl overflow-hidden mb-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <img src={coverUrl || STREAM_LOGO_URL} className="w-full h-full object-cover" />
          </motion.div>

          {/* INFO DA MÚSICA */}
          <motion.h2
            className="text-xl md:text-2xl font-bold text-center text-gray-900 dark:text-white"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            {currentTitle}
          </motion.h2>

          <p className="text-sm text-gray-600 dark:text-gray-300">{currentDate}</p>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">LIVE • {currentTime}</p>

          {/* BOTÃO PLAY/PAUSE COM ANIMAÇÃO */}
          <motion.button
            className="w-full mt-5 py-3 bg-gray-800 dark:bg-gray-700 text-white rounded-xl flex items-center justify-center"
            onClick={handlePlayPause}
            whileTap={{ scale: 0.92 }}
          >
            {playing ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8" />}
          </motion.button>

          {/* CONTROLE DE VOLUME */}
          <div className="w-full mt-4 px-4">
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
              <SpeakerWaveIcon className="w
