'use client';

import { useState, useEffect, useRef, useReducer, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  PlayIcon,
  PauseIcon,
  ShareIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from '@heroicons/react/24/solid';

// Theme reducer
function themeReducer(state, action) {
  switch (action.type) {
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
  const [lyrics, setLyrics] = useState('');
  const [error, setError] = useState(null);
  const [bufferProgress, setBufferProgress] = useState(0);

  const [{ darkMode }, dispatch] = useReducer(themeReducer, { darkMode: false });

  const playerRef = useRef(null);

  const STREAM_URL = "https://stream.zeno.fm/hvwifp8ezc6tv";
  const NOWPLAYING_API = "https://api.zeno.fm/mounts/metadata/subscribe/hvwifp8ezc6tv";

  const LASTFM_KEY = process.env.NEXT_PUBLIC_LASTFM_KEY || "7744c8f90ee053fc761e0e23bfa00b89";
  const DISCOGS_KEY = process.env.NEXT_PUBLIC_DISCOGS_KEY || "YhCDaUYXMEnfKtWtAltJfGbYPrSkYnpqhIncSWyX";
  const LYRICS_API = 'https://lyrics.ovh';

  const STREAM_LOGO_URL = "/logo-praisefm.webp";
  const MAX_HISTORY = 5;

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
    } catch {
      return null;
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
      if (!data?.results?.length) return null;
      const release = data.results[0];
      if (!release.cover_image) return null;
      if (!isBadCover(artist, song, release.cover_image)) return release.cover_image;
    } catch {
      return null;
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

  const fetchLyrics = async (a, s) => {
    try {
      const res = await fetch(`${LYRICS_API}/v1/${encodeURIComponent(a)}/${encodeURIComponent(s)}`);
      const data = await res.json();
      setLyrics(data?.lyrics || "Lyrics not found.");
    } catch {
      setLyrics("Unable to fetch lyrics.");
    }
  };

  const addToHistory = (song, artist, cover) => {
    if (isCommercial(song)) return;
    setHistory(prev => {
      const key = `${artist} - ${song}`;
      const list = prev.filter(i => i.key !== key);
      list.unshift({ key, song, artist, coverUrl: cover });
      return list.slice(0, MAX_HISTORY);
    });
  };

  useEffect(() => {
    const audio = playerRef.current;
    audio.src = STREAM_URL;
    audio.volume = volume;

    audio.addEventListener('progress', () => {
      if (audio.buffered.length > 0) {
        setBufferProgress((audio.buffered.end(0) / audio.duration) * 100 || 0);
      }
    });

    audio.addEventListener('error', () => setError("Stream error"));
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
        fetchLyrics(artist, song);

        setStatus(isCommercial(song) ? "Commercial Break" : `LIVE: ${artist} - ${song}`);
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
    if (!playing) p.play();
    else p.pause();
    setPlaying(!playing);
  };

  return (
    <div className={`page ${darkMode ? "dark" : ""}`}>
      <style jsx global>{`
        @import 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      `}</style>

      <div className="container mx-auto max-w-3xl p-6 rounded-2xl shadow-lg bg-white dark:bg-gray-800">
        <div className="flex flex-col items-center">

          <motion.div
            className="w-64 h-64 rounded-full shadow-xl overflow-hidden mb-4"
            animate={playing ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          >
            <img src={coverUrl || STREAM_LOGO_URL} className="w-full h-full object-cover" />
          </motion.div>

          <h2 className="text-xl font-bold">{currentTitle}</h2>
          <p>{currentDate}</p>
          <p>LIVE • {currentTime}</p>

          <button
            className="w-full mt-4 py-3 bg-gray-700 text-white rounded-xl flex items-center justify-center"
            onClick={handlePlayPause}
          >
            {playing ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8" />}
          </button>

          <div className="w-full mt-4">
            <div className="flex items-center">
              <SpeakerXMarkIcon className="w-5 h-5" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full mx-3"
              />
              <SpeakerWaveIcon className="w-5 h-5" />
            </div>
          </div>

          <h3 className="text-xl font-bold mt-6">Lyrics</h3>
          <p className="max-h-40 overflow-y-auto text-sm">{lyrics}</p>

          <h3 className="text-xl font-bold mt-6">Recently Played</h3>
          {history.map((item, i) => (
            <div key={i} className="flex items-center mt-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <img src={item.coverUrl} className="w-12 h-12 rounded" />
              <div className="ml-3">
                <div className="font-bold">{item.song}</div>
                <div className="text-sm">{item.artist}</div>
              </div>
            </div>
          ))}

          <div className="mt-4">{status}</div>

          <audio ref={playerRef} preload="auto" />
        </div>
      </div>
    </div>
  );
}
