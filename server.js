require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const { dbPromise } = require('./config/database');
const RequestModel = require('./models/Request');
const { pixelsMapToObject } = RequestModel;
const { isAdmin, optionalAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Wait for SQLite database to initialize before starting server
let serverReady = false;
dbPromise.then(() => {
  serverReady = true;
  console.log('Database initialized, server ready');
}).catch(err => {
  console.error('Database initialization error:', err);
  process.exit(1);
});

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Increase limit for image data
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files from current directory (where index.html is)
app.use(express.static(__dirname));

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve admin.html for /admin route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Storage for uploaded images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'image-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Helper function to check if timestamp is less than 12 hours old (UTC)
function isLessThan12HoursOld(timestamp) {
  const now = new Date();
  const created = new Date(timestamp);
  const diffMs = now - created;
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours < 12;
}

// Authentication routes
app.use('/api/auth', authRoutes);

// Save pixel request with pending status
app.post('/api/save-request', optionalAuth, async (req, res) => {
  try {
    const { pixels, imageData, imagePosition, link, text, email, telegram, price, pixelCount } = req.body;
    
    // Validate that at least one contact method is provided (email or telegram)
    if (!email && !telegram) {
      return res.status(400).json({ 
        success: false, 
        error: 'Either email or telegram is required (at least one contact method)' 
      });
    }

    // Validate email format if provided
    if (email && email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ 
          success: false, 
          error: 'Please provide a valid email address' 
        });
      }
    }

    // Validate telegram format if provided
    if (telegram && telegram.trim() !== '') {
      const telegramRegex = /^@?[a-zA-Z0-9_]{5,32}$/;
      if (!telegramRegex.test(telegram.trim())) {
        return res.status(400).json({ 
          success: false, 
          error: 'Please provide a valid Telegram username' 
        });
      }
    }

    // Validate link if provided (must be valid URL)
    if (link && link.trim() !== '') {
      try {
        new URL(link.trim());
      } catch (e) {
        return res.status(400).json({ 
          success: false, 
          error: 'Please provide a valid URL for the link field' 
        });
      }
    }

    // Normalize telegram to include @ if not present
    let normalizedTelegram = null;
    if (telegram && telegram.trim() !== '') {
      normalizedTelegram = telegram.trim();
      if (!normalizedTelegram.startsWith('@')) {
        normalizedTelegram = '@' + normalizedTelegram;
      }
    }

    // Create new request
    const newRequest = await RequestModel.createRequest({
      userId: req.user ? req.user.id : null,
      pixels: pixels,
      imageData: imageData || null,
      imagePosition: imagePosition || null,
      link: link && link.trim() !== '' ? link.trim() : null,
      text: text && text.trim() !== '' ? text.trim() : null,
      email: email && email.trim() !== '' ? email.trim() : null,
      telegram: normalizedTelegram,
      price: price ? parseFloat(price) : null,
      pixelCount: pixelCount ? parseInt(pixelCount) : null,
      status: 'pending'
    });

    res.json({ 
      success: true, 
      message: 'Request saved successfully. Our admin will contact you within 12 hours.',
      requestId: newRequest._id.toString()
    });
  } catch (error) {
    console.error('Error saving request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Load project data - only confirmed or pending (< 12 hours old)
// Returns an array of request objects (no wrapper)
app.get('/api/load-project', async (req, res) => {
  try {
    // Get all confirmed requests
    const confirmed = await RequestModel.findRequests({ status: 'confirmed' }, { createdAt: -1 });

    // Get all pending requests and filter manually for date comparison
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const allPending = await RequestModel.findRequests({ status: 'pending' }, { createdAt: -1 });
    
    // Filter pending requests that are less than 12 hours old
    const filteredPending = allPending.filter(req => {
      const createdAt = req.createdAt instanceof Date ? req.createdAt : new Date(req.createdAt);
      return createdAt >= twelveHoursAgo;
    });

    // Combine all requests
    const allRequests = [...confirmed, ...filteredPending];

    // Return list of all requests with their complete data as an array
    const requestsList = allRequests.map(req => {
      // Convert pixels to object
      const pixels = pixelsMapToObject(req.pixels);

      const createdAt = req.createdAt instanceof Date ? req.createdAt : new Date(req.createdAt);
      const updatedAt = req.updatedAt instanceof Date ? req.updatedAt : (req.updatedAt ? new Date(req.updatedAt) : createdAt);

      return {
        id: req._id.toString(),
        pixels: pixels,
        imageData: req.imageData || null,
        imagePosition: req.imagePosition || null,
        link: req.link || null,
        text: req.text || null,
        email: req.email || null,
        telegram: req.telegram || null,
        status: req.status,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString()
      };
    });

    // IMPORTANT: Return array directly, NOT wrapped in {success: true, data: [...]}
    // The frontend expects: [{id: 1, pixels: {...}, ...}, {id: 2, ...}]
    res.json(requestsList);
  } catch (error) {
    console.error('Error loading project:', error);
    // Return empty array on error, not error object
    res.json([]);
  }
});

// Admin endpoint - approve request (change status to confirmed)
app.post('/api/admin/approve/:id', isAdmin, async (req, res) => {
  try {
    const requestId = req.params.id;
    
    // Find request
    const request = await RequestModel.findRequestById(requestId);

    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    // Update status
    await RequestModel.updateRequest(requestId, { status: 'confirmed' });

    res.json({ success: true, message: 'Request approved successfully' });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin endpoint - reject request
app.post('/api/admin/reject/:id', isAdmin, async (req, res) => {
  try {
    const requestId = req.params.id;
    
    // Find request
    const request = await RequestModel.findRequestById(requestId);

    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    // Update status
    await RequestModel.updateRequest(requestId, { status: 'rejected' });

    res.json({ success: true, message: 'Request rejected successfully' });
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin endpoint - change request status (can change to any status)
app.post('/api/admin/change-status/:id', isAdmin, async (req, res) => {
  try {
    const requestId = req.params.id;
    const { status } = req.body;
    
    // Validate status
    if (!status || !['pending', 'confirmed', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status. Must be one of: pending, confirmed, rejected' 
      });
    }
    
    // Find request
    const request = await RequestModel.findRequestById(requestId);

    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    // Update status
    await RequestModel.updateRequest(requestId, { status: status });

    res.json({ 
      success: true, 
      message: `Request status changed to ${status} successfully` 
    });
  } catch (error) {
    console.error('Error changing request status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin endpoint - get all requests
app.get('/api/admin/requests', isAdmin, async (req, res) => {
  try {
    const requests = await RequestModel.findRequests({}, { createdAt: -1 });

    const requestsList = requests.map(req => {
      // Convert pixels Map to object
      const pixels = pixelsMapToObject(req.pixels);
      const createdAt = req.createdAt instanceof Date ? req.createdAt : new Date(req.createdAt || Date.now());
      const isExpired = req.status === 'pending' && !isLessThan12HoursOld(createdAt);

      return {
        id: req._id.toString(),
        pixels: pixels,
        imageData: req.imageData,
        imagePosition: req.imagePosition,
        link: req.link,
        text: req.text,
        email: req.email,
        telegram: req.telegram,
        price: req.price || null,
        pixelCount: req.pixelCount || null,
        status: req.status,
        createdAt: createdAt.toISOString(),
        updatedAt: req.updatedAt ? (req.updatedAt instanceof Date ? req.updatedAt : new Date(req.updatedAt)).toISOString() : createdAt.toISOString(),
        effectiveStatus: isExpired ? 'expired' : req.status
      };
    });

    res.json({ success: true, data: requestsList });
  } catch (error) {
    console.error('Error loading requests:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload image
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }
    
    const imageUrl = `/uploads/${req.file.filename}`;
    
    res.json({ 
      success: true, 
      imageUrl: imageUrl,
      filename: req.file.filename 
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get uploaded image
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Image not found' });
  }
});

// Wait for database to be ready before starting server
dbPromise.then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`SQLite database initialized (sql.js) - data stored locally in ./data/database.db`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
