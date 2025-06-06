const jwt = require('jsonwebtoken');
const User = require('../models/User');


// Autentiseringsmiddleware för att verifiera JWT-tokens
const auth = async (req, res, next) => {
  try {
    // Extrahera token från Authorization-headern
    // Format: "Bearer <token>"
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    // Kontrollera att token finns
    if (!token) {
      return res.status(401).json({ 
        message: 'No token, authorization denied',
        code: 'NO_TOKEN'
      });
    }

    // Verifiera och dekoda token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Hämta användare från databasen
    // Exkludera lösenord från resultatet av säkerhetsskäl
    const user = await User.findById(decoded.userId).select('-password');
    
    // Kontrollera att användaren finns
    if (!user) {
      return res.status(401).json({ 
        message: 'Token is not valid - user not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Kontrollera att användarkontot är aktivt
    if (user.isDeactivated) {
      return res.status(401).json({ 
        message: 'Account has been deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Lägg användardata till request-objektet för vidare användning
    req.user = user;
    next();

  } catch (error) {
    // Hantera olika typer av JWT-fel
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED',
        expiredAt: error.expiredAt
      });
    }
    
    if (error.name === 'NotBeforeError') {
      return res.status(401).json({ 
        message: 'Token not active yet',
        code: 'TOKEN_NOT_ACTIVE'
      });
    }

    // Generiskt fel
    res.status(401).json({ 
      message: 'Token is not valid',
      code: 'TOKEN_INVALID'
    });
  }
};


// Auktoriseringsmiddleware för rollbaserad åtkomstkontroll
const authorize = (...roles) => {
  return (req, res, next) => {
    
    // Kontrollera att användaren är autentiserad
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    }

    // Kontrollera att användaren har rätt roll
    if (!roles.includes(req.user.role)) {
      
      return res.status(403).json({ 
        message: `Role '${req.user.role}' is not authorized to access this resource`,
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: roles,
        currentRole: req.user.role
      });
    }
    
    next();
  };
};


// Kontrollerar om användaren är ägare av en resurs eller har admin-behörighet
const isOwnerOrAdmin = (resourceUserId) => {
  return (req, res, next) => {
    // Kontrollera att användaren är autentiserad
    const isOwner = req.user._id.toString() === resourceUserId.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ 
        message: 'Access denied - you can only modify your own resources',
        code: 'NOT_OWNER_OR_ADMIN'
      });
    }

    next();
  };
};


// Rate limiting middleware för att förhindra spam/brute force
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requestCounts = new Map();

  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Rensa gamla entries
    for (const [ip, data] of requestCounts.entries()) {
      if (data.firstRequest < windowStart) {
        requestCounts.delete(ip);
      }
    }

    // Kontrollera current IP
    const clientData = requestCounts.get(clientIP);
    
    if (!clientData) {
      requestCounts.set(clientIP, {
        count: 1,
        firstRequest: now
      });
      return next();
    }

    if (clientData.firstRequest < windowStart) {
      // Reset counter för ny period
      requestCounts.set(clientIP, {
        count: 1,
        firstRequest: now
      });
      return next();
    }

    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        message: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((clientData.firstRequest + windowMs - now) / 1000)
      });
    }

    // Öka counter
    clientData.count++;
    next();
  };
};


module.exports = { 
  auth, 
  authorize, 
  isOwnerOrAdmin, 
  rateLimit 
};