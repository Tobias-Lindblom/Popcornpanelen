const express = require('express');
const {
  createMovie,
  getAllMovies,
  getMovieById,
  updateMovie,
  deleteMovie,
  getMovieReviews,
  getMoviesWithRatings
} = require('../controllers/movieController');
const { auth } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (alla kan läsa)
router.get('/', getAllMovies);
router.get('/with-ratings', getMoviesWithRatings);
router.get('/:id', getMovieById);
router.get('/:id/reviews', auth, getMovieReviews);

// Admin-only routes (skapa, uppdatera, ta bort filmer)
router.post('/', auth, createMovie);
router.put('/:id', auth, updateMovie);
router.delete('/:id', auth, deleteMovie);

module.exports = router;