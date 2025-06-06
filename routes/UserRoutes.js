const express = require('express');
const { 
  getProfile, 
  updateProfile, 
  getUserReviews,
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  getUserStats
} = require('../controllers/userController');
const { auth } = require('../middleware/authMiddleware');

const router = express.Router();

// User profile routes
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.get('/reviews', auth, getUserReviews);

// Admin routes (specific routes first to avoid conflicts)
router.get('/stats', auth, getUserStats);
router.get('/', auth, getAllUsers);
router.get('/:id', auth, getUserById);
router.put('/:id/role', auth, updateUserRole);
router.delete('/:id', auth, deleteUser);

module.exports = router;