const express = require('express');
const {
  getMyEvents,
  markEventAsRead,
  markAllEventsAsRead,
  createSystemMessage,
  getAllEvents,
  deleteEvent
} = require('../controllers/eventController');
const { auth } = require('../middleware/authMiddleware');

const router = express.Router();

// Användarspecifika routes
router.get('/my', auth, getMyEvents);
router.put('/:id/read', auth, markEventAsRead);
router.put('/read-all', auth, markAllEventsAsRead);

// Admin routes
router.post('/system-message', auth, createSystemMessage);
router.get('/admin/all', auth, getAllEvents);
router.delete('/:id', auth, deleteEvent);

module.exports = router;