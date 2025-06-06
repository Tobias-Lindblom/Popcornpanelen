const Event = require('../models/Event');


// Hämtar händelser för den inloggade användaren
const getMyEvents = async (req, res) => {
  try {
    // Hämtar användardata och query-parametrar
    const userId = req.user._id;
    const userRole = req.user.role;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const unreadOnly = req.query.unread === 'true';

    // Bygg databasfilter
    let filter = {
      isActive: true,
      $or: [
        { targetUser: userId },
        { targetRole: userRole },
        { targetRole: 'all' }
      ]
    };

    // Kontrollera att händelsen inte har gått ut
    filter.$and = [
      {
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      }
    ];

    // Filtera på olästa händelser om det är angivet
    if (unreadOnly) {
      filter['isRead.userId'] = { $ne: userId };
    }

    // Hämta händelser från databasen
    const events = await Event.find(filter)
      .populate('createdBy', 'username role')
      .populate('targetUser', 'username')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    // Lägg till lässtatus för alla händelser
    const eventsWithReadStatus = events.map(event => {
      const isRead = event.isRead.some(read => 
        read.userId.toString() === userId.toString()
      );
      return {
        ...event.toObject(),
        isReadByUser: isRead
      };
    });

    // Räkna totalt antal händelser och olästa
    const totalEvents = await Event.countDocuments(filter);
    const unreadCount = await Event.countDocuments({
      ...filter,
      'isRead.userId': { $ne: userId }
    });

    // Skicka svar till klienten
    res.json({
      events: eventsWithReadStatus,
      unreadCount,
      pagination: {
        page,
        limit,
        total: totalEvents,
        pages: Math.ceil(totalEvents / limit)
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Markerar en specifik händelse som läst för den inloggade användaren
const markEventAsRead = async (req, res) => {
  try {
    // Hämta parametrar och användardata
    const eventId = req.params.id;
    const userId = req.user._id;

    // Hitta händelsen
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Kontrollera behörighet
    const canSee = 
      event.targetUser?.toString() === userId.toString() ||
      event.targetRole === req.user.role ||
      event.targetRole === 'all';

    if (!canSee) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Lägg till lässtatus om den inte redan finns
    const alreadyRead = event.isRead.some(read => 
      read.userId.toString() === userId.toString()
    );
    
    if (!alreadyRead) {
      event.isRead.push({ userId: userId });
      await event.save();
    }

    res.json({ message: 'Event marked as read' });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Markerar alla användarens tillgängliga händelser som lästa
const markAllEventsAsRead = async (req, res) => {
  try {
    // Hämta användardata
    const userId = req.user._id;
    const userRole = req.user.role;

    // Hitta alla olästa händelser som användaren kan se
    const events = await Event.find({
      isActive: true,
      'isRead.userId': { $ne: userId },
      $or: [
        { targetUser: userId },
        { targetRole: userRole },
        { targetRole: 'all' }
      ]
    });

    // Markera alla som lästa parallellt
    const updatePromises = events.map(event => {
      event.isRead.push({ userId: userId });
      return event.save();
    });

    await Promise.all(updatePromises);

    res.json({ 
      message: 'All events marked as read',
      markedCount: events.length 
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Skapar ett systemmeddelande (endast admins)
const createSystemMessage = async (req, res) => {
  try {
    // Kontrollera admin-behörighet
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Admin role required.' 
      });
    }

    // Hämta input-data
    const { 
      title, 
      message, 
      severity, 
      targetRole,
      targetUser,
      actionUrl,
      expiresAt 
    } = req.body;

    // Validera obligatoriska fält
    if (!title || !message) {
      return res.status(400).json({ 
        message: 'Title and message are required' 
      });
    }

    // Skapa ny händelse
    const event = new Event({
      type: 'system_message',
      title,
      message,
      severity: severity || 'info',
      targetRole: targetRole || 'all',
      targetUser: targetUser || null,
      actionUrl,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdBy: req.user._id
    });

    await event.save();
    await event.populate('createdBy', 'username role');

    res.status(201).json(event);

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Hämtar alla händelser för admin-översikt
const getAllEvents = async (req, res) => {
  try {
    // Kontrollera admin-behörighet
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Admin role required.' 
      });
    }

    // Hämta query-parametrar
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const type = req.query.type;

    // Bygg filter
    let filter = {};
    if (type) filter.type = type;

    // Hämta händelser
    const events = await Event.find(filter)
      .populate('createdBy', 'username role')
      .populate('targetUser', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const totalEvents = await Event.countDocuments(filter);

    res.json({
      events,
      pagination: {
        page,
        limit,
        total: totalEvents,
        pages: Math.ceil(totalEvents / limit)
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Tar bort en händelse permanent (endast admins)
const deleteEvent = async (req, res) => {
  try {
    // Kontrollera admin-behörighet
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Admin role required.' 
      });
    }

    // Ta bort händelsen
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({ message: 'Event deleted successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Hjälpfunktion för att skapa händelser
const createEvent = async (type, title, message, options = {}) => {
  try {
    const event = new Event({
      type,
      title,
      message,
      severity: options.severity || 'info',
      targetUser: options.targetUser,
      targetRole: options.targetRole || 'all',
      relatedEntity: options.relatedEntity,
      actionUrl: options.actionUrl,
      expiresAt: options.expiresAt,
      createdBy: options.createdBy
    });

    await event.save();
    return event;

  } catch (error) {
    console.error('Error creating event:', error);
    return null;
  }
};

module.exports = {
  getMyEvents,
  markEventAsRead,
  markAllEventsAsRead,
  createSystemMessage,
  getAllEvents,
  deleteEvent,
  createEvent
};