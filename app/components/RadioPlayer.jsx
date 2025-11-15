'use client';

import { useState, useEffect, useRef } from 'react';

export default function RadioPlayer() {
    const [playing, setPlaying] = useState(false);
    const [volume, setVolume] = useState(0.7);
    const [status, setStatus] = useState('Connecting to stream...');
    const [coverUrl, setCoverUrl] = useState('');
    const [currentTitle, setCurrentTitle] = useState('Loading...');
    const [currentDate, setCurrentDate] = useState('—');
    const [currentTime, setCurrentTime] = useState('—');
    const [history, setHistory] = useState([]);
    const [isFavorited, setIsFavorited] = useState(false);
    const [autoplayAttempted, setAutoplayAttempted] = useState(false);

    const playerRef = useRef(null);

    const STREAM_URL = 'https://stream.zeno.fm/hvwifp8ezc6tv';
    const NOWPLAYING_API = 'https://api.zeno.fm/mounts/metadata/subscribe/hvwifp8ezc6tv';
    const LASTFM_API_KEY = '7744c8f90ee053fc761e0e23bfa00b89';
    const STREAM_LOGO_URL = "/image/logo-praisefm.webp";
    const MAX_HISTORY = 5;

    // Detecta comerciais
    const isCommercial = (title) => {
        const keywords = ['commercial','advertisement','sponsor','spot','publicidade','intervalo','break','jingle','comercial','anúncio','patrocínio'];
        const lower = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return keywords.some(k => lower.includes(k));
    };

    // Garante fallback para o logo
    const getSafeCover = (url) => (!url || url.includes('noimage') || url.includes('last.fm')) ? STREAM_LOGO_URL : url;

    const fetchCoverArt = async (artist, song) => {
        if (!artist || !song || isCommercial(song) || artist === 'Praise FM U.S.' || song === 'Live') return STREAM_LOGO_URL;
        try {
            const response = await fetch(
                `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(song)}&format=json`
            );
            const data = await response.json();
            const url = data.track?.album?.image?.find(img => img.size === 'extralarge')?.['#text'] || '';
            return getSafeCover(url);
        } catch { return STREAM_LOGO_URL; }
    };

    const addToHistory = (song, artist, cover) => {
        setHistory(prev => {
            const key = `${artist} - ${song}`;
            const newHistory = [...prev.filter(item => item.key !== key)];
            newHistory.unshift({ key, song, artist, coverUrl: getSafeCover(cover) });
            if (newHistory.length > MAX_HISTORY) newHistory.pop();
            return newHistory;
        });
    };

    const toggleFavorite = (key) => {
        let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        const index = favorites.indexOf(key);
        index === -1 ? favorites.push(key) : favorites.splice(index, 1);
        localStorage.setItem('favorites', JSON.stringify(favorites));
        if (key === currentTitle) setIsFavorited(index === -1);
    };

    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;
        player.src = STREAM_URL;
        player.volume = volume;

        const attemptAutoplay = async () => {
            if (autoplayAttempted) return;
            setAutoplayAttempted(true);
            try { await player.play(); setPlaying(true); setStatus('LIVE • Now Playing'); } 
            catch { setStatus('Interaja com a página para ouvir.'); }
        };

        attemptAutoplay();
        const handleInteraction = () => { attemptAutoplay(); document.removeEventListener('click', handleInteraction); document.removeEventListener('touchstart', handleInteraction); document.removeEventListener('keydown', handleInteraction); };
        document.addEventListener('click', handleInteraction);
        document.addEventListener('touchstart', handleInteraction);
        document.addEventListener('keydown', handleInteraction);
        return () => { document.removeEventListener('click', handleInteraction); document.removeEventListener('touchstart', handleInteraction); document.removeEventListener('keydown', handleInteraction); };
    }, []);

    useEffect(() => { if (playerRef.current) playerRef.current.volume = volume; }, [volume]);

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const timeOpts = { hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'America/Chicago' };
            const dateOpts = { day:'2-digit', month:'short', year:'numeric', timeZone:'America/Chicago' };
            setCurrentTime(now.toLocaleTimeString('en-US', timeOpts));
            setCurrentDate(now.toLocaleDateString('en-US', dateOpts));
        };
        updateTime();
        const interval = setInterval(updateTime,1000);

        const es = new EventSource(NOWPLAYING_API);
        es.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                let title = (data.streamTitle || '').trim()
                    .replace(/[^\p{L}\p{N}\s\-–—.,:;!?'"()&@#$%*+=/\\|<>[\]{}~`^_]/gu, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (!title || title.length < 3) title = 'Unknown Track';

                const spot = isCommercial(title);

                const parts = title.split(' - ').map(p => p.trim()).filter(Boolean);
                const artist = parts[0] || 'Praise FM U.S.';
                const song = parts.length > 1 ? parts.slice(1).join(' - ') : title;

                setCurrentTitle(`${artist} - ${song}`);
                const newCover = await fetchCoverArt(artist, song);
                setCoverUrl(newCover);

                const key = `${artist} - ${song}`;
                const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
                setIsFavorited(favorites.includes(key));
                addToHistory(song, artist, newCover);

                // Status comercial ou música real
                setStatus(spot ? '📢 Commercial Break' : `LIVE • Now Playing: ${artist} - ${song}`);

            } catch (err) {
                console.warn('Error parsing metadata', err);
                setCurrentTitle('Praise FM U.S. - Live');
                setCoverUrl(STREAM_LOGO_URL);
                setStatus('LIVE • Live');
            }
        };
        es.onerror = () => setStatus('Connection failed. Retrying...');
        return () => { clearInterval(interval); es.close(); };
    }, []);

    const handlePlayPause = () => {
        const player = playerRef.current;
        if (!player) return;
        if (playing) { player.pause(); setStatus('Paused'); } 
        else player.play().then(()=>setStatus('LIVE • Now Playing')).catch(()=>setStatus('Failed to play — try again.'));
        setPlaying(!playing);
    };

    const handleVolumeChange = (e) => { const v=parseFloat(e.target.value); setVolume(v); setStatus(`Volume: ${Math.round(v*100)}%`); };

    const handleFavoriteClick = () => { if (currentTitle) toggleFavorite(currentTitle); };

    return (
        <div className="container">
            <style jsx>{`
                .show-image img {
                    width: 100%; height:100%; object-fit:cover;
                    border-radius:50%;
                    box-shadow:0 5px 20px rgba(0,0,0,0.3);
                    transition: transform 0.5s ease, opacity 0.5s ease, filter 0.5s ease;
                }
                .show-image img.fallback-logo:hover, .show-image img:hover {
                    transform: scale(1.08);
                    cursor: pointer;
                }
                .live-indicator span:first-child {
                    display:inline-block;
                    width:10px; height:10px;
                    background:red;
                    border-radius:50%;
                    margin-right:6px;
                    animation: pulse 1.5s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(0.8); opacity:0.6; }
                    50% { transform: scale(1.2); opacity:1; }
                    100% { transform: scale(0.8); opacity:0.6; }
                }
            `}</style>

            <div className="content-left">
                <div className="header">
                    <button className={`favorite-btn ${isFavorited?'favorited':''}`} onClick={handleFavoriteClick}>{isFavorited?'★':'☆'}</button>
                </div>
                <div className="station-title">Praise FM U.S.</div>
                <div className="station-desc">Praise & Worship</div>
                <div className={`show-image ${isFavorited?'favorited-cover':''}`}>
                    <img src={getSafeCover(coverUrl)} className={getSafeCover(coverUrl)===STREAM_LOGO_URL?'fallback-logo':''} alt="Album cover" onError={(e)=>{e.currentTarget.src=STREAM_LOGO_URL;}}/>
                </div>
                <div className="show-info">
                    <div className="live-indicator"><span></span>{currentTime}</div>
                    <div className="show-title">{currentTitle}</div>
                    <div className="show-date">{currentDate}</div>
                </div>
            </div>

            <div className="content-right">
                <button className="play-button" onClick={handlePlayPause}>{playing?'⏸ Pause':'▶ Play'}</button>
                <div className="volume-control">
                    <i className="fas fa-volume-up"></i>
                    <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange}/>
                </div>
                <div className="history-section">
                    <div className="history-title">Recently Played</div>
                    <div className="history-list">
                        {history.length===0 ? <div style={{textAlign:'center',color:'#666',padding:'16px'}}>No songs yet...</div> :
                        history.map((item,index)=>{
                            const fav=JSON.parse(localStorage.getItem('favorites')||'[]').includes(item.key);
                            const isLogo=getSafeCover(item.coverUrl)===STREAM_LOGO_URL;
                            return (
                                <div key={index} className="history-item">
                                    <div className="history-img">
                                        <img src={getSafeCover(item.coverUrl)} className={isLogo?'fallback-logo':''} onError={(e)=>{e.currentTarget.src=STREAM_LOGO_URL;}}/>
                                    </div>
                                    <div className="history-text">
                                        <div className="history-title-item">{item.song}
                                            <span className="favorite-history" onClick={()=>toggleFavorite(item.key)}>{fav?'★':'☆'}</span>
                                        </div>
                                        <div className="history-artist">{item.artist}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="status">{status}</div>
            </div>
            <audio ref={playerRef} preload="auto" />
        </div>
    );
}
