const geoip = require('geoip-lite');

// Visitor tracking middleware
function trackVisitor(req, res, next) {
  const visitorInfo = {
    ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
    userAgent: req.headers['user-agent'],
    timestamp: new Date(),
    url: req.originalUrl,
    method: req.method,
    referer: req.headers.referer || 'Direct',
    sessionId: req.sessionID || 'anonymous'
  };

  // Get location from IP
  const geo = geoip.lookup(visitorInfo.ip);
  if (geo) {
    visitorInfo.country = geo.country;
    visitorInfo.region = geo.region;
    visitorInfo.city = geo.city;
    visitorInfo.timezone = geo.timezone;
  }

  // Parse user agent for device info
  const ua = req.headers['user-agent'] || '';
  visitorInfo.browser = getBrowser(ua);
  visitorInfo.os = getOS(ua);
  visitorInfo.device = getDevice(ua);

  // Store visitor data
  req.visitorInfo = visitorInfo;
  
  // Log to database (async, don't block request)
  logVisitor(visitorInfo).catch(console.error);
  
  next();
}

// Save visitor to database
async function logVisitor(visitorInfo) {
  try {
    const { pool } = require('./database');
    
    await pool.query(`
      INSERT INTO visitor_logs (
        ip_address, user_agent, timestamp, url, method, referer, 
        country, region, city, timezone, browser, os, device, session_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      visitorInfo.ip,
      visitorInfo.userAgent,
      visitorInfo.timestamp,
      visitorInfo.url,
      visitorInfo.method,
      visitorInfo.referer,
      visitorInfo.country || 'Unknown',
      visitorInfo.region || 'Unknown',
      visitorInfo.city || 'Unknown',
      visitorInfo.timezone || 'Unknown',
      visitorInfo.browser,
      visitorInfo.os,
      visitorInfo.device,
      visitorInfo.sessionId
    ]);
  } catch (error) {
    console.error('Error logging visitor:', error);
  }
}

// Initialize visitor tracking table
async function initializeVisitorTable() {
  try {
    const { pool } = require('./database');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS visitor_logs (
        id SERIAL PRIMARY KEY,
        ip_address INET,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        url TEXT,
        method VARCHAR(10),
        referer TEXT,
        country VARCHAR(100),
        region VARCHAR(100),
        city VARCHAR(100),
        timezone VARCHAR(100),
        browser VARCHAR(100),
        os VARCHAR(100),
        device VARCHAR(100),
        session_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Visitor tracking table initialized');
  } catch (error) {
    console.error('❌ Error initializing visitor table:', error);
  }
}

// Get visitor analytics
async function getVisitorAnalytics(timeframe = '24h') {
  try {
    const { pool } = require('./database');
    
    let timeCondition = '';
    switch (timeframe) {
      case '1h':
        timeCondition = "timestamp >= NOW() - INTERVAL '1 hour'";
        break;
      case '24h':
        timeCondition = "timestamp >= NOW() - INTERVAL '24 hours'";
        break;
      case '7d':
        timeCondition = "timestamp >= NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        timeCondition = "timestamp >= NOW() - INTERVAL '30 days'";
        break;
      default:
        timeCondition = "timestamp >= NOW() - INTERVAL '24 hours'";
    }

    // Total visitors
    const totalResult = await pool.query(`
      SELECT COUNT(DISTINCT ip_address) as unique_visitors,
             COUNT(*) as total_visits
      FROM visitor_logs 
      WHERE ${timeCondition}
    `);

    // Top countries
    const countriesResult = await pool.query(`
      SELECT country, COUNT(DISTINCT ip_address) as visitors
      FROM visitor_logs 
      WHERE ${timeCondition} AND country != 'Unknown'
      GROUP BY country 
      ORDER BY visitors DESC 
      LIMIT 10
    `);

    // Top pages
    const pagesResult = await pool.query(`
      SELECT url, COUNT(*) as visits
      FROM visitor_logs 
      WHERE ${timeCondition}
      GROUP BY url 
      ORDER BY visits DESC 
      LIMIT 10
    `);

    // Browsers
    const browsersResult = await pool.query(`
      SELECT browser, COUNT(DISTINCT ip_address) as users
      FROM visitor_logs 
      WHERE ${timeCondition}
      GROUP BY browser 
      ORDER BY users DESC 
      LIMIT 5
    `);

    // Recent visitors
    const recentResult = await pool.query(`
      SELECT ip_address, country, city, browser, os, timestamp, url
      FROM visitor_logs 
      WHERE ${timeCondition}
      ORDER BY timestamp DESC 
      LIMIT 20
    `);

    return {
      summary: totalResult.rows[0],
      countries: countriesResult.rows,
      pages: pagesResult.rows,
      browsers: browsersResult.rows,
      recent: recentResult.rows
    };
  } catch (error) {
    console.error('Error getting visitor analytics:', error);
    return null;
  }
}

// Helper functions
function getBrowser(userAgent) {
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  return 'Other';
}

function getOS(userAgent) {
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS')) return 'iOS';
  return 'Other';
}

function getDevice(userAgent) {
  if (userAgent.includes('Mobile')) return 'Mobile';
  if (userAgent.includes('Tablet')) return 'Tablet';
  return 'Desktop';
}

module.exports = {
  trackVisitor,
  initializeVisitorTable,
  getVisitorAnalytics
};