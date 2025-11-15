'use client';

import { useEffect, useRef, useState } from 'react';

export default function RadioPlayer() {
    // Referências para elementos DOM
    const playerRef = useRef(null);
    const playBtnRef = useRef(null);
    const volumeSliderRef = useRef(null);
    const statusTextRef = useRef(null);
    const coverImgRef = useRef(null);
    const currentTitleElRef = useRef(null);
    const currentDateElRef = useRef(null);
    const currentTimeElRef = useRef(null);
    const historyListRef = useRef(null);
    const favoriteBtnRef = useRef(null);
    const showImageElRef = useRef(null);

    // Estados
    const [playing, setPlaying] = useState(false);
    const [currentTrackKey, setCurrentTrackKey] = useState('');
    const [history, setHistory] = useState([]);
    const [currentSong, setCurrentSong] = useState('');
    const [currentArtist, setCurrentArtist] = useState('');
    const [volume, setVolume] = useState(0.7);

    // Configurações
    const STREAM_URL = 'https://stream.zeno.fm/hvwifp8ezc6tv';
    const NOWPLAYING_API = 'https://api.zeno.fm/mounts/metadata/subscribe/hvwifp8ezc6tv';
    const LASTFM_API_KEY = '7744c8f90ee053fc761e0e23bfa00b89';
    const STREAM_LOGO_URL = 'https://raw.githubusercontent.com/praisefmus/praisefm/main/image/LOGOPNG%20PRAISEFMUS.png';
    const MAX_HISTORY = 5;

    // Função para adicionar música ao histórico
    const addToHistory = (song, artist, coverUrl = '') => {
        const key = `${artist} - ${song}`;
        if (key === currentTrackKey) return;

        setCurrentTrackKey(key);

        setHistory(prevHistory => {
            let newHistory = [...prevHistory];
            const existingIndex = newHistory.findIndex(item => item.song === song && item.artist === artist);
            if (existingIndex !== -1) {
                newHistory.splice(existingIndex, 1);
            }
            newHistory.unshift({ song, artist, coverUrl });
            if (newHistory.length > MAX_HISTORY) newHistory = newHistory.slice(0, MAX_HISTORY);
            return newHistory;
        });
    };

    // Função para renderizar o histórico
    const renderHistory = () => {
        if (!historyListRef.current) return;

        if (history.length === 0) {
            historyListRef.current.innerHTML = '<div style="text-align:center;color:#666;padding:16px;">No songs yet...</div>';
            return;
        }

        // Constrói o HTML do histórico usando strings
        let historyHTML = '';
        history.forEach(item => {
            const key = `${item.artist} - ${item.song}`;
            const isFavorited = JSON.parse(localStorage.getItem('favorites') || '[]').includes(key) ? '★' : '☆';
            // Corrigido: Agora usando strings HTML corretamente dentro de innerHTML
            historyHTML += `
                <div class="history-item">
                    <div class="history-img">
                        ${item.coverUrl && item.coverUrl !== STREAM_LOGO_URL ? `<img src="${item.coverUrl}" alt="${item.artist} - ${item.song}">` : `<img src="${STREAM_LOGO_URL}" alt="Praise FM U.S. Logo" />`}
                    </div>
                    <div class="history-text">
                        <div class="history-title-item">
                            ${item.song}
                            <span class="favorite-history" data-key="${key}" role="button" tabindex="0" aria-label="Favorite ${item.artist} - ${item.song}">${isFavorited}</span>
                        </div>
                        <div class="history-artist">${item.artist}</div>
                    </div>
                </div>
            `;
        });

        historyListRef.current.innerHTML = historyHTML;

        // Adiciona eventos aos botões de favoritar do histórico
        document.querySelectorAll('.favorite-history').forEach(el => {
            const handleClick = (e) => {
                e.stopPropagation();
                toggleFavorite(el.dataset.key, el);
            };
            const handleKeyDown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleFavorite(el.dataset.key, el);
                }
            };

            // Limpa eventos antigos para evitar duplicação
            el.removeEventListener('click', handleClick);
            el.removeEventListener('keydown', handleKeyDown);
            el.addEventListener('click', handleClick);
            el.addEventListener('keydown', handleKeyDown);
        });
    };

    // Função para alternar favorito
    const toggleFavorite = (key, element = null) => {
        let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        const index = favorites.indexOf(key);
        if (index === -1) {
            favorites.push(key);
        } else {
            favorites.splice(index, 1);
        }
        localStorage.setItem('favorites', JSON.stringify(favorites));

        if (key === `${currentArtist} - ${currentSong}`) {
            if (favoriteBtnRef.current) {
                favoriteBtnRef.current.textContent = index === -1 ? '★' : '☆';
                favoriteBtnRef.current.classList.toggle('favorited', index === -1);
            }
            if (showImageElRef.current) {
                showImageElRef.current.classList.toggle('favorited-cover', index === -1);
            }
        }

        if (element) {
            element.textContent = index === -1 ? '★' : '☆';
        }
        updateFavoriteButton();
    };

    // Função para atualizar o botão de favorito principal
    const updateFavoriteButton = () => {
        if (!currentSong || !currentArtist || !favoriteBtnRef.current || !showImageElRef.current) return;
        const key = `${currentArtist} - ${currentSong}`;
        const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        const isFavorited = favorites.includes(key);
        favoriteBtnRef.current.textContent = isFavorited ? '★' : '☆';
        favoriteBtnRef.current.classList.toggle('favorited', isFavorited);
        showImageElRef.current.classList.toggle('favorited-cover', isFavorited);
    };

    // Função para verificar se é um comercial
    const isCommercial = (title) => {
        const keywords = [
            'commercial', 'advertisement', 'sponsor', 'spot', 'publicidade', 'intervalo', 'break', 'jingle', 'comercial', 'anúncio', 'patrocínio'
        ];
        const lower = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return keywords.some(k => lower.includes(k));
    };

    // Função para buscar capa do álbum via Last.fm
    const fetchCoverArt = async (artist, song) => {
        if (!artist || !song || isCommercial(song) || artist === 'Praise FM U.S.' || song === 'Live') {
            return STREAM_LOGO_URL;
        }
        try {
            const res = await fetch(
                `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(song)}&format=json`
            );
            const data = await res.json();
            if (data.track?.album?.image) {
                const images = data.track.album.image;
                const cover = images.find(img => img.size === 'extralarge') || images[images.length - 1];
                return cover['#text'] || STREAM_LOGO_URL;
            }
            return STREAM_LOGO_URL;
        } catch (err) {
            console.warn('Failed to fetch cover:', err);
            return STREAM_LOGO_URL;
        }
    };

    // Função para verificar se a imagem é inválida
    const isInvalidCover = (imageUrl) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(false);
            img.onerror = () => resolve(true);
            img.src = imageUrl;
            setTimeout(() => resolve(true), 5000);
        });
    };

    // Função para alternar exibição da capa
    const toggleCoverDisplay = (showImage = true, imageUrl = '') => {
        if (!coverImgRef.current) return;
        if (showImage && imageUrl && imageUrl !== STREAM_LOGO_URL) {
            coverImgRef.current.src = imageUrl;
        } else {
            coverImgRef.current.src = STREAM_LOGO_URL;
        }
    };

    // Função para configurar o SSE do Now Playing
    const setupNowPlaying = () => {
        if (typeof EventSource !== 'undefined') {
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

                    setCurrentSong(song);
                    setCurrentArtist(artist);

                    if (currentTitleElRef.current) {
                        currentTitleElRef.current.textContent = `${artist} - ${song}`;
                        currentTitleElRef.current.title = `${artist} - ${song}`;
                    }

                    const coverUrl = await fetchCoverArt(artist, song);

                    if (!coverUrl || isSpot || coverUrl === STREAM_LOGO_URL) {
                        toggleCoverDisplay(false);
                        if (coverImgRef.current) coverImgRef.current.alt = isSpot ? 'Commercial' : `${artist} - ${song}`;
                        addToHistory(song, artist, STREAM_LOGO_URL);
                    } else {
                        const isInvalid = await isInvalidCover(coverUrl);
                        if (isInvalid) {
                            toggleCoverDisplay(false);
                            if (coverImgRef.current) coverImgRef.current.alt = `${artist} - ${song}`;
                        } else {
                            toggleCoverDisplay(true, coverUrl);
                            if (coverImgRef.current) coverImgRef.current.alt = `${artist} - ${song}`;
                        }
                        addToHistory(song, artist, coverUrlRef.current ? coverUrlRef.current.src : STREAM_LOGO_URL);
                    }

                    updateFavoriteButton();

                    if (statusTextRef.current) {
                        if (isSpot) {
                            statusTextRef.current.textContent = '📢 Commercial Break';
                        } else {
                            statusTextRef.current.textContent = `LIVE • Now Playing: ${artist} - ${song}`;
                        }
                    }
                } catch (err) {
                    console.warn('Error parsing metadata', err);
                    if (currentTitleElRef.current) currentTitleElRef.current.textContent = 'Praise FM U.S. - Live';
                    toggleCoverDisplay(false);
                    if (coverImgRef.current) coverImgRef.current.alt = 'Praise FM U.S. - Live';
                    if (statusTextRef.current) statusTextRef.current.textContent = 'LIVE • Live';
                }
            };

            eventSource.onerror = () => {
                console.warn('EventSource failed, trying again in 15s...');
                if (statusTextRef.current) statusTextRef.current.textContent = 'Connection failed. Retrying...';
                setTimeout(setupNowPlaying, 15000);
            };

            // Cleanup
            return () => {
                eventSource.close();
            };
        } else {
            console.error("EventSource is not supported by this browser.");
            if (statusTextRef.current) statusTextRef.current.textContent = 'SSE not supported.';
        }
    };

    // Função para atualizar o tempo
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
        const timeFormatted = now.toLocaleTimeString('en-US', optionsTime);
        const dateFormatted = now.toLocaleDateString('en-US', optionsDate);

        if (currentTimeElRef.current) currentTimeElRef.current.textContent = timeFormatted;
        if (currentDateElRef.current) currentDateElRef.current.textContent = dateFormatted;
    };

    // Efeito para inicializar o player e os listeners
    useEffect(() => {
        if (typeof window === 'undefined') return; // Garante execução apenas no client-side

        const player = playerRef.current;
        const playBtn = playBtnRef.current;
        const volumeSlider = volumeSliderRef.current;
        const statusText = statusTextRef.current;
        const coverImg = coverImgRef.current;
        const favoriteBtn = favoriteBtnRef.current;
        const showImageEl = showImageElRef.current;

        if (!player || !playBtn || !volumeSlider) {
            console.error("Error: Essential player elements not found.");
            if (statusText) statusText.textContent = "Error loading player. Please refresh.";
            return;
        }

        // Inicializa o player
        player.crossOrigin = 'anonymous';
        player.src = STREAM_URL;
        player.volume = volume;

        // Garante que o logo U.S. é o primeiro a ser exibido
        if (coverImg) {
            coverImg.src = STREAM_LOGO_URL; // Correção: Define o logo inicial
            coverImg.alt = 'Praise FM U.S. Logo';
        }

        // Função para atualizar o botão Play/Pause
        const updatePlayButton = () => {
            if (playBtn) {
                playBtn.textContent = playing ? '⏸ Pause' : '▶ Play';
                playBtn.setAttribute('aria-label', playing ? 'Pause radio' : 'Play radio');
            }
        };

        // Tenta autoplay
        const playAttempt = player.play();
        if (playAttempt !== undefined) {
            playAttempt.then(() => {
                setPlaying(true);
                updatePlayButton();
                if (statusText) statusText.textContent = 'LIVE • Now Playing';
            }).catch(err => {
                console.warn('Autoplay blocked — user interaction required');
                setPlaying(false);
                updatePlayButton();
                if (statusText) statusText.textContent = 'Click Play to listen.';
            });
        }

        // Eventos dos botões e sliders
        const handlePlayClick = () => {
            if (playing) {
                player.pause();
                if (statusText) statusText.textContent = 'Paused';
            } else {
                player.play().then(() => {
                    if (statusText) statusText.textContent = 'LIVE • Now Playing';
                }).catch(err => {
                    if (statusText) statusText.textContent = 'Failed to play — try again.';
                    console.error('Play error:', err);
                });
            }
            setPlaying(!playing);
            updatePlayButton();
        };

        const handleVolumeChange = () => {
            const newVolume = parseFloat(volumeSlider.value);
            player.volume = newVolume;
            setVolume(newVolume);
            volumeSlider.setAttribute('aria-valuenow', newVolume);
            if (statusText) statusText.textContent = `Volume: ${Math.round(newVolume * 100)}%`;
        };

        const handleFavoriteClick = () => {
            if (!currentSong || !currentArtist) return;
            const key = `${currentArtist} - ${currentSong}`;
            toggleFavorite(key);
        };

        const handleFavoriteKeyDown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!currentSong || !currentArtist) return;
                const key = `${currentArtist} - ${currentSong}`;
                toggleFavorite(key);
            }
        };

        if (playBtn) playBtn.addEventListener('click', handlePlayClick);
        if (volumeSlider) volumeSlider.addEventListener('input', handleVolumeChange);
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', handleFavoriteClick);
            favoriteBtn.addEventListener('keydown', handleFavoriteKeyDown);
        }

        // Configura o SSE
        const cleanupSSE = setupNowPlaying();

        // Configura o relógio
        updateTime();
        const intervalId = setInterval(updateTime, 1000);

        // Cleanup ao desmontar o componente
        return () => {
            if (playBtn) playBtn.removeEventListener('click', handlePlayClick);
            if (volumeSlider) volumeSlider.removeEventListener('input', handleVolumeChange);
            if (favoriteBtn) {
                favoriteBtn.removeEventListener('click', handleFavoriteClick);
                favoriteBtn.removeEventListener('keydown', handleFavoriteKeyDown);
            }
            if (cleanupSSE) cleanupSSE();
            clearInterval(intervalId);
        };
    }, [playing, volume, currentSong, currentArtist, currentTrackKey]);

    // Efeito para renderizar o histórico sempre que ele mudar
    useEffect(() => {
        renderHistory();
    }, [history]);

    return (
        <div className="container">
            <div className="content-left">
                <div className="header">
                    <button className="favorite-btn" ref={favoriteBtnRef} title="Favorite this song" aria-label="Favorite this song">☆</button>
                </div>
                <div className="station-title">Praise FM U.S.</div>
                <div className="station-desc">Praise & Worship</div>
                <div className="show-image" ref={showImageElRef}>
                    <img ref={coverImgRef} id="coverImg" src={STREAM_LOGO_URL} alt="Current song album cover" /> {/* Correção: src inicial */}
                </div>
                <div className="show-info">
                    <div className="live-indicator">LIVE • <span ref={currentTimeElRef}>—</span></div>
                    <div className="show-title">
                        <span ref={currentTitleElRef}>Loading...</span>
                    </div>
                    <div className="show-date" ref={currentDateElRef}>—</div>
                </div>
            </div>
            <div className="content-right">
                <button className="play-button" ref={playBtnRef} aria-label="Play or pause radio">▶ Play</button>
                <div className="volume-control">
                    <label htmlFor="volumeSlider" className="sr-only">Adjust volume</label>
                    <i className="fas fa-volume-up" aria-hidden="true"></i>
                    <input
                        type="range"
                        className="volume-slider"
                        ref={volumeSliderRef}
                        id="volumeSlider"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        aria-valuemin="0"
                        aria-valuenow={volume}
                        role="slider"
                    />
                </div>
                <div className="history-section">
                    <div className="history-title">Recently Played</div>
                    <div className="history-list" ref={historyListRef}>
                        <div style={{ textAlign: 'center', color: '#666', padding: '16px' }}>No songs yet...</div>
                    </div>
                </div>
                <div className="status" ref={statusTextRef}>Connecting to stream... • Real-time updates</div>
            </div>
            <audio ref={playerRef} id="radioPlayer" preload="auto" aria-hidden="true"></audio>
        </div>
    );
}