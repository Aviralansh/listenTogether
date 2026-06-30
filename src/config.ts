export const config = {
  // Use environment variable if set, otherwise fallback to local proxy or Render URL
  API_BASE: import.meta.env.VITE_API_URL || (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname.startsWith('192.168.') 
      ? '/api' 
      : 'https://REPLACE_ME_WITH_RENDER_URL.onrender.com'
  ),
  
  // Public Lyrics API
  LYRICS_API: import.meta.env.VITE_LYRICS_API || 'https://lrclib.net/api/search',
  
  // YouTube Player Options
  YT_OPTS: {
    height: '10',
    width: '10',
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1
    }
  }
};
