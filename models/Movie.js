const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Titel är obligatorisk'],
    trim: true,
    maxlength: [200, 'Titel kan inte vara längre än 200 tecken']
  },
  director: {
    type: String,
    required: [true, 'Regissör är obligatorisk'],
    trim: true,
    maxlength: [100, 'Regissör kan inte vara längre än 100 tecken']
  },
  releaseYear: {
    type: Number,
    required: [true, 'Utgivningsår är obligatoriskt'],
    min: [1900, 'Utgivningsår kan inte vara tidigare än 1900'],
    max: [new Date().getFullYear(), 'Utgivningsår kan inte vara i framtiden']
  },
  genre: {
    type: String,
    required: [true, 'Genre är obligatorisk'],
    trim: true,
    enum: {
      values: ['Action', 'Äventyr', 'Komedi', 'Drama', 'Fantasy', 'Skräck', 'Thriller', 'Sci-Fi', 'Dokumentär', 'Animation', 'Romantik', 'Krig', 'Western', 'Musikal', 'Sport'],
      message: 'Ogiltig genre'
    }
  },
  posterUrl: {
    type: String,
    trim: true,
    default: null
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Beskrivning kan inte vara längre än 500 tecken'],
    default: null
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Index för bättre prestanda
movieSchema.index({ title: 1, releaseYear: 1 });
movieSchema.index({ genre: 1 });
movieSchema.index({ averageRating: -1 });

module.exports = mongoose.model('Movie', movieSchema);