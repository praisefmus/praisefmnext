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

    const playerRef = useRef(null);

    const STREAM_URL = "https://stream.zeno.fm/hvwifp8ezc6tv";
    const NOWPLAYING_API = "https://api.zeno.fm/mounts/metadata/subscribe/hvwifp8ezc6tv";

    const LASTFM_KEY = "7744c8f90ee053fc761e0e23bfa00b89";

    // Caminho correto no /public
    const STREAM_LOGO_URL = "/logo-praisefm.webp";

    const MAX_HISTORY = 5;

    // -------------------------------------------------------------------
    // DETECTA COMERCIAIS
    // -------------------------------------------------------------------
    const isCommercial = (text) => {
        if (!text) return true;
        const t = text.toLowerCase();
        const words = ["spot", "commercial", "publicidade", "advert", "break", "jingle", "intervalo"];
        return words.some(w => t.includes(w));
    };

    // -------------------------------------------------------------------
    // APPLE MUSIC COVER
    // -------------------------------------------------------------------
    const fetchAppleMusicCover = async (artist, song) => {
        try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artist + " " + song)}&limit=1`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.results?.length > 0) {
                let art = data.results[0].artworkUrl100;
                return art.replace("100x100bb", "600x600bb");
            }
        } catch (_) {}

        return null;
    };

    // -------------------------------------------------------------------
    // LAST.FM COVER
    // -------------------------------------------------------------------
    const fetchLastFmCover = async (artist, song) => {
        try {
            const res = await fetch(
                `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(song)}&format=json`
            );
            const data = await res.json();

            const images = data?.track?.album?.image;
            if (images) {
                const cover = images.find(img => img.size === "extralarge") || images[images.length - 1];
                const url = cover?.["#text"] ?? "";

                if (url && !url.includes("noimage") && !url.endsWith(".gif")) {
                    return url;
                }
            }
        } catch (_) {}

        return null;
    };

    // -------------------------------------------------------------------
    // FINAL COVER LOGIC — SEMPRE FUNCIONA
    // -------------------------------------------------------------------
    const fetchCoverArt = async (artist, song) => {
        const a = artist.toLowerCase();
        const s = song.toLowerCase();

        // Se for Spot, Comercial, Identificação da rádio → LOGO
        if (
            isCommercial(song) ||
            a.includes("praise fm") ||
            s.includes("live") ||
            s.includes("station") ||
            s === "spot"
        ) {
            return STREAM_LOGO_URL;
        }

        // 1. Apple Music
        const apple = await fetchAppleMusicCover(artist, song);
        if (apple) return apple;

        // 2. Last.fm
        const last = await fetchLastFmCover(artist, song);
        if (last) return last;

        // 3. fallback TOTAL → LOGO
        return STREAM_LOGO_URL;
    };

    // -------------------------------------------------------------------
    // HISTÓRICO
    // -------------------------------------------------------------------
    const addToHistory = (song, artist, coverUrl) => {
        setHistory(prev => {
            const key = `${artist} - ${song}`;
            let newList = prev.filter(i => i.key !== key);
            newList.unshift({ key, song, artist, coverUrl });
            return newList.slice(0, MAX_HISTORY);
        });
    };

    // -------------------------------------------------------------------
    // METADADOS — SSE STREAM
    // -------------------------------------------------------------------
    useEffect(() => {
        const player = playerRef.current;
        player.src = STREAM_URL;
        player.volume = volume;

        // Relógio
        setInterval(() => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Chicago" }));
            setCurrentDate(now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Chicago" }));
        }, 1000);

        const sse = new EventSource(NOWPLAYING_API);

        sse.onmessage = async (e) => {
            try {
                const data = JSON.parse(e.data);

                let raw = (data.streamTitle || "").trim();
                if (!raw || raw.length < 3) raw = "Praise FM U.S. - Spot";

                const parts = raw.split(" - ");
                const artist = parts[0];
                const song = parts.slice(1).join(" ") || "Spot";

                setCurrentTitle(`${artist} - ${song}`);

                const cover = await fetchCoverArt(artist, song);

                setCoverUrl(cover);
                addToHistory(song, artist, cover);

                setStatus(isCommercial(song) ? "Commercial Break" : `LIVE: ${artist} - ${song}`);

            } catch (err) {
                setCoverUrl(STREAM_LOGO_URL);
            }
        };

        return () => sse.close();
    }, []);

    // -------------------------------------------------------------------
    // PLAY / PAUSE
    // -------------------------------------------------------------------
    const handlePlayPause = () => {
        const p = playerRef.current;

        if (!playing) {
            p.play();
            setStatus("LIVE");
        } else {
            p.pause();
            setStatus("Paused");
        }

        setPlaying(!playing);
    };

    // -------------------------------------------------------------------
    // INTERFACE — LAYOUT ORIGINAL COMPLETO
    // -------------------------------------------------------------------
    return (
        <div className="container">

            <style jsx>{`
                .container {
                    width: 100%;
                    max-width: 900px;
                    padding: 20px;
                    margin: auto;
                    display: flex;
                    gap: 40px;
                    font-family: Poppins, sans-serif;
                }

                .content-left {
                    flex: 1;
                    text-align: center;
                }

                .station-title {
                    font-size: 1.6rem;
                    font-weight: bold;
                    color: #ff527c;
                }

                .station-desc {
                    font-size: .9rem;
                    color: #777;
                    margin-bottom: 10px;
                }

                .show-image {
                    width: 220px;
                    height: 220px;
                    border-radius: 50%;
                    overflow: hidden;
                    margin: 20px auto;
                    box-shadow: 0 5px 15px rgba(0,0,0,.2);
                }

                .show-image img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .live-indicator {
                    font-size: .8rem;
                    color: #ff527c;
                    text-transform: uppercase;
                    margin-bottom: 5px;
                }

                .show-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                }

                .show-date {
                    color: #777;
                    font-size: .8rem;
                }

                .content-right {
                    flex: 1;
                }

                .play-button {
                    width: 100%;
                    padding: 12px;
                    border-radius: 50px;
                    background: #ff527c;
                    color: white;
                    border: none;
                    cursor: pointer;
                    font-size: 1.2rem;
                    font-weight: bold;
                    margin-bottom: 20px;
                }

                .history-section {
                    margin-top: 20px;
                }

                .history-item {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 10px;
                }

                .history-img {
                    width: 40px;
                    height: 40px;
                    border-radius: 5px;
                }

                .history-title-item {
                    font-size: 0.9rem;
                    font-weight: bold;
                }

                .history-artist {
                    font-size: 0.8rem;
                    color: #888;
                }

                .status {
                    margin-top: 20px;
                    color: #555;
                }
            `}</style>

            {/* LADO ESQUERDO */}
            <div className="content-left">
                <div className="station-title">Praise FM U.S.</div>
                <div className="station-desc">Praise & Worship</div>

                <div className="show-image">
                    <img
                        src={coverUrl || STREAM_LOGO_URL}
                        onError={(e) => e.target.src = STREAM_LOGO_URL}
                    />
                </div>

                <div className="live-indicator">LIVE • {currentTime}</div>
                <div className="show-title">{currentTitle}</div>
                <div className="show-date">{currentDate}</div>
            </div>

            {/* LADO DIREITO */}
            <div className="content-right">

                <button className="play-button" onClick={handlePlayPause}>
                    {playing ? "⏸ Pause" : "▶ Play"}
                </button>

                <div className="history-section">
                    <div className="history-title">Recently Played</div>

                    {history.map((item, i) => (
                        <div key={i} className="history-item">
                            <img
                                src={item.coverUrl || STREAM_LOGO_URL}
                                className="history-img"
                                onError={(e) => (e.target.src = STREAM_LOGO_URL)}
                            />

                            <div>
                                <div className="history-title-item">{item.song}</div>
                                <div className="history-artist">{item.artist}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="status">{status}</div>
            </div>

            <audio ref={playerRef} preload="auto" />
        </div>
    );
}
