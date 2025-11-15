// app/components/RadioPlayer.jsx
'use client';

import { useState, useEffect, useRef } from 'react';

export default function RadioPlayer() {
    const [playing, setPlaying] = useState(false);
    const [volume, setVolume] = useState(0.7);
    const [status, setStatus] = useState('Connecting to stream... • Real-time updates');
    const [coverUrl, setCoverUrl] = useState('');
    const [currentTitle, setCurrentTitle] = useState('Loading...');
    const [currentDate, setCurrentDate] = useState('—');
    const [currentTime, setCurrentTime] = useState('—');
    const [history, setHistory] = useState([]);
    const [isFavorited, setIsFavorited] = useState(false);
    const [autoplayAttempted, setAutoplayAttempted] = useState(false);

    const playerRef = useRef(null);
    const showImageRef = useRef(null);

    // Configurações
    const STREAM_URL = 'https://stream.zeno.fm/hvwifp8ezc6tv';
    const NOWPLAYING_API = 'https://api.zeno.fm/mounts/metadata/subscribe/hvwifp8ezc6tv';
    const LASTFM_API_KEY = '7744c8f90ee053fc761e0e23bfa00b89';
    // Caminho local para o logo da rádio (deve estar em /public/image/)
    const STREAM_LOGO_URL = "/image/logo-praisefm.webp";
    const MAX_HISTORY = 5;

    // Função para detectar comerciais
    const isCommercial = (title) => {
        const keywords = [
            'commercial', 'advertisement', 'sponsor', 'spot', 'publicidade', 'intervalo', 'break', 'jingle', 'comercial', 'anúncio', 'patrocínio'
        ];
        const lower = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return keywords.some(k => lower.includes(k));
    };

    // Função para buscar capa do álbum
    const fetchCoverArt = async (artist, song) => {
        if (!artist || !song || isCommercial(song) || artist === 'Praise FM U.S.' || song === 'Live') {
            return STREAM_LOGO_URL;
        }
        try {
            const response = await fetch(
                `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(song)}&format=json`
            );
            const data = await response.json();
            if (data.track?.album?.image) {
                const images = data.track.album.image;
                const cover = images.find(img => img.size === 'extralarge') || images[images.length - 1];
                const url = cover['#text'] || '';
                // Verifica se a URL é válida e não é um placeholder
                if (url && !url.includes('noimage') && !url.includes('last.fm')) {
                    return url;
                }
            }
            return STREAM_LOGO_URL;
        } catch (err) {
            console.warn('Failed to fetch cover:', err);
            return STREAM_LOGO_URL;
        }
    };

    // Função para adicionar ao histórico
    const addToHistory = (song, artist, coverUrl) => {
        setHistory(prev => {
            const key = `${artist} - ${song}`;
            let newHistory = [...prev];
            const existingIndex = newHistory.findIndex(item => item.key === key);
            if (existingIndex > -1) {
                newHistory.splice(existingIndex, 1);
            }
            newHistory.unshift({ key, song, artist, coverUrl });
            if (newHistory.length > MAX_HISTORY) {
                newHistory.pop();
            }
            return newHistory;
        });
    };

    // Função para favoritar/desfavoritar
    const toggleFavorite = (key) => {
        let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        const index = favorites.indexOf(key);
        if (index === -1) {
            favorites.push(key);
        } else {
            favorites.splice(index, 1);
        }
        localStorage.setItem('favorites', JSON.stringify(favorites));

        if (key === `${currentTitle}`) {
            setIsFavorited(index === -1);
        }
    };

    // --- Efeito para tentar autoplay automaticamente ---
    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;

        // Configurações iniciais
        player.src = STREAM_URL;
        player.volume = volume;

        // Tenta autoplay assim que o componente for montado
        const attemptAutoplay = async () => {
            if (autoplayAttempted) return;
            setAutoplayAttempted(true);

            try {
                await player.play();
                setPlaying(true);
                setStatus('LIVE • Now Playing');
                console.log("Autoplay iniciado com sucesso!");
            } catch (err) {
                console.warn('Autoplay blocked — user interaction required');
                setStatus('Interaja com a página para ouvir.');
            }
        };

        attemptAutoplay();

        // Evento para tentar autoplay novamente quando o usuário interagir
        const handleInteraction = () => {
            attemptAutoplay();
            // Remover o evento após a primeira interação
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('touchstart', handleInteraction);
            document.removeEventListener('keydown', handleInteraction);
        };

        document.addEventListener('click', handleInteraction);
        document.addEventListener('touchstart', handleInteraction);
        document.addEventListener('keydown', handleInteraction);

        // Cleanup
        return () => {
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('touchstart', handleInteraction);
            document.removeEventListener('keydown', handleInteraction);
        };
    }, []);

    // --- Efeito para atualizar volume do player ---
    useEffect(() => {
        if (playerRef.current) {
            playerRef.current.volume = volume;
        }
    }, [volume]);

    // --- Efeito para SSE (metadados da rádio) ---
    useEffect(() => {
        const player = playerRef.current;
        if (!player) return;

        const updateTime = () => {
            const now = new Date();
            const optionsTime = {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: 'America/Chicago'
            };
            const optionsDate = {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                timeZone: 'America/Chicago'
            };
            setCurrentTime(now.toLocaleTimeString('en-US', optionsTime));
            setCurrentDate(now.toLocaleDateString('en-US', optionsDate));
        };
        updateTime();
        const timeInterval = setInterval(updateTime, 1000);

        const eventSource = new EventSource(NOWPLAYING_API);
        eventSource.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                let streamTitle = (data.streamTitle || '').trim() || 'Unknown Song';
                streamTitle = streamTitle.replace(/[^\p{L}\p{N}\s\-–—.,:;!?'"()&@#$%*+=/\\|<>[\]{}~`^_]/gu, ' ').replace(/\s+/g, ' ').trim();
                if (!streamTitle || streamTitle.length < 3) {
                    streamTitle = 'Praise FM U.S. - Spot';
                }
                const isSpot = isCommercial(streamTitle);
                if (isSpot) {
                    streamTitle = 'Praise FM U.S. - Spot';
                }
                const parts = streamTitle.split(' - ').map(p => p.trim()).filter(Boolean);
                const artist = parts[0] || 'Praise FM U.S.';
                const song = parts.length > 1 ? parts.slice(1).join(' - ') : streamTitle;

                setCurrentTitle(`${artist} - ${song}`);

                const newCover = await fetchCoverArt(artist, song);
                setCoverUrl(newCover);

                const key = `${artist} - ${song}`;
                const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
                setIsFavorited(favorites.includes(key));

                addToHistory(song, artist, newCover);

                setStatus(isSpot ? '📢 Commercial Break' : `LIVE • Now Playing: ${artist} - ${song}`);
            } catch (err) {
                console.warn('Error parsing metadata', err);
                setCurrentTitle('Praise FM U.S. - Live');
                setCoverUrl(STREAM_LOGO_URL);
                setStatus('LIVE • Live');
            }
        };

        eventSource.onerror = () => {
            console.warn('EventSource failed, trying again in 15s...');
            setStatus('Connection failed. Retrying...');
        };

        return () => {
            clearInterval(timeInterval);
            eventSource.close();
        };
    }, []);

    // --- Handlers ---
    const handlePlayPause = () => {
        const player = playerRef.current;
        if (!player) return;

        if (playing) {
            player.pause();
            setStatus('Paused');
        } else {
            player.play().then(() => {
                setStatus('LIVE • Now Playing');
            }).catch(err => {
                setStatus('Failed to play — try again.');
                console.error('Play error:', err);
            });
        }
        setPlaying(!playing);
    };

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        setStatus(`Volume: ${Math.round(newVolume * 100)}%`);
    };

    const handleFavoriteClick = () => {
        if (currentTitle) {
            toggleFavorite(currentTitle);
        }
    };

    return (
        <div className="container">
            <style jsx global>{`
                :root {
                    --primary-color: #ff527c;
                    --secondary-color: #ffffff;
                    --background-color: #f0f4f8;
                    --text-color: #333;
                    --light-text-color: #666;
                    --border-color: #eee;
                }
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    font-family: 'Poppins', sans-serif;
                }
                body {
                    background-color: var(--background-color);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    padding: 20px;
                    overflow: hidden;
                }

                /* Layout responsivo */
                .container {
                    background-color: var(--secondary-color);
                    border-radius: 16px;
                    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.12);
                    width: 100%;
                    max-width: 1000px; /* Aumentei para acomodar o layout horizontal */
                    padding: 32px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                }

                /* Layout Horizontal para telas largas */
                @media (min-width: 1024px) {
                    .container {
                        flex-direction: row;
                        align-items: center;
                        gap: 30px;
                        text-align: left;
                        padding: 40px;
                    }
                }

                .header {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    margin-bottom: 20px;
                    height: 24px;
                }
                .favorite-btn {
                    background: none;
                    border: none;
                    color: var(--light-text-color);
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0 5px;
                    transition: color 0.2s;
                }
                .favorite-btn.favorited {
                    color: #ffb300;
                }

                /* Lado Esquerdo: Imagem e Info */
                .content-left {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    flex: 1; /* Ocupa metade no layout horizontal */
                }

                .station-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--primary-color);
                    margin-bottom: 5px;
                }
                .station-desc {
                    font-size: 0.9rem;
                    color: var(--light-text-color);
                    margin-bottom: 15px;
                }
                .show-image {
                    width: 200px;
                    height: 200px;
                    border-radius: 50%;
                    overflow: hidden;
                    margin-bottom: 25px;
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                    transition: transform 0.3s ease-out, border 0.3s ease-out;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background-color: #f0f0f0;
                }
                .show-image img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }
                .show-image.favorited-cover {
                    border: 3px solid #ffb300;
                    transform: scale(1.02);
                }
                .show-info {
                    margin-bottom: 25px;
                    width: 100%;
                }
                .live-indicator {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--primary-color);
                    text-transform: uppercase;
                    margin-bottom: 5px;
                }
                .show-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-color);
                    margin-bottom: 2px;
                    word-wrap: break-word;
                    white-space: normal;
                }
                .show-date {
                    font-size: 0.8rem;
                    color: var(--light-text-color);
                }

                /* Lado Direito: Controles e Histórico */
                .content-right {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start; /* Alinha à esquerda no layout horizontal */
                    flex: 1; /* Ocupa metade no layout horizontal */
                    gap: 20px;
                }

                .play-button {
                    background-color: var(--primary-color);
                    color: var(--secondary-color);
                    border: none;
                    border-radius: 50px;
                    padding: 12px 30px;
                    font-size: 1.2rem;
                    font-weight: 700;
                    cursor: pointer;
                    width: 100%;
                    max-width: 300px; /* Limita o botão em telas muito largas */
                    transition: background-color 0.2s, box-shadow 0.2s;
                    box-shadow: 0 4px 10px rgba(255, 82, 124, 0.4);
                }
                .play-button:hover {
                    background-color: #e5476d;
                    box-shadow: 0 6px 15px rgba(255, 82, 124, 0.6);
                }
                .volume-control {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    max-width: 300px;
                    padding: 0 10px;
                }
                .volume-control i {
                    color: var(--light-text-color);
                    margin-right: 10px;
                    font-size: 1.1rem;
                }
                .volume-slider {
                    flex-grow: 1;
                    -webkit-appearance: none;
                    appearance: none;
                    height: 4px;
                    background: var(--border-color);
                    border-radius: 5px;
                    outline: none;
                }
                .volume-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 14px;
                    height: 14px;
                    background: var(--primary-color);
                    border-radius: 50%;
                    cursor: pointer;
                }
                .volume-slider::-moz-range-thumb {
                    width: 14px;
                    height: 14px;
                    background: var(--primary-color);
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                }
                .history-section {
                    width: 100%;
                    max-width: 300px;
                }
                .history-title {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-color);
                    margin-bottom: 10px;
                    border-bottom: 1px solid var(--border-color);
                    padding-bottom: 5px;
                }
                .history-list {
                    max-height: 200px;
                    overflow-y: auto;
                }
                .history-item {
                    display: flex;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid #eee;
                }
                .history-item:last-child {
                    border-bottom: none;
                }
                .history-img {
                    width: 40px;
                    height: 40px;
                    border-radius: 4px;
                    overflow: hidden;
                    margin-right: 10px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background-color: var(--background-color);
                }
                .history-img img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .history-text {
                    flex-grow: 1;
                    min-width: 0;
                }
                .history-title-item {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--text-color);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    display: flex;
                    justify-content: space-between;
                }
                .history-artist {
                    font-size: 0.8rem;
                    color: var(--light-text-color);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .favorite-history {
                    cursor: pointer;
                    font-size: 1.1rem;
                    margin-left: 5px;
                    color: var(--light-text-color);
                    transition: color 0.2s;
                }
                .favorite-history[data-key*="★"] {
                    color: #ffb300;
                }
                .status {
                    font-size: 0.8rem;
                    color: var(--light-text-color);
                    padding-top: 20px;
                    border-top: 1px solid var(--border-color);
                    margin-top: 20px;
                    width: 100%;
                    max-width: 300px;
                }
                .sr-only {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    padding: 0;
                    margin: -1px;
                    overflow: hidden;
                    clip: rect(0,0,0,0);
                    border: 0;
                }
            `}</style>

            <div className="content-left">
                <div className="header">
                    <button
                        className={`favorite-btn ${isFavorited ? 'favorited' : ''}`}
                        onClick={handleFavoriteClick}
                        title="Favorite this song"
                        aria-label="Favorite this song"
                    >
                        {isFavorited ? '★' : '☆'}
                    </button>
                </div>
                <div className="station-title">Praise FM U.S.</div>
                <div className="station-desc">Praise & Worship</div>
                <div
                    ref={showImageRef}
                    className={`show-image ${isFavorited ? 'favorited-cover' : ''}`}
                >
                    <img
                        src={coverUrl || STREAM_LOGO_URL}
                        alt="Current song album cover"
                        onError={(e) => {
                            e.target.src = STREAM_LOGO_URL; // Fallback para o logo
                        }}
                    />
                </div>
                <div className="show-info">
                    <div className="live-indicator">LIVE • <span id="currentTime">{currentTime}</span></div>
                    <div className="show-title">
                        <span id="currentTitle">{currentTitle}</span>
                    </div>
                    <div className="show-date" id="currentDate">{currentDate}</div>
                </div>
            </div>
            <div className="content-right">
                <button
                    className="play-button"
                    id="playBtn"
                    onClick={handlePlayPause}
                    aria-label={playing ? 'Pause radio' : 'Play radio'}
                >
                    {playing ? '⏸ Pause' : '▶ Play'}
                </button>
                <div className="volume-control">
                    <label htmlFor="volumeSlider" className="sr-only">Adjust volume</label>
                    <i className="fas fa-volume-up" aria-hidden="true"></i>
                    <input
                        type="range"
                        className="volume-slider"
                        id="volumeSlider"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        aria-valuemin="0"
                        aria-valuenow={volume}
                        role="slider"
                    />
                </div>
                <div className="history-section">
                    <div className="history-title">Recently Played</div>
                    <div className="history-list" id="historyList">
                        {history.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#666', padding: '16px' }}>No songs yet...</div>
                        ) : (
                            history.map((item, index) => {
                                const isItemFavorited = JSON.parse(localStorage.getItem('favorites') || '[]').includes(item.key);
                                return (
                                    <div key={index} className="history-item">
                                        <div className="history-img">
                                            <img
                                                src={item.coverUrl || STREAM_LOGO_URL}
                                                alt={`${item.artist} - ${item.song}`}
                                                onError={(e) => {
                                                    e.target.src = STREAM_LOGO_URL; // Fallback para o logo
                                                }}
                                            />
                                        </div>
                                        <div className="history-text">
                                            <div className="history-title-item">
                                                {item.song}
                                                <span
                                                    className="favorite-history"
                                                    data-key={item.key}
                                                    role="button"
                                                    tabIndex="0"
                                                    aria-label={`Favorite ${item.artist} - ${item.song}`}
                                                    onClick={() => toggleFavorite(item.key)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            toggleFavorite(item.key);
                                                        }
                                                    }}
                                                >
                                                    {isItemFavorited ? '★' : '☆'}
                                                </span>
                                            </div>
                                            <div className="history-artist">{item.artist}</div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
                <div className="status" id="status">{status}</div>
            </div>
            <audio ref={playerRef} preload="auto" aria-hidden="true" />
        </div>
    );
}