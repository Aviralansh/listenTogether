import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import YouTube from 'react-youtube';
import type { YouTubeEvent, YouTubePlayer } from 'react-youtube';
import {
  Music, Home, Search, Library, Heart, Users, Play, Pause,
  SkipBack, SkipForward, Repeat, Shuffle, Volume2, Mic2, ListMusic, X, Copy, Check, Plus
} from 'lucide-react';
import { peerService } from './services/PeerService';
import { config } from './config';
import './App.css';

const developerFavs = [
  { id: 'mj1', title: 'Billie Jean', artist: 'Michael Jackson', albumArt: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/32/4f/fd/324ffda2-9e51-8f6a-0c2d-c6fd2b41ac55/074643811224.jpg/600x600bb.jpg', ytId: 'Zi_XLOBDo_Y', lyrics: "" },
  { id: 'mj2', title: 'Bad', artist: 'Michael Jackson', albumArt: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/f7/be/db/f7bedbe7-8ef8-36ae-f227-d407e1cf0ec6/MichaelJackson_BadRemastered_G010002832827D_F_001_RGB.jpeg/600x600bb.jpg', ytId: 'dsUXAEzaC3Q', lyrics: "" },
  { id: 'mj3', title: 'Heaven Can Wait', artist: 'Michael Jackson', albumArt: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/dc/02/ef/dc02eff2-027c-a468-7d7b-aa9404e74f1a/mzi.mgytcnob.jpg/600x600bb.jpg', ytId: '4XJmS9iNlIE', lyrics: "" }
];

const trendingMusic = [
  { id: 't1', title: 'Espresso', artist: 'Sabrina Carpenter', albumArt: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/57/e8/7b/57e87ba0-5057-9bb9-c247-ce7dbe426e89/24UMGIM55213.rgb.jpg/600x600bb.jpg', ytId: 'eVli-tstM5E', lyrics: "" },
  { id: 't2', title: 'Not Like Us', artist: 'Kendrick Lamar', albumArt: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/31/3a/3f/313a3fbc-bb8f-80c7-b5a2-e226869a38cd/24UMGIM51924.rgb.jpg/600x600bb.jpg', ytId: 'T6eK-2OQtew', lyrics: "" },
  { id: 't3', title: 'Starboy', artist: 'The Weeknd', albumArt: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b5/92/bb/b592bb72-52e3-e756-9b26-9f56d08f47ab/16UMGIM67864.rgb.jpg/600x600bb.jpg', ytId: '34Na4j8HLjc', lyrics: "" }
];

const ytOpts = config.YT_OPTS;

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [connectionState, setConnectionState] = useState<'disconnected' | 'hosting' | 'connected' | 'connecting'>('disconnected');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [joinId, setJoinId] = useState('');
  const [copied, setCopied] = useState(false);

  // Player State
  const [queue, setQueue] = useState<any[]>([]);
  const [currentSong, setCurrentSong] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // YouTube Search State
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // New features state
  const [likedSongMap, setLikedSongMap] = useState<Map<string, any>>(new Map());
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showLyrics, setShowLyrics] = useState(false);
  const [currentLyrics, setCurrentLyrics] = useState<string>('');
  const [syncedLyrics, setSyncedLyrics] = useState<{time: number, text: string}[]>([]);
  const lyricsScrollRef = useRef<HTMLDivElement>(null);
  
  const parseLrc = (lrc: string) => {
    const lines = lrc.split('\n');
    const parsed = [];
    for (const line of lines) {
       const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
       if (match) {
          const mins = parseInt(match[1]);
          const secs = parseInt(match[2]);
          const ms = parseInt(match[3].padEnd(3, '0'));
          const time = mins * 60 + secs + ms / 1000;
          const text = match[4].trim();
          if (text) parsed.push({ time, text });
       }
    }
    return parsed;
  };
  
  const [ytPlayer, setYtPlayer] = useState<YouTubePlayer | null>(null);

  const queueRef = useRef(queue);
  const currentSongRef = useRef(currentSong);
  const isPlayingRef = useRef(isPlaying);
  
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // YouTube API Search Integration
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${config.API_BASE}/search?q=${encodeURIComponent(searchQuery)}`);
        if (!res.ok) throw new Error("Backend not available");
        const data = await res.json();
        if (Array.isArray(data)) setSearchResults(data);
      } catch (err) {
        console.error("YT Search Error", err);
      } finally {
        setIsSearching(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // YouTube Player Control & Progress Tracker
  useEffect(() => {
    if (!ytPlayer) return;
    try {
       if (isPlaying) {
         ytPlayer.playVideo();
       } else {
         ytPlayer.pauseVideo();
       }
    } catch (err) {
       console.error("YT Error:", err);
    }
  }, [isPlaying, ytPlayer, currentSong?.ytId]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && ytPlayer) {
      interval = setInterval(async () => {
        try {
          const currentTime = await ytPlayer.getCurrentTime();
          setProgress(currentTime || 0);
          const totalTime = await ytPlayer.getDuration();
          if (totalTime) setDuration(totalTime);
        } catch (e) {}
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, ytPlayer]);

  // Fetch Live Lyrics from LRCLib
  useEffect(() => {
    if (!currentSong) {
      setCurrentLyrics('');
      setSyncedLyrics([]);
      return;
    }
    
    setCurrentLyrics('Loading synced lyrics...');
    setSyncedLyrics([]);
    
    const cleanTitle = currentSong.title.replace(/\[.*?\]|\(.*?\)|official|video|music|audio|lyric|lyrics/gi, '').trim();
    // Prefer searching only by title first as it's cleaner
    fetch(`${config.LYRICS_API}?q=${encodeURIComponent(cleanTitle)}`)
      .then(async res => {
          if (!res.ok) throw new Error("Lyrics API Error");
          return res.json();
      })
      .then(data => {
         if (data && data.length > 0) {
            const track = data[0];
            if (track.syncedLyrics) {
               setSyncedLyrics(parseLrc(track.syncedLyrics));
               setCurrentLyrics('');
            } else if (track.plainLyrics) {
               setCurrentLyrics(track.plainLyrics);
            } else {
               setCurrentLyrics("Lyrics not available.");
            }
         } else {
            setCurrentLyrics("Lyrics not found for this track.");
         }
      })
      .catch((err) => {
         console.error("Lyrics fetch failed:", err);
         setCurrentLyrics("Lyrics service temporarily down (lrclib.net is offline).");
      });
  }, [currentSong]);

  // Auto-scroll synced lyrics
  useEffect(() => {
     if (showLyrics && syncedLyrics.length > 0 && lyricsScrollRef.current) {
        let activeIndex = -1;
        for (let i = 0; i < syncedLyrics.length; i++) {
           if (progress >= syncedLyrics[i].time) {
              activeIndex = i;
           } else {
              break;
           }
        }
        if (activeIndex !== -1) {
           const container = lyricsScrollRef.current;
           const activeElement = container.children[0].children[activeIndex] as HTMLElement;
           if (activeElement) {
              const scrollPos = activeElement.offsetTop - container.clientHeight / 2 + activeElement.clientHeight / 2;
              container.scrollTo({ top: scrollPos, behavior: 'smooth' });
           }
        }
     }
  }, [progress, showLyrics, syncedLyrics]);

  // Peer Connection Setup
  useEffect(() => {
    peerService.onStateChange((state) => {
      setConnectionState(state);
      if (state === 'connected') {
        setShowConnectModal(false);
        if (peerService.isHost) {
          peerService.sendMessage({
            type: 'SYNC_STATE',
            payload: { queue: queueRef.current, currentSong: currentSongRef.current, isPlaying: isPlayingRef.current }
          });
        }
      }
    });
    
    peerService.onMessage((msg) => {
      if (msg.type === 'SYNC_STATE') {
        setQueue(msg.payload.queue);
        setCurrentSong(msg.payload.currentSong);
        setIsPlaying(msg.payload.isPlaying);
      } else if (msg.type === 'ADD_TO_QUEUE') {
        setQueue(prev => [...prev, msg.payload]);
      } else if (msg.type === 'PLAY') {
        setCurrentSong(msg.payload.song);
        setIsPlaying(true);
      } else if (msg.type === 'PAUSE') {
        setIsPlaying(false);
      } else if (msg.type === 'RESUME') {
        setIsPlaying(true);
      } else if (msg.type === 'NEXT') {
        playNext(queueRef.current, false);
      } else if (msg.type === 'SEEK') {
        if (ytPlayer) {
           try { ytPlayer.seekTo(msg.payload.time, true); } catch(e) {}
        }
        setProgress(msg.payload.time);
      }
    });
  }, [ytPlayer]);

  const handleHost = () => peerService.initHost((id) => setMyId(id));
  const handleJoin = () => { if (joinId) peerService.joinSession(joinId); };

  const copyToClipboard = () => {
    if (myId) {
      navigator.clipboard.writeText(myId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddToQueue = (song: any) => {
    if (queue.some(q => q.ytId === song.ytId) || (currentSongRef.current && currentSongRef.current.ytId === song.ytId)) {
      return;
    }
    setQueue(prev => [...prev, song]);
    if (connectionState === 'connected') {
      peerService.sendMessage({ type: 'ADD_TO_QUEUE', payload: song });
    }
    if (!currentSongRef.current) {
      handlePlay(song);
    }
  };

  const handleRemoveFromQueue = (index: number) => {
    const newQueue = [...queueRef.current];
    newQueue.splice(index, 1);
    setQueue(newQueue);
    if (connectionState === 'connected' && peerService.isHost) {
      peerService.sendMessage({ type: 'SYNC_STATE', payload: { queue: newQueue, currentSong: currentSongRef.current, isPlaying: isPlayingRef.current } });
    }
  };

  const handlePlay = (song: any) => {
    setCurrentSong(song);
    setIsPlaying(true);
    setProgress(0);
    if (connectionState === 'connected') {
      peerService.sendMessage({ type: 'PLAY', payload: { song } });
    }
    
    if (ytPlayer) {
       try { ytPlayer.playVideo(); } catch(e){}
    }
  };

  const togglePlayPause = () => {
    if (!currentSong) return;
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    if (connectionState === 'connected') {
      peerService.sendMessage({ type: nextState ? 'RESUME' : 'PAUSE' });
    }
  };
  
  const playNext = (currentQueue = queue, broadcast = true) => {
    setProgress(0);
    if (currentQueue.length > 0) {
       const nextSong = currentQueue[0];
       const newQueue = currentQueue.slice(1);
       setQueue(newQueue);
       setCurrentSong(nextSong);
       setIsPlaying(true);
       
       if (broadcast && peerService.isHost && connectionState === 'connected') {
          peerService.sendMessage({ type: 'SYNC_STATE', payload: { queue: newQueue, currentSong: nextSong, isPlaying: true } });
       }
    } else {
       setCurrentSong(null);
       setIsPlaying(false);
       if (broadcast && peerService.isHost && connectionState === 'connected') {
          peerService.sendMessage({ type: 'SYNC_STATE', payload: { queue: [], currentSong: null, isPlaying: false } });
       }
    }
  };

  const toggleLike = (song: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLikedSongMap(prev => {
      const next = new Map(prev);
      if (next.has(song.id)) next.delete(song.id);
      else next.set(song.id, song);
      return next;
    });
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentSong || !ytPlayer || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const seekTime = percent * duration;
    
    setProgress(seekTime);
    try { ytPlayer.seekTo(seekTime, true); } catch(err) {}
    
    if (connectionState === 'connected') {
      peerService.sendMessage({ type: 'SEEK', payload: { time: seekTime } });
    }
  };

  const onPlayerReady = (event: YouTubeEvent) => {
    setYtPlayer(event.target);
    if (isPlayingRef.current) {
       try { event.target.playVideo(); } catch(e) {}
    }
  };

  const onPlayerStateChange = async (event: YouTubeEvent) => {
    if (event.data === 0) {
      playNext(queueRef.current, true);
    } else if (event.data === 1) { // Playing
      try {
         const dur = await event.target.getDuration();
         if (dur) setDuration(dur);
      } catch(e) {}
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const likedSongsList = Array.from(likedSongMap.values());

  return (
    <div className="app-container">
      {/* Ambient Dynamic Background */}
      <div className="ambient-background">
         <img src={currentSong ? currentSong.albumArt : 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=1000&auto=format&fit=crop'} alt="" className="ambient-art" />
         <div className="ambient-overlay"></div>
      </div>

      {/* Hidden YouTube Player */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0 }}>
        {currentSong && currentSong.ytId && (
          <YouTube 
            videoId={currentSong.ytId} 
            opts={ytOpts} 
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
          />
        )}
      </div>

      {/* Connect Modal */}
      <AnimatePresence>
        {showConnectModal && (
          <div className="modal-overlay">
            <motion.div 
              className="modal-content glass-panel"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="modal-header">
                <h2>Connect with Partner</h2>
                <button title="Close" onClick={() => setShowConnectModal(false)}><X size={24} /></button>
              </div>
              
              <div className="modal-body">
                {connectionState === 'disconnected' && (
                  <div className="connection-options">
                    <div className="connect-card">
                      <h3>Host a Session</h3>
                      <p>Start a session and invite your partner to join your queue.</p>
                      <button className="primary-btn" onClick={handleHost}>Start Hosting</button>
                    </div>
                    
                    <div className="divider">OR</div>
                    
                    <div className="connect-card">
                      <h3>Join a Session</h3>
                      <p>Enter your partner's connection ID to join their session.</p>
                      <input 
                        type="text" 
                        placeholder="Paste connection ID here" 
                        value={joinId}
                        onChange={(e) => setJoinId(e.target.value)}
                        className="modal-input"
                      />
                      <button className="secondary-btn" onClick={handleJoin} disabled={!joinId}>Join Session</button>
                    </div>
                  </div>
                )}

                {connectionState === 'hosting' && (
                  <div className="hosting-view">
                    <h3>Waiting for partner...</h3>
                    <p>Share this connection ID with your partner:</p>
                    <div className="id-display" onClick={copyToClipboard} title="Click to copy">
                      <span>{myId}</span>
                      {copied ? <Check size={18} color="#1DB954" /> : <Copy size={18} />}
                    </div>
                  </div>
                )}
                
                {connectionState === 'connecting' && (
                  <div className="connecting-view">
                    <div className="spinner"></div>
                    <h3>Connecting to partner...</h3>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <nav className="sidebar glass-panel">
        <div className="logo">
          <Music size={32} color="#ff416c" />
          <span>SyncPlay</span>
        </div>
        
        <div className="nav-links">
          <button 
            title="Go to Home"
            className={`nav-link ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => { setActiveTab('home'); setSearchQuery(''); }}
          >
            <Home size={20} />
            <span>Home</span>
          </button>
          <button 
            title="Search for music"
            className={`nav-link ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <Search size={20} />
            <span>Search</span>
          </button>
          <button 
            title="View Your Library"
            className={`nav-link ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
          >
            <Library size={20} />
            <span>Your Library</span>
          </button>
          <button 
            title="View Liked Songs"
            className={`nav-link ${activeTab === 'liked' ? 'active' : ''}`}
            onClick={() => setActiveTab('liked')}
          >
            <Heart size={20} />
            <span>Liked Songs</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Header */}
        <header className="header glass-panel">
          <div className="search-bar">
            <Search size={18} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="Search YouTube Music..." 
              value={searchQuery}
              onChange={(e) => {
                 setSearchQuery(e.target.value);
                 if (e.target.value) setActiveTab('search');
              }}
            />
          </div>

          <div className="user-actions">
            {connectionState === 'connected' ? (
               <button title="Disconnect from partner" className="connect-btn connected" onClick={() => peerService.disconnect()}>
                 <Users size={18} /> <span>Disconnect Partner</span>
               </button>
            ) : (
               <button title="Connect with partner" className="connect-btn" onClick={() => setShowConnectModal(true)}>
                 <Users size={18} /> <span>Connect Partner</span>
               </button>
            )}
          </div>
        </header>

        {/* Content View */}
        <div className="content-area glass-panel">
          {activeTab === 'search' && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {searchQuery ? (
                   <>
                      <h2 style={{ marginBottom: '20px' }}>Top Results for "{searchQuery}"</h2>
                      {isSearching ? (
                         <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Searching YouTube...</div>
                      ) : (
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {searchResults.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No songs found on YouTube.</div>}
                            {searchResults.map(song => (
                               <div key={song.id} className="search-result-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--glass-bg)', padding: '12px 16px', borderRadius: '12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                     <img src={song.albumArt} alt="Album Art" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
                                     <div>
                                        <div className="song-title" style={{ fontWeight: '600', maxWidth: '200px' }}>{song.title}</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{song.artist}</div>
                                     </div>
                                  </div>
                                  <div className="search-result-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                      <button title="Like this song" onClick={(e) => toggleLike(song, e)} style={{ padding: '8px' }}>
                                         <Heart size={20} fill={likedSongMap.has(song.id) ? '#ff416c' : 'none'} color={likedSongMap.has(song.id) ? '#ff416c' : 'var(--text-muted)'} />
                                      </button>
                                      <button title="Play Song" onClick={() => handlePlay(song)} style={{ background: 'var(--text-main)', color: 'var(--bg-dark)', padding: '8px 16px', borderRadius: '100px', fontWeight: 'bold' }}>Play</button>
                                      <button title={queue.some(q => q.ytId === song.ytId) || currentSong?.ytId === song.ytId ? "In Queue" : "Add to Queue"} onClick={() => handleAddToQueue(song)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--glass-hover)', border: '1px solid var(--glass-border)', padding: '8px 16px', borderRadius: '100px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                                        {queue.some(q => q.ytId === song.ytId) || currentSong?.ytId === song.ytId ? <Check size={16} color="#1DB954" /> : <Plus size={16}/>} {queue.some(q => q.ytId === song.ytId) || currentSong?.ytId === song.ytId ? 'In Queue' : 'Queue'}
                                      </button>
                                   </div>
                                </div>
                            ))}
                         </div>
                      )}
                   </>
                ) : (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
                      <div>
                         <h2 style={{ marginBottom: '20px', fontSize: '24px', letterSpacing: '-0.5px' }}>Developer Favs</h2>
                         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
                            {developerFavs.map(song => (
                               <div key={song.id} style={{ background: 'var(--glass-bg)', padding: '16px', borderRadius: '16px', border: '1px solid var(--glass-border)', transition: 'transform 0.2s', cursor: 'pointer' }} onClick={() => handlePlay(song)}>
                                  <img src={song.albumArt} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '12px', marginBottom: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }} />
                                  <div className="song-title">{song.title}</div>
                                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{song.artist}</div>
                               </div>
                            ))}
                         </div>
                      </div>
                      
                      <div>
                         <h2 style={{ marginBottom: '20px', fontSize: '24px', letterSpacing: '-0.5px' }}>Trending on YT Music</h2>
                         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
                            {trendingMusic.map(song => (
                               <div key={song.id} style={{ background: 'var(--glass-bg)', padding: '16px', borderRadius: '16px', border: '1px solid var(--glass-border)', transition: 'transform 0.2s', cursor: 'pointer' }} onClick={() => handlePlay(song)}>
                                  <img src={song.albumArt} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '12px', marginBottom: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }} />
                                  <div className="song-title">{song.title}</div>
                                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{song.artist}</div>
                               </div>
                            ))}
                         </div>
                      </div>
                   </div>
                )}
             </motion.div>
          )}

          {activeTab === 'home' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 style={{ fontSize: '32px', marginBottom: '24px' }}>Good Evening</h1>
            
            <h2 style={{ marginTop: '20px', marginBottom: '20px' }}>Shared Queue {connectionState === 'connected' && '(Synced)'}</h2>
            {queue.length === 0 ? (
                <div style={{ background: 'var(--glass-bg)', borderRadius: '12px', padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                   Queue is empty. Search and add some songs!
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {queue.map((song, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--glass-bg)', padding: '12px 16px', borderRadius: '12px' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '24px', color: 'var(--text-muted)' }}>{i + 1}</div>
                            <img src={song.albumArt} alt="Album Art" style={{ width: '40px', height: '40px', borderRadius: '6px' }} />
                            <div>
                               <div style={{ fontWeight: '500' }}>{song.title}</div>
                               <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{song.artist}</div>
                            </div>
                         </div>
                         <button 
                            title="Remove from Queue" 
                            onClick={() => handleRemoveFromQueue(i)} 
                            style={{ padding: '8px', color: 'var(--text-muted)', background: 'transparent' }}
                         >
                            <X size={20} />
                         </button>
                      </div>
                   ))}
                </div>
            )}
          </motion.div>
          )}

          {activeTab === 'liked' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h1 style={{ fontSize: '32px', marginBottom: '24px' }}>Liked Songs</h1>
            {likedSongsList.length === 0 ? (
                <div style={{ background: 'var(--glass-bg)', borderRadius: '12px', padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                   You haven't liked any songs yet.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   {likedSongsList.map((song, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--glass-bg)', padding: '12px 16px', borderRadius: '12px' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                           <img src={song.albumArt} alt="Album Art" style={{ width: '40px', height: '40px', borderRadius: '6px' }} />
                           <div>
                              <div style={{ fontWeight: '500' }}>{song.title}</div>
                              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{song.artist}</div>
                           </div>
                         </div>
                         <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                           <button 
                              title="Unlike this song" 
                              onClick={(e) => toggleLike(song, e)} 
                              style={{ padding: '8px' }}
                           >
                              <Heart size={20} fill='#ff416c' color='#ff416c' />
                           </button>
                           <button title="Play Song" onClick={() => handlePlay(song)} style={{ background: 'var(--text-main)', color: 'var(--bg-dark)', padding: '8px 16px', borderRadius: '100px', fontWeight: 'bold' }}>Play</button>
                        </div>
                      </div>
                   ))}
                </div>
            )}
          </motion.div>
          )}

          {activeTab === 'library' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h1 style={{ fontSize: '32px', marginBottom: '24px' }}>Your Library</h1>
            {likedSongsList.length === 0 ? (
                <div style={{ background: 'var(--glass-bg)', borderRadius: '12px', padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Library size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                    <h3>Library is Empty</h3>
                    <p>Songs you like from YouTube search will appear here.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '24px' }}>
                    {likedSongsList.map((song, i) => (
                       <div key={i} style={{ position: 'relative', background: 'var(--glass-bg)', borderRadius: '12px', padding: '16px', transition: 'transform 0.2s' }}>
                          <img src={song.albumArt} style={{ width: '100%', aspectRatio: '1', borderRadius: '8px', marginBottom: '12px', objectFit: 'cover' }} />
                          <div style={{ fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{song.artist}</div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                             <button onClick={() => handlePlay(song)} style={{ flex: 1, background: 'var(--text-main)', color: 'var(--bg-dark)', padding: '6px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>Play</button>
                             <button onClick={() => handleAddToQueue(song)} style={{ flex: 1, background: 'var(--glass-hover)', padding: '6px', borderRadius: '6px', fontSize: '12px' }}>{queue.some(q => q.ytId === song.ytId) || currentSong?.ytId === song.ytId ? 'In Queue' : 'Queue'}</button>
                          </div>
                       </div>
                    ))}
                </div>
            )}
          </motion.div>
          )}
          
        </div>
      </main>

          {/* Lyrics Panel Overlay */}
          <AnimatePresence>
             {showLyrics && currentSong && (
                <motion.div 
                   className="lyrics-overlay"
                   initial={{ y: '100%' }}
                   animate={{ y: 0 }}
                   exit={{ y: '100%' }}
                   transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                   style={{
                      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                      background: 'rgba(15, 17, 26, 0.98)',
                      backdropFilter: 'blur(40px)',
                      zIndex: 9999,
                      padding: '60px 40px',
                      display: 'flex',
                      flexDirection: 'column'
                   }}
                >
                   <button title="Close Lyrics" onClick={() => setShowLyrics(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--glass-bg)', padding: '12px', borderRadius: '50%', zIndex: 60 }}>
                      <X size={24} />
                   </button>
                   <div className="lyrics-layout" style={{ display: 'flex', gap: '60px', height: '100%', alignItems: 'center', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
                      <div className="lyrics-art-section" style={{ flex: '0 0 400px' }}>
                         <img src={currentSong.albumArt} style={{ width: '100%', height: 'auto', aspectRatio: '1', objectFit: 'cover', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', marginBottom: '24px' }} />
                         <div>
                            <h2 style={{ fontSize: '32px', margin: '0 0 8px 0' }}>{currentSong.title}</h2>
                            <p style={{ fontSize: '20px', color: 'var(--text-muted)', margin: '0' }}>{currentSong.artist}</p>
                         </div>
                      </div>
                      
                      <div ref={lyricsScrollRef} className="lyrics-scroll-section" style={{ flex: 1, height: '100%', overflowY: 'auto', scrollBehavior: 'smooth', paddingRight: '20px', maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)' }}>
                         {syncedLyrics.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '40vh 0' }}>
                               {syncedLyrics.map((line, i) => {
                                  const isActive = progress >= line.time && (i === syncedLyrics.length - 1 || progress < syncedLyrics[i + 1].time);
                                  return (
                                     <div key={i} onClick={() => { setProgress(line.time); if(ytPlayer) ytPlayer.seekTo(line.time, true); }} style={{ cursor: 'pointer', fontSize: isActive ? 'clamp(28px, 6vw, 48px)' : 'clamp(20px, 4vw, 32px)', lineHeight: '1.4', fontWeight: 800, transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', color: isActive ? '#ffffff' : 'rgba(255,255,255,0.2)', textShadow: isActive ? '0 0 40px rgba(255,255,255,0.3)' : 'none', filter: isActive ? 'blur(0)' : 'blur(1px)', transform: isActive ? 'scale(1.02)' : 'scale(1)', transformOrigin: 'left center' }}>
                                        {line.text}
                                     </div>
                                  );
                               })}
                            </div>
                         ) : (
                            <div style={{ fontSize: '28px', lineHeight: '1.6', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'pre-line', padding: '40vh 0' }}>
                               {currentLyrics}
                            </div>
                         )}
                      </div>
                   </div>
                </motion.div>
              )}
           </AnimatePresence>

        {/* Player Bar */}
        <div className="player-bar glass-panel">
          <div className="now-playing">
            {currentSong ? (
               <img src={currentSong.albumArt} alt="art" className="album-art" />
            ) : (
               <div className="album-art" />
            )}
            <div className="song-info">
              <span className="song-title">{currentSong ? currentSong.title : 'No song playing'}</span>
              <span className="song-artist">{currentSong ? currentSong.artist : 'Unknown'}</span>
            </div>
            {currentSong && (
               <button 
                  title={likedSongMap.has(currentSong.id) ? "Unlike" : "Like"} 
                  className="control-btn" 
                  style={{ marginLeft: '12px' }}
                  onClick={() => toggleLike(currentSong)}
               >
                  <Heart size={18} fill={likedSongMap.has(currentSong.id) ? '#ff416c' : 'none'} color={likedSongMap.has(currentSong.id) ? '#ff416c' : 'var(--text-muted)'} />
               </button>
            )}
          </div>

          <div className="player-controls">
            <div className="control-buttons">
              <button title="Shuffle (Premium)" className="control-btn"><Shuffle size={18} /></button>
              <button title="Previous" className="control-btn"><SkipBack size={24} /></button>
              <button title={isPlaying ? "Pause" : "Play"} className="play-btn" onClick={togglePlayPause}>
                 {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
              </button>
              <button title="Next in Queue" className="control-btn" onClick={() => playNext(queue)}><SkipForward size={24} /></button>
              <button title="Repeat" className="control-btn"><Repeat size={18} /></button>
            </div>
            <div className="progress-container">
              <span>{formatTime(progress)}</span>
              <div 
                 className="progress-bar" 
                 onClick={handleSeek} 
                 style={{ cursor: 'pointer', height: '6px', position: 'relative' }}
                 title="Click to seek"
              >
                <div className="progress" style={{ width: `${duration ? (progress / duration) * 100 : 0}%`, transition: 'width 1s linear' }} />
              </div>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="extra-controls">
            <button 
               title="Lyrics" 
               className="control-btn" 
               onClick={() => setShowLyrics(!showLyrics)}
               style={{ color: showLyrics ? 'var(--primary)' : 'var(--text-muted)' }}
            >
               <Mic2 size={18} />
            </button>
            <button title="Queue" className="control-btn" onClick={() => setActiveTab('home')}><ListMusic size={18} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
              <button title="Volume"><Volume2 size={18} className="control-btn" /></button>
              <div style={{ width: '80px', height: '4px', background: 'var(--glass-bg)', borderRadius: '2px', cursor: 'pointer' }} title="Adjust Volume">
                <div style={{ width: '60%', height: '100%', background: 'var(--text-main)', borderRadius: '2px' }} />
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}

export default App;
