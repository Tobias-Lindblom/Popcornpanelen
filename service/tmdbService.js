const axios = require('axios');
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const getPosterFromTMDb = async (title, year) => {
  try {
    const response = await axios.get('https://api.themoviedb.org/3/search/movie', {
      params: {
        api_key: TMDB_API_KEY,
        query: title,
        year
      }
    });

    const results = response.data.results;
    if (results && results.length > 0 && results[0].poster_path) {
      return `https://image.tmdb.org/t/p/w500${results[0].poster_path}`;
    }

    return ''; // Fallback om ingen poster hittas
  } catch (err) {
    console.error('TMDb fetch error:', err.message);
    return '';
  }
};

module.exports = { getPosterFromTMDb };