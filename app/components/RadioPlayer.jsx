// RadioPlayer.jsx — Clean Premium (Apple TV style) dark/minimal

'use client';

import { useState, useEffect, useRef, useReducer, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/solid';

// Theme reducer (auto system)
function themeReducer(state, action) {
  switch (action.type) {
    case 'SET_SYSTEM_THEME':
      return { ...state, darkMode: action.value };
    default:
      return state;
  }
}

export default function RadioPlayer() {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [status, setStatus] = useState('Connecting...');
  const [coverUrl, setCoverUrl] = useState('');
  const [currentTitle, setCurrentTitle] = useState('Loading...');
  const [currentDate, setCurrentDate] = useState('—');
  const [currentTime, setCurrentTime] = useState('—');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  const [{ darkMode }, dispatch] = useReducer(themeReducer, { darkMode: true });
  const playerRef = useRef(null);

  const STREAM_URL = "https://stream.zeno.fm/hvwifp8ezc6tv";
  const NOWPLAYING_API = "https://api.zeno.fm/mounts/metadata/subscribe/hvwifp8ezc6tv";
  const STREAM_LOGO_URL = "/logo-praisefm.webp";
  const MAX_HISTORY = 6;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => dispatch({ type: 'SET_SYSTEM_THEME', value: mq.matches });
    apply();
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else mq.addListener(apply);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', apply);
      else mq.removeListener(apply);
    };
  }, []);

  const PROGRAM_COVERS = {
    "commercial break": "/commercial.webp",
    "praise fm carpool": "/carpool.webp",
  };

  const detectProgramCover = (artist, song) => {
    const text = `${artist} ${song}`.toLowerCase();
    for (const k in PROGRAM_COVERS)
      if (text.includes(k)) return PROGRAM_COVERS[k];
    return null;
  };

  const isCommercial = (text) => {
    if (!text) return true;
    const t = text.toLowerCase();
    const words = ['spot','publicidade','advert','break','jingle','intervalo'];
    return words.some(w => t.includes(w));
  };

  const fetchCoverArt = useCallback(async (artist, song) => {
    if (isCommercial(song)) return PROGRAM_COVERS['commercial break'];
    const pc = detectProgramCover(artist, song);
    if (pc) return pc;
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
      } catch {
        setError("Metadata error");
        setCoverUrl(STREAM_LOGO_URL);
      }
    };

    sse.onerror = () => setError("SSE connection error");

    return () => {
      clearInterval(clock);
      try { sse.close(); } catch {}
    };
  }, [fetchCoverArt, volume]);

  const handlePlayPause = async () => {
    const p = playerRef.current;
    if (!p) return;

    try {
      if (!playing) await p.play();
      else p.pause();
      setPlaying(!playing);
    } catch {
      setError("Playback failed");
    }
  };

  return (
    <div className="min-h-screen w-full bg-black text-gray-200">
      <style jsx global>{`
        @import 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      `}</style>

      <main className="min-h-screen flex items-center justify-center px-6 py-12">
        <section className="w-full max-w-7xl bg-gradient-to-b from-black/80 via-gray-900 to-black/95 rounded-3xl shadow-2xl p-10 md:p-14 flex flex-col md:flex-row gap-8">

          {/* LEFT SIDE */}
          <div className="md:w-1/2 flex flex-col items-center md:items-start gap-6">
            <motion.div
              className="w-64 h-64 md:w-80 md:h-80 xl:w-96 xl:h-96 rounded-3xl overflow-hidden shadow-inner"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45 }}>
              <img src={coverUrl || STREAM_LOGO_URL} className="w-full h-full object-cover" />
            </motion.div>

            <div className="w-full md:max-w-lg">
              <h1 className="text-3xl md:text-5xl font-semibold leading-tight">{currentTitle}</h1>

              <p className="mt-3 text-sm text-gray-400">
                {currentDate} • <span className="font-medium">Chicago time</span>
              </p>

              <p className="mt-2 text-lg text-gray-200 font-medium">
                LIVE • {currentTime}
              </p>

              {error && (
                <div className="mt-4 text-sm text-red-500">{error}</div>
              )}

              <div className="mt-6 flex items-center gap-4 w-full">
                <motion.button
                  onClick={handlePlayPause}
                  whileTap={{ scale: 0.96 }}
                  className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-xl flex items-center gap-3">
                  {playing ? (
                    <PauseIcon className="w-6 h-6" />
                  ) : (
                    <PlayIcon className="w-6 h-6" />
                  )}
                  <span className="font-medium">
                    {playing ? "Pause" : "Play"}
                  </span>
                </motion.button>

                <div className="flex items-center gap-3 bg-gray-900/50 px-3 py-2 rounded-lg">
                  <SpeakerXMarkIcon className="w-5 h-5 text-gray-400" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-48 md:w-64"
                  />
                  <SpeakerWaveIcon className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <aside className="md:w-1/2 flex flex-col gap-6">
            <div className="w-full px-4 py-4 rounded-2xl bg-gray-900/30 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-400">Now playing</div>
                  <div className="text-lg font-medium">{currentTitle}</div>
                </div>
                <div className="text-sm text-gray-400">{status}</div>
              </div>
            </div>

            {/* RECENTLY PLAYED */}
            <div className="rounded-2xl bg-gradient-to-b from-gray-900/20 to-black/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Recently Played</h3>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {history.length === 0 && (
                  <div className="text-sm text-gray-400">
                    No recent tracks yet.
                  </div>
                )}

                {history.map((it) => (
                  <div
                    key={it.key}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/40">
                    <img
                      src={it.coverUrl}
                      className="w-14 h-14 rounded-md object-cover"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{it.song}</div>
                      <div className="text-xs text-gray-400">{it.artist}</div>
                    </div>
                    <button
                      onClick={() =>
                        window.open(
                          `https://www.youtube.com/results?search_query=${encodeURIComponent(
                            it.artist + " " + it.song
                          )}`
                        )
                      }
                      className="text-xs text-gray-400">
                      Open
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-gray-500">
              © {new Date().getFullYear()} Praise FM — Stream powered by ZenoFM
            </div>
          </aside>

          <audio ref={playerRef} preload="auto" />
        </section>
      </main>
    </div>
  );
}
