require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { Pool } = require('pg');
const winston = require('winston');

// Initialize logger with AWS CloudWatch format
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'youtube-sauce' },
  transports: [
    new winston.transports.File({ filename: '/usr/src/app/logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: '/usr/src/app/logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
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

// Health check endpoint for Kubernetes probes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Database connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: process.env.SSL_CA || require('fs').readFileSync('./rds-ca-2019-root.pem')
  } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
});

// Test database connection on startup
async function testDatabaseConnection() {
  try {
    const client = await pool.connect();
    logger.info('Successfully connected to PostgreSQL database');
    client.release();
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL database:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

testDatabaseConnection();

// Create tables if they don't exist
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sources (
        id SERIAL PRIMARY KEY,
        video_id VARCHAR(11) NOT NULL,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(100) NOT NULL,
        url VARCHAR(2048) NOT NULL,
        timestamp_from VARCHAR(20),
        timestamp_to VARCHAR(20),
        description TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_video_id ON sources(video_id);
      CREATE INDEX IF NOT EXISTS idx_created_at ON sources(created_at);
    `);
    logger.info('Database tables initialized successfully');
  } catch (error) {
    logger.error('Error initializing database tables:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    client.release();
  }
}

initializeDatabase();

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
app.post('/api/sources', validateSourceSubmission, async (req, res) => {
  const client = await pool.connect();
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { videoId, title, author, url, timestampFrom, timestampTo, description } = req.body;

    // Start transaction
    await client.query('BEGIN');

    // Insert source
    const result = await client.query(
      `INSERT INTO sources (
        video_id, title, author, url, timestamp_from, 
        timestamp_to, description, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id`,
      [videoId, title, author, url, timestampFrom || null, timestampTo || null, description]
    );

    // Commit transaction
    await client.query('COMMIT');

    logger.info('Source submitted successfully to PostgreSQL', {
      videoId,
      sourceId: result.rows[0].id,
      region: process.env.AWS_REGION
    });

    res.status(201).json({
      message: 'Source submitted successfully',
      sourceId: result.rows[0].id
    });

  } catch (error) {
    // Rollback transaction if there was an error
    await client.query('ROLLBACK');

    logger.error('Error submitting source to PostgreSQL', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      region: process.env.AWS_REGION
    });

    // Handle specific PostgreSQL errors
    if (error.code === '53300') { // too many connections
      return res.status(503).json({
        error: 'Database connection limit reached. Please try again later.'
      });
    } else if (error.code === '28P01') { // invalid password
      return res.status(503).json({
        error: 'Database access denied. Please contact support.'
      });
    }

    res.status(500).json({
      error: 'An error occurred while submitting the source'
    });
  } finally {
    client.release();
  }
});

// Get sources endpoint
app.get('/api/sources/:videoId', [
  body('videoId').trim().matches(/^[a-zA-Z0-9_-]{11}$/).withMessage('Invalid YouTube video ID')
], async (req, res) => {
  const client = await pool.connect();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { videoId } = req.params;

    const result = await client.query(
      'SELECT * FROM sources WHERE video_id = $1 ORDER BY created_at DESC',
      [videoId]
    );

    res.json(result.rows);

  } catch (error) {
    logger.error('Error fetching sources from PostgreSQL', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      region: process.env.AWS_REGION
    });

    if (error.code === '53300') { // too many connections
      return res.status(503).json({
        error: 'Database connection limit reached. Please try again later.'
      });
    }

    res.status(500).json({
      error: 'An error occurred while fetching sources'
    });
  } finally {
    client.release();
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Starting graceful shutdown...');
  
  // Close the HTTP server
  server.close(() => {
    logger.info('HTTP server closed.');
    
    // Close the database pool
    pool.end().then(() => {
      logger.info('Database connections closed.');
      process.exit(0);
    });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
}); 