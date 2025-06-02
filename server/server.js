require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'youtube-sauce' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
});
app.use(limiter);

// Body parser middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Input validation middleware
const validateSourceSubmission = [
  body('videoId').trim().notEmpty().withMessage('Video ID is required')
    .matches(/^[a-zA-Z0-9_-]{11}$/).withMessage('Invalid YouTube video ID'),
  body('title').trim().notEmpty().withMessage('Video title is required')
    .isLength({ max: 255 }).withMessage('Title too long'),
  body('author').trim().notEmpty().withMessage('Author is required')
    .isLength({ max: 100 }).withMessage('Author name too long'),
  body('url').trim().notEmpty().withMessage('URL is required')
    .isURL().withMessage('Invalid URL')
    .isLength({ max: 2048 }).withMessage('URL too long'),
  body('timestampFrom').optional({ nullable: true }).matches(/^(\d{1,2}:)?(\d{1,2}:)?\d{1,2}$/)
    .withMessage('Invalid timestamp format'),
  body('timestampTo').optional({ nullable: true }).matches(/^(\d{1,2}:)?(\d{1,2}:)?\d{1,2}$/)
    .withMessage('Invalid timestamp format'),
  body('description').trim().notEmpty().withMessage('Description is required')
    .isLength({ max: 1000 }).withMessage('Description too long')
];

// Submit source endpoint
app.post('/api/sources', validateSourceSubmission, (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Log the received data
    logger.info('Received source submission:', {
      body: req.body
    });

    res.status(201).json({
      message: 'Source received successfully',
      source: req.body
    });

  } catch (error) {
    logger.error('Error processing source submission:', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'An error occurred while processing the source'
    });
  }
});

// Get sources endpoint
app.get('/api/sources/:videoId', [
  body('videoId').trim().matches(/^[a-zA-Z0-9_-]{11}$/).withMessage('Invalid YouTube video ID')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { videoId } = req.params;
    
    // Log the request
    logger.info('Received request for sources:', {
      videoId
    });

    // Return empty array since we're not storing data
    res.json([]);

  } catch (error) {
    logger.error('Error processing sources request:', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'An error occurred while fetching sources'
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
}); 