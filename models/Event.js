const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'system_message',      // Admin meddelanden till alla
      'review_deleted',      // Recension borttagen
      'review_created',      // Ny recension (för admins)
      'user_registered',     // Ny användare (för admins)
      'movie_added',         // Ny film (för alla)
      'movie_deleted',       // Film borttagen (för alla)
      'maintenance',         // Underhållsmeddelande
      'announcement'         // Allmänt meddelande
    ]
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxLength: 500
  },
  severity: {
    type: String,
    required: true,
    enum: ['info', 'warning', 'error', 'success'],
    default: 'info'
  },
  // Vem som ska se händelsen
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  targetRole: {
    type: String,
    enum: ['user', 'moderator', 'admin', 'all']
  },
  // Relaterad data
  relatedEntity: {
    entityType: {
      type: String,
      enum: ['movie', 'user', 'review']
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId
    },
    entityTitle: String
  },
  // Status
  isRead: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Frontend routing
  actionUrl: {
    type: String // URL till sidan som händelsen relaterar till
  }
}, {
  timestamps: true
});

// Index för prestanda
eventSchema.index({ targetUser: 1, isActive: 1 });
eventSchema.index({ targetRole: 1, isActive: 1 });
eventSchema.index({ type: 1, isActive: 1 });
eventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Event', eventSchema);