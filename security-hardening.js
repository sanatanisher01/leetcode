// Additional security measures
const crypto = require('crypto');

// Generate secure random passwords
function generateSecurePassword(length = 16) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Check password strength
function checkPasswordStrength(password) {
  const minLength = 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const score = [
    password.length >= minLength,
    hasUpper,
    hasLower, 
    hasNumber,
    hasSpecial
  ].filter(Boolean).length;
  
  return {
    score,
    isStrong: score >= 4,
    feedback: {
      length: password.length >= minLength,
      uppercase: hasUpper,
      lowercase: hasLower,
      numbers: hasNumber,
      special: hasSpecial
    }
  };
}

// Account lockout after failed attempts
const failedAttempts = new Map();

function checkAccountLockout(username) {
  const attempts = failedAttempts.get(username) || { count: 0, lastAttempt: 0 };
  const now = Date.now();
  
  // Reset after 1 hour
  if (now - attempts.lastAttempt > 3600000) {
    attempts.count = 0;
  }
  
  // Lock after 5 failed attempts
  if (attempts.count >= 5) {
    const lockoutTime = 3600000; // 1 hour
    const timeLeft = lockoutTime - (now - attempts.lastAttempt);
    if (timeLeft > 0) {
      return {
        locked: true,
        timeLeft: Math.ceil(timeLeft / 60000) // minutes
      };
    }
  }
  
  return { locked: false };
}

function recordFailedAttempt(username) {
  const attempts = failedAttempts.get(username) || { count: 0, lastAttempt: 0 };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  failedAttempts.set(username, attempts);
}

function clearFailedAttempts(username) {
  failedAttempts.delete(username);
}

// IP-based rate limiting
const ipAttempts = new Map();

function checkIPRateLimit(ip) {
  const attempts = ipAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  const now = Date.now();
  
  // Reset after 15 minutes
  if (now - attempts.lastAttempt > 900000) {
    attempts.count = 0;
  }
  
  // Limit to 10 attempts per 15 minutes per IP
  if (attempts.count >= 10) {
    return {
      limited: true,
      timeLeft: Math.ceil((900000 - (now - attempts.lastAttempt)) / 60000)
    };
  }
  
  return { limited: false };
}

function recordIPAttempt(ip) {
  const attempts = ipAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  ipAttempts.set(ip, attempts);
}

// Security headers middleware
function securityHeaders(req, res, next) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self';"
  );
  
  next();
}

// Log security events
async function logSecurityEvent(event, details) {
  try {
    const { pool } = require('./database');
    
    await pool.query(`
      INSERT INTO security_logs (event_type, details, ip_address, timestamp)
      VALUES ($1, $2, $3, $4)
    `, [event, JSON.stringify(details), details.ip, new Date()]);
    
    console.log(`🔒 Security Event: ${event}`, details);
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// Initialize security logs table
async function initializeSecurityLogs() {
  try {
    const { pool } = require('./database');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS security_logs (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        details JSONB,
        ip_address INET,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Security logs table initialized');
  } catch (error) {
    console.error('❌ Error initializing security logs:', error);
  }
}

module.exports = {
  generateSecurePassword,
  checkPasswordStrength,
  checkAccountLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  checkIPRateLimit,
  recordIPAttempt,
  securityHeaders,
  logSecurityEvent,
  initializeSecurityLogs
};