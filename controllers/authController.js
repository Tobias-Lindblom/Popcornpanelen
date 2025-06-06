const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createEvent } = require('./eventController');

// Genererar JWT-token för användare
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};


// Registrerar en ny användare i systemet
const register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Validering av input
    if (!username || !email || !password) {
      return res.status(400).json({ 
        message: 'Username, email and password are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters long' 
      });
    }

    // kontrollera om användarnamn eller e-post redan finns
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'User with this email or username already exists' 
      });
    }

    // Skapa en ny användere
    const user = new User({
      username,
      email,
      password,
      role: role || 'user' // Default till 'user' om ingen roll anges
    });

    await user.save();

    // Skapa en händelse för alla admins
    await createEvent(
      'user_registered',
      'Ny användare registrerad',
      `${user.username} har registrerat sig på plattformen`,
      {
        severity: 'info',
        targetRole: 'admin',
        relatedEntity: {
          entityType: 'user',
          entityId: user._id,
          entityTitle: user.username
        },
        actionUrl: `/admin/users`,
        createdBy: user._id
      }
    );

    // Generera JWT-token
    const token = generateToken(user._id);

    // Skicka svar till klienten
    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Loggar in en befintlig användare
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Hitta användare baserat på e-post
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Verifiera lösenordet
    // Använder User-modellens comparePassword-metod som hashar lösenordet
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generera JWT-token
    const token = generateToken(user._id);

    // Skicka svar till klienten
    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  register,
  login
};