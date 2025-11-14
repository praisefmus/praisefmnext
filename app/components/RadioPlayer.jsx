// app/components/RadioPlayer.jsx
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
    const [isFavorited, setIsFavorited] = useState(false);
    const [autoplayAttempted, setAutoplayAttempted] = useState(false);

    const playerRef = useRef(null);

    // STREAM + API
    const STREAM_URL = "https://stream.zeno.fm/hvwifp8ezc6tv";
    const NOWPLAYING_API = "https://api.zeno.fm/mounts/metadata/subscribe/hvwifp8ezc6tv";
    const LASTFM_API_KEY = "7744c8f90ee053fc761e0e23bfa00b89";

    // LOGO fallback
    const STREAM_LOGO_URL =
        "https://raw.githubusercontent.com/praisefmus/praisefmnext/main/image/LOGOPNG%20PRAISEFMUS.webp";

    const MAX_HISTORY = 5;

    // Detectar comerciais
    const isCommercial = (title) => {
        const keywords = [
            "commercial", "advertisement", "sponsor", "spot", "publicidade", "intervalo",
            "break", "jingle", "comercial", "anuncio", "patrocinio"
        ];
        const lower = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return keywords.some(k => lower.includes(k));
    };

    // Buscar capa — versão corrigida
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

                const url = cover['#text']?.trim() || "";
                if (url !== "") return url;
            }

            return STREAM_LOGO_URL;
        } catch (e) {
            return STREAM_LOGO_URL;
        }
    };

    // Histórico
    const addToHistory = (song, artist, coverUrl) => {
        setHistory(prev => {
            const key = `${artist} - ${song}`;
            let newHist = [...prev];

            const idx = newHist.findIndex(item => item.key === key);
            if (idx > -1) newHist.splice(idx, 1);

            newHist.unshift({ key, song, artist, coverUrl });

            if (newHist.length > MAX_HISTORY) newHist.pop();
            return newHist;
        });
    };

    // Autoplay
    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;

        player.src = STREAM_URL;
        player.volume = volume;

        const attempt = async () => {
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

        attempt();

        const again = () => { attempt(); };
        document.addEventListener("click", again);
        document.addEventListener("touchstart", again);

        return () => {
            document.removeEventListener("click", again);
            document.removeEventListener("touchstart", again);
        };
    }, []);

    // Volume
    useEffect(() => {
        if (playerRef.current) playerRef.current.volume = volume;
    }, [volume]);

    // STREAM METADATA
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));
            setCurrentDate(now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }));
        };

        updateClock();
        const t = setInterval(updateClock, 1000);

        const es = new EventSource(NOWPLAYING_API);

        es.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);

                let title = (data.streamTitle || "").trim();

                if (!title || title.length < 3) title = "Praise FM U.S. - Spot";
                if (isCommercial(title)) title = "Praise FM U.S. - Spot";

                const parts = title.split(" - ");
                const artist = parts[0] || "Praise FM U.S.";
                const song = parts[1] || "Spot";

                setCurrentTitle(`${artist} - ${song}`);

                const cover = await fetchCoverArt(artist, song);
                setCoverUrl(cover);

                addToHistory(song, artist, cover);

                setStatus(isCommercial(song) ? "📢 Commercial Break" : `LIVE • Now Playing`);
            } catch {
                setCurrentTitle("Praise FM U.S. - Live");
                setCoverUrl(STREAM_LOGO_URL);
                setStatus("LIVE");
            }
        };

        es.onerror = () => setStatus("Reconnecting...");

        return () => {
            clearInterval(t);
            es.close();
        };
    }, []);

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

            {/* -------- CSS GLOBAL RESPONSIVO -------- */}
            <style jsx global>{`
                :root {
                    --primary: #ff527c;
                    --card: #ffffff;
                    --bg: #f3f4f6;
                    --text: #222;
                    --muted: #555;
                }

                body {
                    background: var(--bg);
                    font-family: "Poppins", sans-serif;
                    padding: 0;
                    margin: 0;
                }

                .player-container {
                    max-width: 1100px;
                    margin: auto;
                    background: var(--card);
                    padding: 24px;
                    border-radius: 18px;
                    box-shadow: 0 8px 28px rgba(0,0,0,0.08);
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                /* Layout Desktop */
                @media (min-width: 900px) {
                    .player-container {
                        flex-direction: row;
                        align-items: flex-start;
                        padding: 40px;
                        gap: 40px;
                    }
                }

                .left-area {
                    flex: 1;
                    text-align: center;
                }

                @media (min-width: 900px) {
                    .left-area { text-align: left; }
                }

                .cover {
                    width: 230px;
                    height: 230px;
                    border-radius: 50%;
                    overflow: hidden;
                    margin: 0 auto 20px;
                    background: #ddd;
                }

                @media (min-width: 900px) {
                    .cover {
                        width: 260px;
                        height: 260px;
                    }
                }

                .cover img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .now-title {
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: var(--text);
                }

                .clock {
                    margin-top: 6px;
                    color: var(--muted);
                }

                .right-area {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                .play-btn {
                    padding: 14px;
                    background: var(--primary);
                    color: #fff;
                    font-size: 1.2rem;
                    border: none;
                    border-radius: 50px;
                    cursor: pointer;
                    font-weight: 700;
                }

                .vol-box {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }

                input[type="range"] {
                    width: 100%;
                }

                /* Histórico */
                .history-box {
                    background: #fafafa;
                    padding: 16px;
                    border-radius: 12px;
                }

                .hist-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 0;
                    border-bottom: 1px solid #eee;
                }

                .hist-item:last-child {
                    border-bottom: none;
                }

                .hist-img {
                    width: 45px;
                    height: 45px;
                    border-radius: 6px;
                    overflow: hidden;
                    background: #ddd;
                }

                .status-line {
                    padding-top: 10px;
                    font-size: 0.9rem;
                    color: var(--muted);
                }
            `}</style>

            {/* -------- PLAYER -------- */}
            <div className="player-container">

                {/* LEFT */}
                <div className="left-area">
                    <div className="cover">
                        <img src={coverUrl || STREAM_LOGO_URL} alt="Album Cover" />
                    </div>

                    <div className="now-title">{currentTitle}</div>
                    <div className="clock">{currentDate} • {currentTime}</div>
                </div>

                {/* RIGHT */}
                <div className="right-area">

                    <button className="play-btn" onClick={handlePlayPause}>
                        {playing ? "⏸ Pause" : "▶ Play"}
                    </button>

                    <div className="vol-box">
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

                    <div className="history-box">
                        <strong>Recently Played</strong>

                        {history.length === 0 ? (
                            <div style={{ padding: "12px", color: "#777" }}>No songs yet…</div>
                        ) : (
                            history.map((item, i) => (
                                <div key={i} className="hist-item">
                                    <div className="hist-img">
                                        <img src={item.coverUrl || STREAM_LOGO_URL} alt="cover" />
                                    </div>

                                    <div>
                                        <div style={{ fontWeight: 600 }}>{item.song}</div>
                                        <div style={{ fontSize: "0.8rem", color: "#666" }}>{item.artist}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="status-line">{status}</div>
                </div>

                <audio ref={playerRef} preload="auto" />
            </div>
        </>
    );
}
