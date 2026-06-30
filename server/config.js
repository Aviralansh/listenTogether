require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  HOST: process.env.HOST || '0.0.0.0',
  GENIUS_API_URL: process.env.GENIUS_API_URL || 'https://genius.com/api/search/multi',
};
