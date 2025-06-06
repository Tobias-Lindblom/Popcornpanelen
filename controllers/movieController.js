const Movie = require('../models/Movie');
const Review = require('../models/Review');
const mongoose = require('mongoose');
const { createEvent } = require('./eventController');


// Skapar en ny film i systemet (endast admins)
const createMovie = async (req, res) => {
  try {
    // Endast admin kan skapa filmer
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Admin role required to create movies.' 
      });
    }

    // Hämta inputdata
    const { title, director, releaseYear, genre, posterUrl, description } = req.body;

    // Validera obligatoriska fält
    if (!title || !director || !releaseYear || !genre) {
      return res.status(400).json({
        message: 'Titel, regissör, utgivningsår och genre är obligatoriska',
        missing: {
          title: !title,
          director: !director,
          releaseYear: !releaseYear,
          genre: !genre
        }
      });
    }

    // Validera utgivningsår
    const currentYear = new Date().getFullYear();
    if (releaseYear < 1900 || releaseYear > currentYear) {
      return res.status(400).json({
        message: `Utgivningsår måste vara mellan 1900 och ${currentYear}`
      });
    }

    // Kontrollera att filmen inte redan finns
    const existingMovie = await Movie.findOne({ 
      title: { $regex: new RegExp(`^${title}$`, 'i') },
      director: { $regex: new RegExp(`^${director}$`, 'i') },
      releaseYear 
    });
    
    if (existingMovie) {
      return res.status(409).json({ 
        message: 'En film med denna titel, regissör och utgivningsår finns redan' 
      });
    }

    // Skapa filmdata-objekt
    const movieData = {
      title: title.trim(),
      director: director.trim(),
      releaseYear: parseInt(releaseYear),
      genre: genre.trim(),
      posterUrl: posterUrl || undefined,
      description: description?.trim() || undefined,
      averageRating: 0,
      totalReviews: 0       
    };

    // Sparar filmen i databasen
    const movie = new Movie(movieData);
    await movie.save();

    // Skapa händelse för alla användare
    try {
      await createEvent(
        'movie_added',
        'Ny film tillagd',
        `${movie.title} (${movie.releaseYear}) har lagts till`,
        {
          severity: 'success',
          targetRole: 'all',
          relatedEntity: {
            entityType: 'movie',
            entityId: movie._id,
            entityTitle: movie.title
          },
          actionUrl: `/movie/${movie._id}`,
          createdBy: req.user._id
        }
      );
    } catch (eventError) {
      console.warn('⚠️ Failed to create event, but movie was created:', eventError.message);
    }

    res.status(201).json(movie);

  } catch (error) {
    console.error('❌ Error creating movie:', error);
    
    // Hantera olika typer av fel
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Valideringsfel',
        errors: validationErrors
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'En film med denna titel finns redan'
      });
    }

    res.status(500).json({
      message: 'Serverfel vid skapande av film',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internt serverfel'
    });
  }
};


//Hämtar alla filmer från databasen
const getAllMovies = async (req, res) => {
  try {
    // Hämta alla filmer sorterade på datum
    const movies = await Movie.find().sort({ createdAt: -1 });
    res.json(movies);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


//Hämtar en specifik film baserat på ID
const getMovieById = async (req, res) => {
  try {
    // Hitta film med specifikt ID
    const movie = await Movie.findById(req.params.id);
    
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }
    
    res.json(movie);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Uppdaterar en befintlig film (endast admins)
const updateMovie = async (req, res) => {
  try {
    // Behörighetskontroll
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Admin role required to update movies.' 
      });
    }

    // Hämta uppdateringsdata
    const { title, director, releaseYear, genre, posterUrl, description } = req.body;

    // Uppdatera filmen
    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      { title, director, releaseYear, genre, posterUrl, description },
      { 
        new: true,
        runValidators: true 
      }
    );

    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    res.json(movie);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Tar bort en film permanent (endast admins)
const deleteMovie = async (req, res) => {
  try {
    // Behörighetskontroll
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Admin role required to delete movies.' 
      });
    }

    // Hitta filmen innan borttagning
    const movie = await Movie.findById(req.params.id);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    // Skapa händelse före borttagning
    await createEvent(
      'movie_deleted',
      'Film borttagen',
      `${movie.title} har tagits bort från systemet`,
      {
        severity: 'warning',
        targetRole: 'all',
        relatedEntity: {
          entityType: 'movie',
          entityId: movie._id,
          entityTitle: movie.title
        },
        createdBy: req.user._id
      }
    );

    // Ta bort film och alla recensioner
    await Movie.findByIdAndDelete(req.params.id);
    await Review.deleteMany({ movieId: req.params.id });

    res.json({ message: 'Movie and all its reviews deleted successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Hämtar alla recensioner för en specifik film
const getMovieReviews = async (req, res) => {
  try {
    // Hämta alla recensioner för filmen
    const reviews = await Review.find({ movieId: req.params.id })
      .populate('userId', 'username email role')
      .sort({ createdAt: -1 });

    res.json(reviews);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Hämtar alla filmer med beräknade betyg och recensionsantal
const getMoviesWithRatings = async (req, res) => {
  try {
    // Aggregation pipeline för att beräkna ratings
    const movies = await Movie.aggregate([
      {
        // Koppla samman filmer med deras recensioner
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'movieId',
          as: 'reviews'
        }
      },
      {
        // Beräkna genomsnittligt betyg och antal recensioner
        $addFields: {
          averageRating: {
            $cond: {
              if: { $gt: [{ $size: '$reviews' }, 0] },
              then: { $avg: '$reviews.rating' },
              else: 0
            }
          },
          totalReviews: { $size: '$reviews' }
        }
      },
      {
        // Välj vilka fält som ska returneras
        $project: {
          title: 1,
          director: 1,
          releaseYear: 1,
          genre: 1,
          posterUrl: 1,
          description: 1,
          averageRating: { $round: ['$averageRating', 1] },
          totalReviews: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      {
        // Sortera efter senast skapade
        $sort: { createdAt: -1 }
      }
    ]);

    res.json(movies);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Uppdaterar en films genomsnittliga betyg baserat på alla dess recensioner
const updateMovieRating = async (movieId) => {
  try {
    // Beräkna nytt genomsnitt med aggregation
    const stats = await Review.aggregate([
      {
        // Hitta alla recensioner för denna film
        $match: { 
          movieId: new mongoose.Types.ObjectId(movieId)
        }
      },
      {
        // Beräkna genomsnitt och antal
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    // Extrahera resultat eller sätt default-värden
    const averageRating = stats.length > 0 ? stats[0].averageRating : 0;
    const totalReviews = stats.length > 0 ? stats[0].totalReviews : 0;

    // Uppdatera filmen med nya värden
    await Movie.findByIdAndUpdate(
      movieId, 
      {
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews
      },
      { new: true }
    );

    return { 
      averageRating: Math.round(averageRating * 10) / 10, 
      totalReviews 
    };

  } catch (error) {
    throw error;
  }
};

module.exports = {
  createMovie,
  getAllMovies,
  getMovieById,
  updateMovie,
  deleteMovie,
  getMovieReviews,
  getMoviesWithRatings,
  updateMovieRating
};