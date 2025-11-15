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
    const DISCOGS_KEY = "YhCDaUYXMEnfKtWtAltJfGbYPrSkYnpqhIncSWyX";

    const STREAM_LOGO_URL = "/logo-praisefm.webp";
    const MAX_HISTORY = 5;

    // ---------------------------------------------------------
    // CAPAS PERSONALIZADAS
    // ---------------------------------------------------------
    const PROGRAM_COVERS = {
        "commercial break": "/commercial.webp",
        "praise fm carpool": "/carpool.webp"
    };

    const detectProgramCover = (artist, song) => {
        const text = `${artist} ${song}`.toLowerCase();

        for (const key in PROGRAM_COVERS) {
            if (text.includes(key)) {
                return PROGRAM_COVERS[key];
            }
        }
        return null;
    };

    // ---------------------------------------------------------
    // DETECÇÃO INTELIGENTE DE COMERCIAIS
    // ---------------------------------------------------------
    const isCommercial = (text) => {
        if (!text) return true;

        const t = text.toLowerCase().trim();

        const commercialWords = [
            "spot", "commercial", "publicidade", "advert",
            "ad break", "jingle", "intervalo", "promoção",
            "oferta", "black friday", "loja", "shop", "compra", "desconto"
        ];

        if (commercialWords.some(w => t.includes(w))) return true;

        const programWords = [
            "show", "program", "praise fm", "worship", "devotional",
            "news", "update", "live", "morning", "evening", "afternoon",
            "special", "countdown", "mix", "edition", "segment", "radio"
        ];

        if (programWords.some(w => t.includes(w))) return false;

        if (t.includes(" - ") && t.split(" - ")[1].length > 2) return false;

        return t.length < 3;
    };

    // ---------------------------------------------------------
    // FILTRO DE CAPAS RUINS
    // ---------------------------------------------------------
    const isBadCover = (artist, song, url) => {
        if (!url) return true;

        const badWords = [
            "soundtrack", "motion picture", "original score",
            "film", "movie", "ost", "theme", "tv"
        ];

        const low = url.toLowerCase();

        if (badWords.some(w => low.includes(w))) return true;
        if (low.includes("noimage") || low.includes("placeholder")) return true;

        return false;
    };

    // ---------------------------------------------------------
    // LAST.FM
    // ---------------------------------------------------------
    const fetchLastFmCover = async (artist, song) => {
        try {
            const res = await fetch(
                `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_KEY}&artist=${encodeURIComponent(
                    artist
                )}&track=${encodeURIComponent(song)}&format=json`
            );

            const data = await res.json();
            const imgs = data?.track?.album?.image;
            if (!imgs) return null;

            const img = imgs.find(i => i.size === "extralarge") || imgs[imgs.length - 1];
            const url = img?.["#text"] ?? "";

            if (!isBadCover(artist, song, url)) return url;
        } catch (_) {}

        return null;
    };

    // ---------------------------------------------------------
    // DISCOGS
    // ---------------------------------------------------------
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
        } catch (_) {}

        return null;
    };

    // ---------------------------------------------------------
    // CAPA FINAL
    // ---------------------------------------------------------
    const fetchCoverArt = async (artist, song) => {
        const isComm = isCommercial(song);

        if (isComm) return PROGRAM_COVERS["commercial break"];

        const programCover = detectProgramCover(artist, song);
        if (programCover) return programCover;

        const lastFm = await fetchLastFmCover(artist, song);
        if (lastFm) return lastFm;

        const discogs = await fetchDiscogsCover(artist, song);
        if (discogs) return discogs;

        return STREAM_LOGO_URL;
    };

    // ---------------------------------------------------------
    // HISTÓRICO
    // ---------------------------------------------------------
    const addToHistory = (song, artist, cover) => {
        if (isCommercial(song)) return;

        setHistory(prev => {
            const key = `${artist} - ${song}`;
            let list = prev.filter(i => i.key !== key);
            list.unshift({ key, song, artist, coverUrl: cover });
            return list.slice(0, MAX_HISTORY);
        });
    };

    // ---------------------------------------------------------
    // METADADOS AO VIVO (SSE)
    // ---------------------------------------------------------
    useEffect(() => {
        const p = playerRef.current;
        p.src = STREAM_URL;
        p.volume = volume;

        setInterval(() => {
            const now = new Date();
            setCurrentTime(
                now.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                    timeZone: "America/Chicago"
                })
            );
            setCurrentDate(
                now.toLocaleDateString("en-US", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    timeZone: "America/Chicago"
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
                const artist = parts[0];
                const song = parts.slice(1).join(" ") || "Spot";

                if (isCommercial(song)) {
                    setCurrentTitle("Commercial Break");
                } else {
                    setCurrentTitle(`${artist} - ${song}`);
                }

                const cover = await fetchCoverArt(artist, song);
                setCoverUrl(cover);

                addToHistory(song, artist, cover);

                setStatus(isCommercial(song) ? "Commercial Break" : `LIVE: ${artist} - ${song}`);
            } catch (_) {
                setCoverUrl(STREAM_LOGO_URL);
            }
        };

        return () => sse.close();
    }, []);

    // ---------------------------------------------------------
    // PLAYER
    // ---------------------------------------------------------
    const handlePlayPause = () => {
        const p = playerRef.current;
        if (!playing) p.play();
        else p.pause();
        setPlaying(!playing);
    };

    const handleVolumeChange = e => {
        const v = parseFloat(e.target.value);
        setVolume(v);
        if (playerRef.current) playerRef.current.volume = v;
    };

    // ---------------------------------------------------------
    // UI
    // ---------------------------------------------------------
    return (
        <div className="wrapper">

            <style jsx>{`
                .wrapper {
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                    background: #f5f5f5;
                }

                .container {
                    background: #fff;
                    width: 100%;
                    max-width: 950px;
                    border-radius: 20px;
                    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                    padding: 30px;
                    display: flex;
                    gap: 40px;
                    font-family: Poppins, sans-serif;
                }

                @media (max-width: 768px) {
                    .container {
                        flex-direction: column;
                        text-align: center;
                        padding: 22px;
                        gap: 25px;
                    }
                }

                /* CAPA (CORRIGIDO) */
                .show-image {
                    width: 230px;
                    height: 230px;
                    border-radius: 50%;
                    overflow: hidden;
                    margin: 25px auto;
                    box-shadow: 0 5px 18px rgba(0,0,0,0.18);
                    flex-shrink: 0;
                }

                .show-image img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                @media (max-width: 768px) {
                    .show-image {
                        width: 180px;
                        height: 180px;
                    }
                }

                /* HISTÓRICO CORRIGIDO */
                .history-item {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-bottom: 12px;
                    width: 100%;
                }

                .history-img {
                    width: 48px;
                    height: 48px;
                    border-radius: 6px;
                    flex-shrink: 0;
                    object-fit: cover;
                }

                .history-text {
                    flex: 1;
                    text-align: left;
                }

                @media (max-width: 768px) {
                    .history-item {
                        justify-content: flex-start;
                        max-width: 90%;
                        margin: 0 auto 12px auto;
                    }
                }
            `}</style>

            <div className="container">

                <div className="content-left">
                    <div className="station-title">Praise FM U.S.</div>

                    <div className="show-image">
                        <img src={coverUrl || STREAM_LOGO_URL} />
                    </div>

                    <div className="live-indicator">LIVE • {currentTime}</div>
                    <div className="show-title">{currentTitle}</div>
                    <div className="show-date">{currentDate}</div>
                </div>

                <div className="content-right">

                    <button className="play-button" onClick={handlePlayPause}>
                        {playing ? "⏸ Pause" : "▶ Play"}
                    </button>

                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="volume-slider"
                    />

                    <div className="history-section">
                        <div className="history-title">Recently Played</div>

                        {history.map((item, i) => (
                            <div key={i} className="history-item">
                                <img src={item.coverUrl || STREAM_LOGO_URL} className="history-img" />

                                <div className="history-text">
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
        </div>
    );
}
