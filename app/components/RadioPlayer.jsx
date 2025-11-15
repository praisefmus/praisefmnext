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

    // LOGO CORRETO
    const STREAM_LOGO_URL = "/logo-praisefm.webp";

    const MAX_HISTORY = 5;

    // Detecta comerciais
    const isCommercial = (text) => {
        const t = text.toLowerCase();
        const words = ["spot", "commercial", "publicidade", "advert", "break", "jingle", "intervalo"];
        return words.some(w => t.includes(w));
    };

    // ----------------------------------------------------------------------
    // APPLE MUSIC FALLBACK – MELHOR RESULTADO
    // ----------------------------------------------------------------------
    const fetchAppleMusicCover = async (artist, song) => {
        try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artist + " " + song)}&limit=1`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.results?.length > 0) {
                let art = data.results[0].artworkUrl100;

                if (art && !art.includes("no_artwork") && !art.includes("placeholder")) {
                    return art.replace("100x100bb", "600x600bb");
                }
            }
        } catch (_) {}

        return null;
    };

    // ----------------------------------------------------------------------
    // LAST.FM FALLBACK
    // ----------------------------------------------------------------------
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

    // ----------------------------------------------------------------------
    // FUNÇÃO FINAL – DECIDE QUAL CAPA USAR
    // ----------------------------------------------------------------------
    const fetchCoverArt = async (artist, song) => {
        const a = artist.toLowerCase();
        const s = song.toLowerCase();

        // SPOT / ANÚNCIO / LIVE / IDENTIFICAÇÃO DA RÁDIO
        if (
            isCommercial(song) ||
            s === "spot" ||
            s.includes("spot") ||
            a.includes("praise fm") ||
            s.includes("live") ||
            s.includes("station") ||
            a.includes("station") ||
            s.includes("advert") ||
            s.includes("publicidade") ||
            s.includes("commercial")
        ) {
            return STREAM_LOGO_URL;
        }

        // 1. Apple Music
        const apple = await fetchAppleMusicCover(artist, song);
        if (apple) return apple;

        // 2. Last.fm
        const last = await fetchLastFmCover(artist, song);
        if (last) return last;

        // 3. fallback → LOGO
        return STREAM_LOGO_URL;
    };

    // ----------------------------------------------------------------------
    // HISTÓRICO
    // ----------------------------------------------------------------------
    const addToHistory = (song, artist, coverUrl) => {
        setHistory(prev => {
            const key = `${artist} - ${song}`;
            let newList = prev.filter(i => i.key !== key);
            newList.unshift({ key, song, artist, coverUrl });
            return newList.slice(0, MAX_HISTORY);
        });
    };

    // ----------------------------------------------------------------------
    // METADADOS (SSE)
    // ----------------------------------------------------------------------
    useEffect(() => {
        const player = playerRef.current;
        player.src = STREAM_URL;
        player.volume = volume;

        // Atualizar relógio
        setInterval(() => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: "America/Chicago"
            }));
            setCurrentDate(now.toLocaleDateString("en-US", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                timeZone: "America/Chicago"
            }));
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

    // ----------------------------------------------------------------------
    // PLAY / PAUSE
    // ----------------------------------------------------------------------
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

    // ----------------------------------------------------------------------
    // INTERFACE
    // ----------------------------------------------------------------------
    return (
        <div className="container">

            <div className="content-left">

                <div className="station-title">Praise FM U.S.</div>
                <div className="station-desc">Praise & Worship</div>

                <div className="show-image">
                    <img
                        src={coverUrl || STREAM_LOGO_URL}
                        alt="Cover"
                        onError={(e) => e.target.src = STREAM_LOGO_URL}
                    />
                </div>

                <div className="show-info">
                    <div className="live-indicator">LIVE • {currentTime}</div>
                    <div className="show-title">{currentTitle}</div>
                    <div className="show-date">{currentDate}</div>
                </div>
            </div>

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
                                onError={(e) => (e.target.src = STREAM_LOGO_URL)}
                                className="history-img"
                            />

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
    );
}
