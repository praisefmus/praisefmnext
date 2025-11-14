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

    const STREAM_LOGO_URL = "/logo-praisefm.webp";
    const MAX_HISTORY = 5;

    const isCommercial = (text) => {
        if (!text) return true;
        const t = text.toLowerCase();
        return ["spot", "commercial", "publicidade", "advert", "break", "jingle", "intervalo"].some(w => t.includes(w));
    };

    // ---- filtro forte de capas ----
    const isBadCover = (artist, song, imageUrl) => {
        if (!imageUrl) return true;

        const badWords = [
            "soundtrack",
            "motion picture",
            "original score",
            "ost",
            "movie",
            "film",
            "theme",
            "tv",
        ];

        const low = imageUrl.toLowerCase();

        if (badWords.some(w => low.includes(w))) return true;

        if (low.includes("600x600") || low.includes("500")) return false;

        return true;
    };

    const fetchAppleMusicCover = async (artist, song) => {
        try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artist + " " + song)}&limit=1`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.results?.length > 0) {
                let art = data.results[0].artworkUrl100.replace("100x100bb", "600x600bb");

                if (!isBadCover(artist, song, art)) return art;
            }
        } catch (_) { }
        return null;
    };

    const fetchLastFmCover = async (artist, song) => {
        try {
            const res = await fetch(
                `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(song)}&format=json`
            );
            const data = await res.json();

            const imgs = data?.track?.album?.image;
            if (!imgs) return null;

            const cover = imgs.find(i => i.size === "extralarge") || imgs[imgs.length - 1];
            const url = cover?.["#text"] ?? "";

            if (!isBadCover(artist, song, url)) return url;

        } catch (_) { }
        return null;
    };

    const fetchCoverArt = async (artist, song) => {
        const a = artist.toLowerCase();
        const s = song.toLowerCase();

        if (isCommercial(song) || a.includes("praise fm") || s === "spot") {
            return STREAM_LOGO_URL;
        }

        const apple = await fetchAppleMusicCover(artist, song);
        if (apple) return apple;

        const last = await fetchLastFmCover(artist, song);
        if (last) return last;

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
        const p = playerRef.current;
        p.src = STREAM_URL;
        p.volume = volume;

        setInterval(() => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Chicago" }));
            setCurrentDate(now.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Chicago" }));
        }, 1000);

        const sse = new EventSource(NOWPLAYING_API);

        sse.onmessage = async e => {
            try {
                const data = JSON.parse(e.data);

                let raw = (data.streamTitle || "").trim();
                if (!raw || raw.length < 3) raw = "Praise FM U.S. - Spot";

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

            } catch {
                setCoverUrl(STREAM_LOGO_URL);
            }
        };

        return () => sse.close();
    }, []);

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

    // ---- volume ----
    const handleVolumeChange = (e) => {
        const v = parseFloat(e.target.value);
        setVolume(v);
        if (playerRef.current) playerRef.current.volume = v;
    };

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

                /* Modern Slider */
                .volume-slider {
                    width: 100%;
                    margin: 10px 0 25px 0;
                    -webkit-appearance: none;
                    appearance: none;
                    height: 4px;
                    background: #ddd;
                    border-radius: 50px;
                    outline: none;
                }

                .volume-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 18px;
                    height: 18px;
                    background: #ff527c;
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 0 10px rgba(255,82,124,0.6);
                }

                .volume-slider::-moz-range-thumb {
                    width: 18px;
                    height: 18px;
                    background: #ff527c;
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 0 10px rgba(255,82,124,0.6);
                }

                .content-left {
                    flex: 1;
                    text-align: center;
                }

                .station-title {
                    font-size: 1.6rem;
                    font-weight: bold;
                    color: #ff527c;
                    margin-bottom: 3px;
                }

                .station-desc {
                    color: #666;
                    font-size: .9rem;
                    margin-bottom: 20px;
                }

                .show-image {
                    width: 230px;
                    height: 230px;
                    border-radius: 50%;
                    overflow: hidden;
                    margin: auto;
                    box-shadow: 0 5px 20px rgba(0,0,0,0.18);
                }

                @media (max-width: 768px) {
                    .show-image {
                        width: 180px;
                        height: 180px;
                    }
                }

                .live-indicator {
                    margin-top: 15px;
                    color: #ff527c;
                    font-weight: 600;
                }

                .show-title {
                    margin-top: 5px;
                    font-weight: 600;
                }

                .show-date {
                    color: #777;
                    font-size: .85rem;
                }

                .content-right {
                    flex: 1;
                }

                .play-button {
                    width: 100%;
                    padding: 15px;
                    border-radius: 50px;
                    border: none;
                    background: #ff527c;
                    color: #fff;
                    cursor: pointer;
                    font-size: 1.2rem;
                    font-weight: bold;
                    margin-bottom: 10px;
                }

                .history-section {
                    margin-top: 20px;
                }

                .history-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    margin-bottom: 10px;
                    text-align: left;
                }

                @media (max-width: 768px) {
                    .history-title {
                        text-align: center;
                    }
                }

                .history-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 10px;
                }

                .history-img {
                    width: 45px;
                    height: 45px;
                    border-radius: 5px;
                    flex-shrink: 0;
                }

                .history-text {
                    text-align: left;
                }

                @media (max-width: 768px) {
                    .history-item {
                        justify-content: center;
                    }
                }

                .status {
                    margin-top: 15px;
                    font-size: .85rem;
                    color: #555;
                }
            `}</style>


            <div className="container">

                <div className="content-left">
                    <div className="station-title">Praise FM U.S.</div>
                    <div className="station-desc">Praise & Worship</div>

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

                    {/* SLIDER DE VOLUME MODERNO */}
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
