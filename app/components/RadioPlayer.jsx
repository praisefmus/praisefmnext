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
    // Link correto para o logo da rádio no seu repositório
    const STREAM_LOGO_URL = 'https://raw.githubusercontent.com/praisefmus/praisefmnext/main/image/LOGOPNG%20PRAISEFMUS.webp';
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
                console.warn('Autoplay bloqueado — interação do usuário necessária');
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
                    max-width: 95vw;
                    max-height: 95vh;
                    padding: 32px;