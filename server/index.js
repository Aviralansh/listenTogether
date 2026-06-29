const express = require('express');
const cors = require('cors');
const yts = require('yt-search');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());

app.get('/search', async (req, res) => {
  try {
    const r = await yts(req.query.q);
    const videos = r.videos.slice(0, 15).map(v => ({
      id: v.videoId,
      title: v.title,
      artist: v.author.name,
      duration: v.timestamp,
      albumArt: v.thumbnail,
      ytId: v.videoId
    }));
    res.json(videos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/lyrics', async (req, res) => {
  try {
    const artist = req.query.artist || "";
    const title = req.query.title || "";
    
    let query = (artist + " " + title).replace(/vevo/i, '').trim();
    if (!query) {
        return res.json({ lyrics: "Not Found" });
    }

    // Step 1: Search Genius public API
    const searchGenius = async (q) => {
        try {
            const res = await axios.get(`https://genius.com/api/search/multi?per_page=1&q=${encodeURIComponent(q)}`);
            return res.data?.response?.sections?.[0]?.hits?.[0]?.result?.url;
        } catch(e) { return null; }
    };
    
    let songUrl = await searchGenius(title); // Try just the title first (usually contains artist - song)
    if (!songUrl && artist) {
        songUrl = await searchGenius(query); // Fallback to channel + title
    }
    
    if (!songUrl) {
        return res.json({ lyrics: "Not Found" });
    }
    
    // Step 2: Scrape the lyrics page
    const { data } = await axios.get(songUrl);
    const $ = cheerio.load(data);
    
    let lyrics = $('[data-lyrics-container="true"]').map((i, el) => {
        $(el).find('br').replaceWith('\n');
        return $(el).text();
    }).get().join('\n');
    
    if (!lyrics) {
        lyrics = $('.lyrics').text().trim(); // fallback for older format
    }
    
    if (!lyrics) {
        return res.json({ lyrics: "Not Found" });
    }

    res.json({ lyrics });
  } catch (err) {
    console.error(err);
    res.json({ lyrics: "Error fetching lyrics." });
  }
});

app.listen(3001, () => console.log('YouTube Search proxy running on port 3001'));
