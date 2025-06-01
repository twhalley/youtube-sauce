require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const mysql = require('mysql2/promise');
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
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    // For AWS RDS SSL configuration
    ca: process.env.SSL_CA || require('fs').readFileSync('./rds-ca-2019-root.pem')
  } : false,
  // RDS specific configurations
  connectTimeout: 20000, // Increase connection timeout for RDS
  maxIdle: 10, // Max idle connections to maintain
  idleTimeout: 60000, // Idle connection timeout
});

// Test database connection on startup
async function testDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    logger.info('Successfully connected to RDS database');
    connection.release();
  } catch (error) {
    logger.error('Failed to connect to RDS database:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

testDatabaseConnection();

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

// Submit source endpoint with improved error handling for RDS
app.post('/api/sources', validateSourceSubmission, async (req, res) => {
  let connection;
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { videoId, title, author, url, timestampFrom, timestampTo, description } = req.body;

    // Get a connection from the pool
    connection = await pool.getConnection();

    // Start transaction
    await connection.beginTransaction();

    // Prepare SQL statement
    const sql = `
      INSERT INTO sources (
        video_id, title, author, url, timestamp_from, 
        timestamp_to, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    // Execute query with prepared statement
    const [result] = await connection.execute(sql, [
      videoId,
      title,
      author,
      url,
      timestampFrom || null,
      timestampTo || null,
      description
    ]);

    // Commit transaction
    await connection.commit();

    logger.info('Source submitted successfully to RDS', {
      videoId,
      sourceId: result.insertId,
      region: process.env.AWS_REGION
    });

    res.status(201).json({
      message: 'Source submitted successfully',
      sourceId: result.insertId
    });

  } catch (error) {
    // Rollback transaction if there was an error
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logger.error('Error rolling back transaction', {
          error: rollbackError.message,
          stack: rollbackError.stack
        });
      }
    }

    logger.error('Error submitting source to RDS', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      sqlState: error.sqlState,
      region: process.env.AWS_REGION
    });

    // Handle specific RDS errors
    if (error.code === 'ER_CON_COUNT_ERROR') {
      return res.status(503).json({
        error: 'Database connection limit reached. Please try again later.'
      });
    } else if (error.code === 'PROTOCOL_CONNECTION_LOST') {
      return res.status(503).json({
        error: 'Database connection was lost. Please try again.'
      });
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      return res.status(503).json({
        error: 'Database access denied. Please contact support.'
      });
    }

    res.status(500).json({
      error: 'An error occurred while submitting the source'
    });
  } finally {
    // Always release the connection back to the pool
    if (connection) {
      connection.release();
    }
  }
});

// Get sources endpoint with improved RDS error handling
app.get('/api/sources/:videoId', [
  body('videoId').trim().matches(/^[a-zA-Z0-9_-]{11}$/).withMessage('Invalid YouTube video ID')
], async (req, res) => {
  let connection;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { videoId } = req.params;

    // Get a connection from the pool
    connection = await pool.getConnection();

    const [sources] = await connection.execute(
      'SELECT * FROM sources WHERE video_id = ? ORDER BY created_at DESC',
      [videoId]
    );

    res.json(sources);

  } catch (error) {
    logger.error('Error fetching sources from RDS', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      sqlState: error.sqlState,
      region: process.env.AWS_REGION
    });

    // Handle specific RDS errors
    if (error.code === 'ER_CON_COUNT_ERROR') {
      return res.status(503).json({
        error: 'Database connection limit reached. Please try again later.'
      });
    }

    res.status(500).json({
      error: 'An error occurred while fetching sources'
    });
  } finally {
    // Always release the connection back to the pool
    if (connection) {
      connection.release();
    }
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