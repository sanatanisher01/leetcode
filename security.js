const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const xss = require('xss');

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
});

// Security middleware
const securityMiddleware = {
  // General rate limiting
  general: createRateLimit(15 * 60 * 1000, 100, 'Too many requests'),
  
  // Admin rate limiting (stricter)
  admin: createRateLimit(15 * 60 * 1000, 10, 'Too many admin requests'),
  
  // Login rate limiting (very strict)
  login: createRateLimit(15 * 60 * 1000, 5, 'Too many login attempts'),
  
  // API rate limiting
  api: createRateLimit(1 * 60 * 1000, 30, 'API rate limit exceeded'),
};

// Input validation and sanitization
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return xss(validator.escape(input.trim()));
};

const validateEmail = (email) => {
  return validator.isEmail(email) && email.length <= 254;
};

const validateUsername = (username) => {
  return validator.isAlphanumeric(username.replace(/[-_]/g, '')) && 
         username.length >= 3 && username.length <= 30;
};

// SQL injection prevention
const sanitizeForSQL = (input) => {
  if (typeof input !== 'string') return input;
  return input.replace(/['";\\]/g, '');
};

// Password hashing
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// JWT token management
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret', {
    expiresIn: '1h',
    issuer: 'leetcode-analytics',
    audience: 'admin'
  });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
  } catch (error) {
    return null;
  }
};

// Security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:", "https://assets.leetcode.com"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// File upload security
const validateFileUpload = (file) => {
  const allowedTypes = ['text/csv', 'text/plain'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only CSV files allowed.');
  }
  
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 5MB.');
  }
  
  return true;
};

// Database query security
const secureQuery = (query, params = []) => {
  // Ensure parameterized queries
  if (query.includes('$') && params.length === 0) {
    throw new Error('Parameterized query requires parameters');
  }
  
  // Sanitize parameters
  const sanitizedParams = params.map(param => 
    typeof param === 'string' ? sanitizeForSQL(param) : param
  );
  
  return { query, params: sanitizedParams };
};

// Session security
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 3600000, // 1 hour
    sameSite: 'strict'
  }
};

module.exports = {
  securityMiddleware,
  sanitizeInput,
  validateEmail,
  validateUsername,
  sanitizeForSQL,
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  securityHeaders,
  validateFileUpload,
  secureQuery,
  sessionConfig
};