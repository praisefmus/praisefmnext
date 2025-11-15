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

    const fetchCoverArt = async (artist, song) => {
        if (isCommercial(song)) return PROGRAM_COVERS["commercial break"];
        const programCover = detectProgramCover(artist, song);
        if (programCover) return programCover;
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
        if (audio) {
            audio.src = STREAM_URL;
            audio.volume = volume;
        }

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

                setStatus(isCommercial(song) ? "Commercial Break" : `LIVE: ${artist} - ${song}`);
            } catch (_) {
                setCoverUrl(STREAM_LOGO_URL);
            }
        };

        return () => {
            clearInterval(clock);
            sse.close();
        };
    }, []);

    const handlePlayPause = () => {
        const p = playerRef.current;
        if (!p) return;
        if (!playing) p.play();
        else p.pause();
        setPlaying(!playing);
    };

    const handleVolumeChange = e => {
        const v = parseFloat(e.target.value);
        setVolume(v);
        if (playerRef.current) playerRef.current.volume = v;
    };

    return (
        <div className="page">
            <style jsx>{`
                :root {
                    --accent: #444;
                }

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
                    box-shadow: 0 10px 35px rgba(0,0,0,0.08);
                    padding: 35px;
                    display: flex;
                    gap: 40px;
                    font-family: Poppins, sans-serif;
                }

                @media (max-width: 780px) {
                    .container {
                        flex-direction: column;
                        text-align: center;
                        padding: 24px;
                    }
                }

                .left {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .title {
                    font-weight: 700;
                    font-size: 1.6rem;
                    color: var(--accent);
                    margin-bottom: 10px;
                }

                .showImage {
                    width: 240px;
                    height: 240px;
                    border-radius: 50%;
                    overflow: hidden;
                    box-shadow: 0 8px 20px rgba(0,0,0,0.15);
                    margin-bottom: 16px;
                    flex-shrink: 0;
                }
                .showImage img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                @media (max-width: 780px) {
                    .showImage {
                        width: 195px;
                        height: 195px;
                    }
                }

                .right {
                    flex: 1;
                }

                /* BOTÃO PLAY/PAUSE CINZA */
                .playButton {
                    width: 100%;
                    height: 64px;
                    border-radius: 14px;
                    background: linear-gradient(180deg, #555, #3f3f3f);
                    border: none;
                    cursor: pointer;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    box-shadow: 0 8px 18px rgba(0,0,0,0.22);
                    transition: transform .14s ease, box-shadow .14s ease;
                }
                .playButton:active {
                    transform: translateY(1px) scale(0.995);
                }

                .icon {
                    width: 34px;
                    height: 34px;
                    fill: #ffffffcc;
                    transition: opacity .12s ease, transform .15s ease;
                }

                /* SLIDER */
                .slider {
                    width: 100%;
                    margin: 16px 0 24px 0;
                }
                .slider input {
                    width: 100%;
                    height: 4px;
                    border-radius: 50px;
                    -webkit-appearance: none;
                    background: #ddd;
                }
                .slider input::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: var(--accent);
                }

                .historyItem {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 0;
                }

                .historyImg {
                    width: 48px;
                    height: 48px;
                    object-fit: cover;
                    border-radius: 6px;
                }

                .status {
                    text-align: center;
                    margin-top: 12px;
                    color: #444;
                }
            `}</style>

            <div className="container">
                <div className="left">
                    <div className="title">Praise FM U.S.</div>

                    <div className="showImage">
                        <img src={coverUrl || STREAM_LOGO_URL} />
                    </div>

                    <h3>{currentTitle}</h3>
                    <p>{currentDate}</p>
                    <p>LIVE • {currentTime}</p>
                </div>

                <div className="right">

                    <button className="playButton" onClick={handlePlayPause}>
                        {!playing ? (
                            <svg className="icon" viewBox="0 0 64 64">
                                <path d="M16 12v40l36-20L16 12z"/>
                            </svg>
                        ) : (
                            <svg className="icon" viewBox="0 0 64 64">
                                <rect x="14" y="12" width="10" height="40" rx="3"/>
                                <rect x="40" y="12" width="10" height="40" rx="3"/>
                            </svg>
                        )}
                    </button>

                    <div className="slider">
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={handleVolumeChange}
                        />
                    </div>

                    <h3>Recently Played</h3>
                    {history.map((item, i) => (
                        <div key={i} className="historyItem">
                            <img src={item.coverUrl} className="historyImg" />
                            <div>
                                <div><strong>{item.song}</strong></div>
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
