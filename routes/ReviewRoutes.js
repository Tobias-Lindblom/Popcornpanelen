const express = require('express');
const {
  createReview,
  getAllReviews,
  getReviewById,
  updateReview,
  deleteReview,
  getUserReviews,
  getMovieReviews,
  getReviewStats
} = require('../controllers/reviewController');
const { auth } = require('../middleware/authMiddleware');

const router = express.Router();

// Basic review routes (alla inloggade användare)
router.post('/', auth, createReview);
router.get('/', auth, getAllReviews);
router.get('/:id', auth, getReviewById);
router.put('/:id', auth, updateReview);
router.delete('/:id', auth, deleteReview);

// Specific routes
router.get('/user/:userId', auth, getUserReviews);
router.get('/movie/:movieId', auth, getMovieReviews);

// Admin routes
router.get('/admin/stats', auth, getReviewStats);

module.exports = router;