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

    // PROGRAM CAPAS
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

    const fetchLastFmCover = async (artist, song) => {
        try {
            const res = await fetch(
                `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(song)}&format=json`
            );
            const data = await res.json();
            const imgs = data?.track?.album?.image;
            if (!imgs) return null;
            const img = imgs.find(i => i.size === "extralarge") || imgs[imgs.length - 1];
            return img?.["#text"] || null;
        } catch (_) {
            return null;
        }
    };

    const fetchDiscogsCover = async (artist, song) => {
        try {
            const q = encodeURIComponent(`${artist} ${song}`);
            const res = await fetch(
                `https://api.discogs.com/database/search?q=${q}&token=${DISCOGS_KEY}&type=release`
            );
            const data = await res.json();
            if (!data.results?.length) return null;
            return data.results[0].cover_image || null;
        } catch (_) {
            return null;
        }
    };

    const fetchCoverArt = async (artist, song) => {
        if (isCommercial(song)) return PROGRAM_COVERS["commercial break"];

        const program = detectProgramCover(artist, song);
        if (program) return program;

        const last = await fetchLastFmCover(artist, song);
        if (last) return last;

        const disc = await fetchDiscogsCover(artist, song);
        if (disc) return disc;

        return STREAM_LOGO_URL;
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

        setInterval(() => {
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
                const song = parts.slice(1).join(" ") || "Spot";

                setCurrentTitle(
                    isCommercial(song) ? "Commercial Break" : `${artist} - ${song}`
                );

                const cover = await fetchCoverArt(artist, song);
                setCoverUrl(cover);

                addToHistory(song, artist, cover);

                setStatus(
                    isCommercial(song)
                        ? "Commercial Break"
                        : `LIVE: ${artist} - ${song}`
                );
            } catch (_) {
                setCoverUrl(STREAM_LOGO_URL);
            }
        };

        return () => sse.close();
    }, []);

    const handlePlayPause = () => {
        const p = playerRef.current;
        if (!playing) p.play();
        else p.pause();
        setPlaying(!playing);
    };

    const handleVolumeChange = (e) => {
        const v = parseFloat(e.target.value);
        setVolume(v);
        if (playerRef.current) playerRef.current.volume = v;
    };

    return (
        <div className="page">
            <style jsx>{`
                .page {
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                    background: #f5f5f5;
                }

                .container {
                    width: 100%;
                    max-width: 950px;
                    background: #fff;
                    border-radius: 20px;
                    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                    padding: 40px;
                    display: flex;
                    gap: 40px;
                    font-family: Poppins, sans-serif;
                }

                @media (max-width: 768px) {
                    .container {
                        flex-direction: column;
                        text-align: center;
                        padding: 25px;
                    }
                }

                .show-image {
                    width: 250px;
                    height: 250px;
                    border-radius: 50%;
                    overflow: hidden;
                    margin-bottom: 20px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    flex-shrink: 0;
                }

                .show-image img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                @media (max-width: 768px) {
                    .show-image {
                        width: 210px;
                        height: 210px;
                        margin: 0 auto 20px auto;
                    }
                }

                .history-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 12px;
                }

                .history-img {
                    width: 45px;
                    height: 45px;
                    border-radius: 6px;
                    object-fit: cover;
                    flex-shrink: 0;
                }

                .volume-slider {
                    width: 100%;
                    height: 4px;
                    border-radius: 50px;
                    background: #ddd;
                    margin: 20px 0;
                    -webkit-appearance: none;
                }

                .volume-slider::-webkit-slider-thumb {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #ff4f79;
                    -webkit-appearance: none;
                }

            `}</style>

            <div className="container">

                <div className="left">
                    <div className="show-image">
                        <img src={coverUrl || STREAM_LOGO_URL} />
                    </div>

                    <h2>{currentTitle}</h2>
                    <p>{currentDate}</p>
                    <p>LIVE • {currentTime}</p>
                </div>

                <div className="right">
                    <button onClick={handlePlayPause}>
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

                    <h3>Recently Played</h3>

                    {history.map((item, i) => (
                        <div key={i} className="history-item">
                            <img src={item.coverUrl} className="history-img" />
                            <div>
                                <div>{item.song}</div>
                                <div>{item.artist}</div>
                            </div>
                        </div>
                    ))}

                    <div className="status">{status}</div>
                </div>

                <audio ref={playerRef} preload="auto" />
            </div>
        </div>
    );
}
