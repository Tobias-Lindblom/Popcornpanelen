const User = require('../models/User');
const Review = require('../models/Review');


// Hämtar den inloggade användarens profil
const getProfile = async (req, res) => {
  try {

    // Hämta användarprofil utan lösenord
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);

  } catch (error) {
    console.error('❌ Error fetching profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Uppdaterar den inloggade användarens profil
const updateProfile = async (req, res) => {
  try {
    const { username, email } = req.body;
    
    // Validera obligatoriska fält
    if (!username || !email) {
      return res.status(400).json({ 
        message: 'Username and email are required' 
      });
    }

    //Kontrollera att användarnamnet/email inte redan används
    const existingUser = await User.findOne({
      $and: [
        { _id: { $ne: req.user._id } },
        { $or: [{ email }, { username }] }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'Username or email already exists' 
      });
    }

    // Uppdatera användarprofilen
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        username: username.trim(), 
        email: email.trim().toLowerCase() 
      },
      { 
        new: true,
        runValidators: true
      }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user
    });

  } catch (error) {
    console.error('❌ Error updating profile:', error);
    
    // Hantera valideringsfel
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Valideringsfel',
        errors: validationErrors
      });
    }

    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Hämtar alla recensioner för den inloggade användaren
const getUserReviews = async (req, res) => {
  try {

    // Hämta användarens alla recensioner
    const reviews = await Review.find({ userId: req.user._id })
      .populate('movieId', 'title director releaseYear genre posterUrl')
      .sort({ createdAt: -1 });

    res.json(reviews);

  } catch (error) {
    console.error('❌ Error fetching user reviews:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Hämtar alla användare i systemet (endast admins)
const getAllUsers = async (req, res) => {
  try {
    // Behörighetskontroll
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Admin role required.' 
      });
    }

    // Hämta alla användare utan lösenord
    const users = await User.find({}, '-password')
      .sort({ createdAt: -1 });

    res.json(users);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Hämtar en specifik användare baserat på ID
const getUserById = async (req, res) => {
  try {
    const targetUserId = req.params.id;

    // Användare kan bara se sin egen profil, admins kan se alla
    if (req.user.role !== 'admin' && req.user._id.toString() !== targetUserId) {
      return res.status(403).json({ 
        message: 'Access denied' 
      });
    }

    // Hämta användarprofil utan lösenord
    const user = await User.findById(targetUserId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);

  } catch (error) {
    console.error('❌ Error fetching user by ID:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Uppdaterar en användares roll (endast admins)
const updateUserRole = async (req, res) => {
  try {
    // Behörighetskontroll
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Admin role required.' 
      });
    }

    const { role } = req.body;
    const targetUserId = req.params.id;
    
    // Validera ny roll
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ 
        message: 'Invalid role. Must be user or admin' 
      });
    }

    // Förhindra att admin ändrar sin egen roll
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ 
        message: 'Cannot change your own role' 
      });
    }

    // Uppdatera användarroller
    const user = await User.findByIdAndUpdate(
      targetUserId,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Tar bort en användare permanent (endast admins)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ DELETE USER REQUEST:', {
      userIdToDelete: id,
      requestingUser: req.user._id,
      requestingUserRole: req.user.role
    });

    // Endast admin kan ta bort användare
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Endast administratörer kan ta bort användare' 
      });
    }

    // Användaren kan inte ta bort sig själv
    if (req.user._id.toString() === id) {
      return res.status(400).json({ 
        message: 'Du kan inte ta bort ditt eget konto' 
      });
    }

    // Hitta användaren som ska tas bort
    const userToDelete = await User.findById(id);
    if (!userToDelete) {
      return res.status(404).json({ message: 'Användare hittades inte' });
    }

    console.log('👤 Found user to delete:', {
      username: userToDelete.username,
      email: userToDelete.email,
      role: userToDelete.role
    });

    // Ta bort alla recensioner av denna användare först
    const deletedReviews = await Review.deleteMany({ userId: id });
    console.log(`📝 Deleted ${deletedReviews.deletedCount} reviews by user`);

    // Ta bort användaren
    await User.findByIdAndDelete(id);
    console.log('✅ User deleted successfully');

    // Skapa händelse för andra admins (om eventController finns)
    try {
      await createEvent(
        'user_deleted',
        'Användare borttagen',
        `Användaren "${userToDelete.username}" har tagits bort av ${req.user.username}`,
        {
          severity: 'warning',
          targetRole: 'admin',
          relatedEntity: {
            entityType: 'user',
            entityId: id,
            entityTitle: userToDelete.username
          },
          createdBy: req.user._id
        }
      );
    } catch (eventError) {
      console.warn('⚠️ Could not create event:', eventError.message);
      // Fortsätt ändå, detta är inte kritiskt
    }

    res.json({ 
      message: 'Användare och alla relaterade data har tagits bort',
      deletedUser: {
        id: userToDelete._id,
        username: userToDelete.username,
        email: userToDelete.email
      },
      deletedReviewsCount: deletedReviews.deletedCount
    });
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    res.status(500).json({ 
      message: 'Serverfel vid borttagning av användare', 
      error: error.message 
    });
  }
};


// Genererar användarstatistik för admin-dashboard (endast admins)
const getUserStats = async (req, res) => {
  try {
    // Behörighetskontroll
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Admin role required.' 
      });
    }

    // Grundläggande användarstatistik
    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const regularUsers = await User.countDocuments({ role: 'user' });

    // Nya användare de senaste 30 dagarna
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newUsersLast30Days = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Användarregistreringar per månad under det senaste året
    const usersPerMonth = await User.aggregate([
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

    // Mest aktiva användare (baserat på antal recensioner)
    const mostActiveUsers = await Review.aggregate([
      {
        // Gruppera recensioner per användare
        $group: {
          _id: '$userId',
          reviewCount: { $sum: 1 }
        }
      },
      {
        // Koppla samman med användardata
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        // Packa upp användardata
        $unwind: '$user'
      },
      {
        // Välj relevanta fält
        $project: {
          username: '$user.username',
          email: '$user.email',
          role: '$user.role',
          reviewCount: 1,
          _id: 1
        }
      },
      // Sortera efter antal recensioner
      { $sort: { reviewCount: -1 } },
      // Begränsa till de 5 mest aktiva användarna
      { $limit: 5 }
    ]);

    // Returnera komplett statistik
    res.json({
      totalUsers,
      adminUsers,
      regularUsers,
      newUsersLast30Days,
      usersPerMonth,
      mostActiveUsers
    });

  } catch (error) {
    console.error('❌ Error generating user statistics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


module.exports = {
  getProfile,
  updateProfile,
  getUserReviews,
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  getUserStats
};