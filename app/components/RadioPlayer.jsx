'use client';

import { useState, useEffect, useRef } from 'react';

export default function RadioPlayer() {
    const [playing, setPlaying] = useState(false);
    const [volume, setVolume] = useState(0.7);
    const [status, setStatus] = useState('Connecting...');
    const [coverUrl, setCoverUrl] = useState('');
    const [currentTitle, setCurrentTitle] = useState('Loading...');
    const [currentDate, setCurrentDate] = useState('—');
    const [currentTime, setCurrentTime] = useState('—');
    const [history, setHistory] = useState([]);
    const [autoplayAttempted, setAutoplayAttempted] = useState(false);

    const playerRef = useRef(null);

    // STREAM + API
    const STREAM_URL = "https://stream.zeno.fm/hvwifp8ezc6tv";
    const NOWPLAYING_API = "https://api.zeno.fm/mounts/metadata/subscribe/hvwifp8ezc6tv";
    const LASTFM_API_KEY = "7744c8f90ee053fc761e0e23bfa00b89";

    // LOGO LOCAL DO /public
    const STREAM_LOGO_URL = "/logo-praisefm.webp";

    const MAX_HISTORY = 5;

    // Detectar comerciais
    const isCommercial = (title) => {
        const keywords = [
            "commercial", "advertisement", "sponsor", "spot",
            "publicidade", "intervalo", "break", "jingle",
            "comercial", "anuncio", "patrocinio"
        ];
        const text = title.toLowerCase();
        return keywords.some(k => text.includes(k));
    };

    // Buscar capa no Last.fm
    const fetchCoverArt = async (artist, song) => {
        if (!artist || !song || isCommercial(song)) return STREAM_LOGO_URL;

        try {
            const response = await fetch(
                `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(song)}&format=json`
            );

            const data = await response.json();

            if (data.track?.album?.image) {
                const images = data.track.album.image;
                const cover = images.find(img => img.size === "extralarge") || images[images.length - 1];

                const url = cover["#text"]?.trim();
                if (url && url.length > 10) return url;
            }

            return STREAM_LOGO_URL;
        } catch {
            return STREAM_LOGO_URL;
        }
    };

    // Histórico
    const addToHistory = (song, artist, coverUrl) => {
        setHistory(prev => {
            const key = `${artist} - ${song}`;
            const newHist = prev.filter(h => h.key !== key);
            newHist.unshift({ key, song, artist, coverUrl });
            return newHist.slice(0, MAX_HISTORY);
        });
    };

    // Autoplay
    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;

        player.src = STREAM_URL;
        player.volume = volume;

        const tryPlay = async () => {
            if (autoplayAttempted) return;
            setAutoplayAttempted(true);

            try {
                await player.play();
                setPlaying(true);
                setStatus("LIVE • Now Playing");
            } catch {
                setStatus("Click to start the radio");
            }
        };

        tryPlay();

        const listener = () => tryPlay();
        document.addEventListener("click", listener);
        document.addEventListener("touchstart", listener);

        return () => {
            document.removeEventListener("click", listener);
            document.removeEventListener("touchstart", listener);
        };
    }, []);

    // Volume update
    useEffect(() => {
        if (playerRef.current) playerRef.current.volume = volume;
    }, [volume]);

    // Metadados Zeno
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));
            setCurrentDate(now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }));
        };

        updateClock();
        const timer = setInterval(updateClock, 1000);

        const es = new EventSource(NOWPLAYING_API);

        es.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);

                let title = (data.streamTitle || "").trim();
                if (!title || title.length < 2) title = "Praise FM U.S. - Spot";
                if (isCommercial(title)) title = "Praise FM U.S. - Spot";

                const parts = title.split(" - ");
                const artist = parts[0];
                const song = parts[1] || "Spot";

                setCurrentTitle(`${artist} - ${song}`);

                const cover = await fetchCoverArt(artist, song);
                setCoverUrl(cover);

                addToHistory(song, artist, cover);

                setStatus(isCommercial(song) ? "📢 Commercial Break" : "LIVE • Now Playing");
            } catch {
                setCurrentTitle("Praise FM U.S. - Live");
                setCoverUrl(STREAM_LOGO_URL);
                setStatus("LIVE");
            }
        };

        es.onerror = () => setStatus("Reconnecting...");

        return () => {
            clearInterval(timer);
            es.close();
        };
    }, []);

    // Play/pause
    const handlePlayPause = () => {
        const player = playerRef.current;
        if (!player) return;
        
        if (playing) {
            player.pause();
            setPlaying(false);
            setStatus("Paused");
        } else {
            player.play();
            setPlaying(true);
            setStatus("LIVE • Now Playing");
        }
    };

    return (
        <>
        
{/* ---------------- CSS GLOBAL + FADE ---------------- */}

<style jsx global>{`
    .cover img,
    .hist-img img {
        opacity: 0;
        transition: opacity 0.7s ease-in-out;
    }
    .cover img.loaded,
    .hist-img img.loaded {
        opacity: 1;
    }
`}</style>

{/* ---------------- PLAYER UI ---------------- */}

<div className="player-box">

    {/* LEFT SIDE */}
    <div className="left-area">
        <div className="cover">
            <img
                src={
                    coverUrl &&
                    coverUrl !== "" &&
                    coverUrl !== " " &&
                    coverUrl.length > 10
                        ? coverUrl
                        : STREAM_LOGO_URL
                }
                onError={(e) => {
                    e.target.src = STREAM_LOGO_URL;
                    e.target.classList.add("loaded");
                }}
                onLoad={(e) => e.target.classList.add("loaded")}
                alt="Album Cover"
            />
        </div>

        <div className="title">{currentTitle}</div>
        <div className="clock">{currentDate} • {currentTime}</div>
    </div>

    {/* RIGHT SIDE */}
    <div className="right-area">

        <button className="play-btn" onClick={handlePlayPause}>
            {playing ? "⏸ Pause" : "▶ Play"}
        </button>

        <div className="volume-box">
            <span>🔊</span>
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
            />
        </div>

        <div className="history-area">
            <strong>Recently Played</strong>

            {history.length === 0 ? (
                <div style={{ padding: "12px", color: "#777" }}>No songs yet…</div>
            ) : (
                history.map((item, i) => (
                    <div key={i} className="hist-item">
                        <div className="hist-img">
                            <img
                                src={
                                    item.coverUrl &&
                                    item.coverUrl !== "" &&
                                    item.coverUrl !== " " &&
                                    item.coverUrl.length > 10
                                        ? item.coverUrl
                                        : STREAM_LOGO_URL
                                }
                                onError={(e) => {
                                    e.target.src = STREAM_LOGO_URL;
                                    e.target.classList.add("loaded");
                                }}
                                onLoad={(e) => e.target.classList.add("loaded")}
                                alt="cover"
                            />
                        </div>

                        <div>
                            <div style={{ fontWeight: 600 }}>{item.song}</div>
                            <div style={{ fontSize: "0.8rem", color: "#666" }}>{item.artist}</div>
                        </div>
                    </div>
                ))
            )}
        </div>

        <div className="status">{status}</div>

    </div>

    <audio ref={playerRef} preload="auto" />
</div>

</>
    );
}
