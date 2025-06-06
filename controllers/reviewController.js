const Review = require('../models/Review');
const Movie = require('../models/Movie');
const User = require('../models/User');
const { createEvent } = require('./eventController');


// Skapar en ny recension för en film
const createReview = async (req, res) => {
  try {
    // Hämta input-data
    const { movieId, rating, comment } = req.body;

    // Validera obligatoriska fält
    if (!movieId || !rating || !comment) {
      return res.status(400).json({ 
        message: 'MovieId, rating and comment are required' 
      });
    }

    // Validera betyg
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        message: 'Rating must be between 1 and 5' 
      });
    }

    // Kontrollera att filmen finns
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    // Kontrollera att användaren inte redan har recenserat filmen
    const existingReview = await Review.findOne({
      movieId,
      userId: req.user._id
    });

    if (existingReview) {
      return res.status(400).json({ 
        message: 'You have already reviewed this movie' 
      });
    }

    // Skapa ny recension
    const review = new Review({
      movieId,
      userId: req.user._id,
      rating: parseInt(rating),
      comment: comment.trim()
    });

    await review.save();
    
    // Populera med användar- och filmdata
    await review.populate('userId', 'username email role');
    await review.populate('movieId', 'title director releaseYear genre');

    // Uppdatera filmens genomsnittliga betyg
    try {
      const { updateMovieRating } = require('./movieController');
      await updateMovieRating(movieId);
      
    } catch (ratingError) {
      console.warn('⚠️ Failed to update movie rating:', ratingError.message);
    }

    // Skapa händelse för admins
    try {
      await createEvent(
        'review_created',
        'Ny recension',
        `${req.user.username} har skrivit en recension för "${review.movieId.title}"`,
        {
          severity: 'info',
          targetRole: 'admin',
          relatedEntity: {
            entityType: 'review',
            entityId: review._id,
            entityTitle: review.movieId.title
          },
          actionUrl: `/movie/${review.movieId._id}`,
          createdBy: req.user._id
        }
      );
    } catch (eventError) {
      console.warn('⚠️ Failed to create event:', eventError.message);
    }

    res.status(201).json(review);

  } catch (error) {
    console.error('❌ Error creating review:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Hämtar alla recensioner i systemet
const getAllReviews = async (req, res) => {
  try {
    // Hämta paginering-parametrar
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    // Hämta recensioner med paginering
    const reviews = await Review.find()
      .populate('userId', 'username email role')
      .populate('movieId', 'title director releaseYear genre')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    res.json(reviews);

  } catch (error) {
    console.error('❌ Error in getAllReviews:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


//Hämtar en specifik recension baserat på ID
const getReviewById = async (req, res) => {
  try {
    // Hitta recension med specifikt ID
    const review = await Review.findById(req.params.id)
      .populate('userId', 'username email role')
      .populate('movieId', 'title director releaseYear genre');

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json(review);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Uppdaterar en befintlig recension
const updateReview = async (req, res) => {
  try {
    // Hämta parametrar
    const { id } = req.params;
    const { rating, comment } = req.body;

    // Validera input
    if (!rating || !comment) {
      return res.status(400).json({
        message: 'Betyg och kommentar är obligatoriska'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        message: 'Betyg måste vara mellan 1 och 5' 
      });
    }

    if (!comment.trim()) {
      return res.status(400).json({
        message: 'Kommentar kan inte vara tom'
      });
    }

    // Hitta recensionen
    const review = await Review.findById(id);
    
    if (!review) {
      return res.status(404).json({ message: 'Recension hittades inte' });
    }

    // Användare kan bara redigera sina egna recensioner
    const userId = req.user._id || req.user.id;
    if (req.user.role === 'user' && review.userId.toString() !== userId.toString()) {
      return res.status(403).json({ 
        message: 'Du kan bara redigera dina egna recensioner' 
      });
    }

    // Uppdatera recensionen
    const updatedReview = await Review.findByIdAndUpdate(
      id,
      {
        rating: parseInt(rating),
        comment: comment.trim(),
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    )
    .populate('userId', 'username email role')
    .populate('movieId', 'title director releaseYear genre posterUrl');

    if (!updatedReview) {
    }

    // Uppdatera filmens betyg
    try {
      const { updateMovieRating } = require('./movieController');
      await updateMovieRating(updatedReview.movieId._id);
    } catch (ratingError) {
      console.warn('⚠️ Failed to update movie rating:', ratingError.message);
    }

    res.json(updatedReview);

  } catch (error) {
    console.error('❌ Error updating review:', error);
    
    // Hantera olika typer av fel
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Valideringsfel',
        errors: validationErrors
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Ogiltigt recensions-ID'
      });
    }

    res.status(500).json({
      message: 'Serverfel vid uppdatering av recension',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internt serverfel'
    });
  }
};


//Tar bort en recension
const deleteReview = async (req, res) => {
  try {

    // Hitta recensionen med populerad data
    const review = await Review.findById(req.params.id)
      .populate('movieId', 'title')
      .populate('userId', 'username');
    
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // - Användare kan ta bort sina egna recensioner
    // - Admin kan ta bort alla recensioner
    const canDelete = 
      review.userId._id.toString() === req.user._id.toString() ||
      req.user.role === 'admin';

    if (!canDelete) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Spara information för händelse och betygsuppdatering
    const movieId = review.movieId._id;
    const movieTitle = review.movieId?.title || 'Okänd film';
    const isOwnReview = review.userId._id.toString() === req.user._id.toString();

    // Skapa händelse om admin tar bort annans recension
    if (!isOwnReview) {
      try {
        await createEvent(
          'review_deleted',
          'Din recension har tagits bort',
          `Din recension för "${movieTitle}" har tagits bort av admin.`,
          {
            severity: 'warning',
            targetUser: review.userId._id,
            relatedEntity: {
              entityType: 'movie',
              entityId: movieId,
              entityTitle: movieTitle
            },
            actionUrl: `/movie/${movieId}`,
            createdBy: req.user._id
          }
        );
      } catch (eventError) {
        console.warn('⚠️ Failed to create deletion event:', eventError.message);
      }
    }

    // Ta bort recensionen
    await Review.findByIdAndDelete(req.params.id);

    // Uppdatera filmens betyg efter borttagning
    try {
      const { updateMovieRating } = require('./movieController');
      await updateMovieRating(movieId);
    } catch (ratingError) {
      console.warn('⚠️ Failed to update movie rating after deletion:', ratingError.message);
    }

    res.json({ message: 'Review deleted successfully' });

  } catch (error) {
    console.error('❌ Error deleting review:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Hämtar alla recensioner för en specifik användare
const getUserReviews = async (req, res) => {
  try {
    // Bestäm vilken användare som efterfrågas
    const userId = req.params.userId || req.user._id;
    
    // Användare kan bara se sina egna recensioner, admin kan se allas
    if (req.user.role === 'user' && req.user._id.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Hämta recensioner för användaren
    const reviews = await Review.find({ userId })
      .populate('movieId', 'title director releaseYear genre')
      .populate('userId', 'username email role')
      .sort({ createdAt: -1 });

    res.json(reviews);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Hämtar alla recensioner för en specifik film
const getMovieReviews = async (req, res) => {
  try {
    // Hämta och validera movieId
    const movieId = req.params.movieId;
    
    if (!movieId || !movieId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid movie ID format' });
    }

    // Hämta alla recensioner för filmen
    const reviews = await Review.find({ movieId })
      .populate('userId', 'username email role')
      .populate('movieId', 'title director releaseYear genre')
      .sort({ createdAt: -1 });

    res.json(reviews);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Genererar statistik över recensioner (endast admins)
const getReviewStats = async (req, res) => {
  try {
    // Behörighetskontroll
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Admin role required.' 
      });
    }

    // Räkna totalt antal recensioner
    const totalReviews = await Review.countDocuments();

    // Beräkna genomsnittligt betyg
    const avgRatingResult = await Review.aggregate([
      { $group: { _id: null, averageRating: { $avg: '$rating' } } }
    ]);

    const averageRating = avgRatingResult.length > 0 ? avgRatingResult[0].averageRating : 0;

    // Beräkna recensioner per månad (senaste året)
    const reviewsPerMonth = await Review.aggregate([
      {
        // Filtrera på senaste året
        $match: {
          createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        // Gruppera per månad
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      // Sortera efter datum
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Returnera statistik
    res.json({
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10, 
      reviewsPerMonth
    });

  } catch (error) {
    console.error('❌ Error generating review statistics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createReview,
  getAllReviews,
  getReviewById,
  updateReview,
  deleteReview,
  getUserReviews,
  getMovieReviews,
  getReviewStats
};