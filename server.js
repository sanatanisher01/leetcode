require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const cron = require('node-cron');
const http = require('http');
const WebSocketServer = require('./websocket-server');
const TaskScheduler = require('./scheduler');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { sendWarningEmail, sendBulkWarningEmails, sendCustomEmail, sendWelcomeEmail } = require('./email-service');
const { pool, initializeDatabase } = require('./database');
const {
  securityMiddleware,
  sanitizeInput,
  validateEmail,
  validateUsername,
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  securityHeaders,
  validateFileUpload,
  secureQuery,
  sessionConfig
} = require('./security');
const { trackVisitor, initializeVisitorTable, getVisitorAnalytics } = require('./visitor-tracker');

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(securityHeaders);
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://leetcode-gla.onrender.com'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use(session(sessionConfig));

// Rate limiting
app.use(securityMiddleware.general);
app.use('/admin', securityMiddleware.admin);
app.use('/admin/login', securityMiddleware.login);
app.use('/api', securityMiddleware.api);

// Visitor tracking
app.use(trackVisitor);

// Initialize Database
initializeDatabase().catch(console.error);

// Initialize batches table
async function initializeBatchesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS batches (
        id SERIAL PRIMARY KEY,
        prefix VARCHAR(10) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Batches table initialized');
  } catch (error) {
    console.error('❌ Error initializing batches table:', error);
  }
}
initializeBatchesTable();

// Initialize visitor tracking
initializeVisitorTable();

// Initialize analytics history table
async function initializeAnalyticsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analytics_history (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        total_users INTEGER NOT NULL,
        avg_problems INTEGER NOT NULL,
        top_performer VARCHAR(255) NOT NULL,
        leaderboard_data JSONB NOT NULL,
        analytics_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Analytics history table initialized');
  } catch (error) {
    console.error('❌ Error initializing analytics history table:', error);
  }
}
initializeAnalyticsTable();

// Create admin user
async function createAdminUser() {
  try {
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminUsername || !adminPassword) {
      console.error('❌ ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env file');
      return;
    }
    
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    
    // Delete existing admin and create new one
    await pool.query('DELETE FROM admins');
    await pool.query(`
      INSERT INTO admins (username, password) 
      VALUES ($1, $2)
    `, [adminUsername, hashedPassword]);
    
    console.log(`✅ Admin user created: ${adminUsername}`);
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}
createAdminUser();

// LeetCode GraphQL queries
const LEETCODE_QUERY = `
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      realName
      userAvatar
      ranking
    }
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
    }
    userCalendar {
      streak
      totalActiveDays
      submissionCalendar
    }
  }
}`;

// Fetch user data from LeetCode
async function fetchLeetCodeUser(username) {
  const maxRetries = 3;
  const timeoutMs = 8000;
  
  for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
    try {
      console.log(`🔄 Fetching ${username} (attempt ${retryCount + 1}/${maxRetries + 1})...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          query: LEETCODE_QUERY,
          variables: { username }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const user = data.data?.matchedUser;
      
      if (!user) return null;
      
      const stats = user.submitStatsGlobal?.acSubmissionNum || [];
      const easy = stats.find(s => s.difficulty === 'Easy')?.count || 0;
      const medium = stats.find(s => s.difficulty === 'Medium')?.count || 0;
      const hard = stats.find(s => s.difficulty === 'Hard')?.count || 0;
      
      const calendar = user.userCalendar || {};
      const currentStreak = calendar.streak || 0;
      const submissionCalendar = JSON.parse(calendar.submissionCalendar || '{}');
      
      // Calculate longest streak
      const timestamps = Object.keys(submissionCalendar)
        .filter(ts => parseInt(submissionCalendar[ts]) > 0)
        .map(ts => parseInt(ts))
        .sort((a, b) => a - b);
      
      let longestStreak = currentStreak;
      if (timestamps.length > 0) {
        let maxStreak = 1;
        let currentCalcStreak = 1;
        
        for (let i = 1; i < timestamps.length; i++) {
          const dayDiff = Math.floor((timestamps[i] - timestamps[i-1]) / 86400);
          if (dayDiff === 1) {
            currentCalcStreak++;
            maxStreak = Math.max(maxStreak, currentCalcStreak);
          } else {
            currentCalcStreak = 1;
          }
        }
        longestStreak = Math.max(maxStreak, currentStreak);
      }
      
      console.log(`✅ Success ${username}: ${easy + medium + hard} problems`);
      
      return {
        username: user.username,
        avatar: user.profile?.userAvatar || 'https://via.placeholder.com/50',
        contestRanking: user.profile?.ranking || 0,
        totalSolved: easy + medium + hard,
        easy,
        medium,
        hard,
        officialStreak: currentStreak,
        currentStreak: currentStreak,
        longestStreak,
        submissionCalendar,
        lastSubmissionDate: timestamps.length > 0 ? 
          new Date(Math.max(...timestamps) * 1000).toISOString().split('T')[0] : null,
        isValid: true
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`⏰ Timeout for ${username}`);
      } else if ((error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') && retryCount < maxRetries) {
        console.log(`⏳ Retrying ${username} in ${1000 * (retryCount + 1)}ms...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        continue;
      } else {
        console.log(`❌ ${username}: API timeout/error`);
      }
      
      if (retryCount === maxRetries) {
        return null;
      }
    }
  }
  return null;
}

// Save user data to PostgreSQL
async function saveUserData(userData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Insert or update user
    await client.query(`
      INSERT INTO users (username) 
      VALUES ($1) 
      ON CONFLICT (username) DO NOTHING
    `, [userData.username]);
    
    // Insert or update daily stats
    await client.query(`
      INSERT INTO daily_stats 
      (username, date, total_solved, easy_solved, medium_solved, hard_solved, contest_rating, last_submission_date) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (username, date) 
      DO UPDATE SET 
        total_solved = EXCLUDED.total_solved,
        easy_solved = EXCLUDED.easy_solved,
        medium_solved = EXCLUDED.medium_solved,
        hard_solved = EXCLUDED.hard_solved,
        contest_rating = EXCLUDED.contest_rating,
        last_submission_date = EXCLUDED.last_submission_date
    `, [userData.username, today, userData.totalSolved, userData.easy, userData.medium, 
        userData.hard, userData.contestRanking || 0, userData.lastSubmissionDate]);
    
    // Update streak data
    const currentStreak = userData.officialStreak || userData.currentStreak || 0;
    const longestStreak = Math.max(userData.longestStreak || 0, currentStreak);
    
    await client.query(`
      INSERT INTO streaks 
      (username, current_streak, longest_streak, last_activity_date) 
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) 
      DO UPDATE SET 
        current_streak = EXCLUDED.current_streak,
        longest_streak = GREATEST(streaks.longest_streak, EXCLUDED.longest_streak),
        last_activity_date = EXCLUDED.last_activity_date,
        updated_at = CURRENT_TIMESTAMP
    `, [userData.username, currentStreak, longestStreak, userData.lastSubmissionDate || today]);
    
    await client.query('COMMIT');
    console.log(`💾 Saved data for ${userData.username}: ${userData.totalSolved} problems, ${currentStreak} streak`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error saving data for ${userData.username}:`, error);
  } finally {
    client.release();
  }
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
}

// Admin login endpoint
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
    const admin = result.rows[0];
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.admin = { id: admin.id, username: admin.username };
    res.json({ success: true, message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Admin logout endpoint
app.post('/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logout successful' });
});

// Check authentication status
app.get('/admin/check-auth', requireAuth, (req, res) => {
  res.json({ authenticated: true, user: req.session.admin });
});

// Get admin dashboard data
app.get('/admin/dashboard', requireAuth, async (req, res) => {
  try {
    const { batch } = req.query;
    const results = {};
    
    // Create batch filter condition
    let batchCondition = '';
    if (batch && batch !== 'all') {
      batchCondition = `AND (se.roll_no LIKE '${batch}%' OR se.roll_no IS NULL)`;
    }
    
    // Total users
    const totalUsersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    results.totalUsers = parseInt(totalUsersResult.rows[0].count) || 0;
    
    // Active today - users with recent LeetCode activity (fallback to any users if none active)
    const activeTodayResult = await pool.query(`
      SELECT COUNT(DISTINCT s.username) as count 
      FROM streaks s
      WHERE s.last_activity_date >= CURRENT_DATE - INTERVAL '1 day'
    `);
    let activeCount = parseInt(activeTodayResult.rows[0].count) || 0;
    
    // Show proper message when database is empty
    if (results.totalUsers === 0) {
      results.activeToday = 0;
      results.inactiveToday = 0;
      results.message = "No students registered yet. Upload CSV to add students.";
    } else if (activeCount === 0 && results.totalUsers > 0) {
      results.activeToday = 0;
      results.inactiveToday = results.totalUsers;
    } else {
      results.activeToday = activeCount;
      results.inactiveToday = results.totalUsers - activeCount;
    }
    
    // Highest streak
    const highestStreakResult = await pool.query('SELECT MAX(longest_streak) as max_streak FROM streaks');
    results.highestStreak = parseInt(highestStreakResult.rows[0].max_streak) || 0;
    
    // Top streaks
    const topStreaksResult = await pool.query(`
      SELECT 
        s.username,
        COALESCE(se.name, s.username) as name,
        COALESCE(se.roll_no, '') as roll_no,
        s.current_streak, 
        s.longest_streak, 
        s.last_activity_date,
        COALESCE(ds.total_solved, 0) as total_solved
      FROM streaks s
      LEFT JOIN daily_stats ds ON s.username = ds.username
      LEFT JOIN student_emails se ON s.username = se.username
      WHERE ds.date = (SELECT MAX(date) FROM daily_stats ds2 WHERE ds2.username = s.username)
         OR ds.date IS NULL
      ORDER BY COALESCE(ds.total_solved, 0) DESC, s.longest_streak DESC
      LIMIT 10
    `);
    results.topStreaks = topStreaksResult.rows;
    
    // Recent activity
    const recentActivityResult = await pool.query(`
      SELECT username, total_solved, date 
      FROM daily_stats 
      WHERE date >= CURRENT_DATE - INTERVAL '7 days' 
      ORDER BY date DESC 
      LIMIT 20
    `);
    results.recentActivity = recentActivityResult.rows;
    
    // Calculate inactive students (users with no activity in 3+ days)
    const inactiveStudentsResult = await pool.query(`
      SELECT 
        u.username,
        COALESCE(se.name, u.username) as name,
        COALESCE(se.roll_no, '') as roll_no,
        COALESCE(ds.total_solved, 0) as total_solved,
        COALESCE(s.current_streak, 0) as current_streak,
        COALESCE(s.longest_streak, 0) as longest_streak,
        s.last_activity_date,
        CASE 
          WHEN s.last_activity_date IS NULL THEN 999
          ELSE (CURRENT_DATE - s.last_activity_date)
        END as days_inactive
      FROM users u
      LEFT JOIN daily_stats ds ON u.username = ds.username
      LEFT JOIN streaks s ON u.username = s.username
      LEFT JOIN student_emails se ON u.username = se.username
      WHERE (ds.date = (SELECT MAX(date) FROM daily_stats ds2 WHERE ds2.username = u.username) OR ds.date IS NULL)
      ${batchCondition}
      AND (
        s.last_activity_date IS NULL OR 
        (CURRENT_DATE - s.last_activity_date) >= 3
      )
      ORDER BY days_inactive DESC
      LIMIT 20
    `);
    results.inactiveStudents = inactiveStudentsResult.rows;
    
    // Get total count of inactive students
    const totalInactiveResult = await pool.query(`
      SELECT COUNT(*) as total_inactive
      FROM users u
      LEFT JOIN daily_stats ds ON u.username = ds.username
      LEFT JOIN streaks s ON u.username = s.username
      LEFT JOIN student_emails se ON u.username = se.username
      WHERE (ds.date = (SELECT MAX(date) FROM daily_stats ds2 WHERE ds2.username = u.username) OR ds.date IS NULL)
      ${batchCondition}
      AND (
        s.last_activity_date IS NULL OR 
        (CURRENT_DATE - s.last_activity_date) >= 3
      )
    `);
    results.totalInactiveStudents = parseInt(totalInactiveResult.rows[0].total_inactive) || 0;
    
    // Get recent notifications (with fallback if table doesn't exist)
    try {
      const notificationsResult = await pool.query(`
        SELECT username, message, type, created_at, is_read 
        FROM notifications 
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY created_at DESC 
        LIMIT 20
      `);
      results.notifications = notificationsResult.rows;
    } catch (notifError) {
      // Create notifications table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(255) NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      results.notifications = [];
    }
    results.dailyProgress = [];
    results.weeklyReport = [];
    
    res.json(results);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Database verification endpoint
app.get('/admin/verify-database', requireAuth, async (req, res) => {
  try {
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    const statsCount = await pool.query('SELECT COUNT(*) as count FROM daily_stats');
    const streaksCount = await pool.query('SELECT COUNT(*) as count FROM streaks');
    
    const sampleUsers = await pool.query(`
      SELECT u.username, ds.total_solved, s.current_streak 
      FROM users u 
      LEFT JOIN daily_stats ds ON u.username = ds.username 
      LEFT JOIN streaks s ON u.username = s.username 
      WHERE ds.date = CURRENT_DATE 
      ORDER BY ds.total_solved DESC 
      LIMIT 5
    `);
    
    res.json({
      success: true,
      tables: {
        users: parseInt(userCount.rows[0].count),
        daily_stats: parseInt(statsCount.rows[0].count),
        streaks: parseInt(streaksCount.rows[0].count)
      },
      sampleData: sampleUsers.rows,
      message: 'Database verification complete'
    });
  } catch (error) {
    res.status(500).json({ error: 'Database verification failed', details: error.message });
  }
});

// Get current leaderboard for admin
app.get('/admin/current-leaderboard', requireAuth, async (req, res) => {
  try {
    const { batch } = req.query;
    let batchCondition = '';
    if (batch && batch !== 'all') {
      batchCondition = `AND (se.roll_no LIKE '${batch}%' OR se.roll_no IS NULL)`;
    }
    
    const result = await pool.query(`
      SELECT 
        u.username,
        COALESCE(se.name, u.username) as name,
        COALESCE(se.roll_no, '') as roll_no,
        ds.total_solved,
        ds.easy_solved as easy,
        ds.medium_solved as medium,
        ds.hard_solved as hard,
        ds.contest_rating,
        ds.date as lastUpdated,
        COALESCE(s.current_streak, 0) as current_streak,
        COALESCE(s.longest_streak, 0) as longest_streak
      FROM users u
      LEFT JOIN daily_stats ds ON u.username = ds.username
      LEFT JOIN streaks s ON u.username = s.username
      LEFT JOIN student_emails se ON u.username = se.username
      WHERE ds.date = (SELECT MAX(date) FROM daily_stats ds2 WHERE ds2.username = u.username)
        AND ds.total_solved IS NOT NULL
        ${batchCondition}
      ORDER BY ds.total_solved DESC, s.longest_streak DESC, s.current_streak DESC
    `);
    
    const leaderboard = result.rows.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      name: user.name,
      rollNo: user.roll_no,
      totalSolved: user.total_solved || 0,
      easy: user.easy || 0,
      medium: user.medium || 0,
      hard: user.hard || 0,
      contestRanking: user.contest_rating || null,
      currentStreak: user.current_streak || 0,
      longestStreak: user.longest_streak || 0,
      lastUpdated: user.lastUpdated
    }));
    
    res.json({ leaderboard });
  } catch (error) {
    console.error('Current leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard data' });
  }
});

// Manual refresh endpoint for admin
app.post('/admin/refresh-data', requireAuth, async (req, res) => {
  try {
    console.log('Manual data refresh triggered by admin...');
    
    const usersResult = await pool.query('SELECT username FROM users');
    const users = usersResult.rows;
    
    console.log(`Refreshing data for ${users.length} users...`);
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        const userData = await fetchLeetCodeUser(user.username);
        if (userData) {
          await saveUserData(userData);
          successCount++;
        } else {
          errorCount++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to fetch data for ${user.username}:`, error);
        errorCount++;
      }
    }
    
    res.json({ 
      success: true, 
      message: `Data refreshed for ${successCount} users (${errorCount} errors)`, 
      successCount,
      errorCount 
    });
  } catch (error) {
    console.error('Manual refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search student by name, roll number, or username
app.get('/admin/search-student', requireAuth, async (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Search query required' });
  }
  
  const searchTerm = q.toLowerCase().trim();
  
  try {
    const result = await pool.query(`
      SELECT u.username, 
             COALESCE(se.name, '') as name, 
             COALESCE(se.roll_no, '') as roll_no,
             COALESCE(se.email, '') as email
      FROM users u
      LEFT JOIN student_emails se ON u.username = se.username
      WHERE LOWER(u.username) LIKE $1 
         OR (se.name IS NOT NULL AND LOWER(se.name) LIKE $1)
         OR (se.roll_no IS NOT NULL AND LOWER(se.roll_no) LIKE $1)
      ORDER BY 
        CASE 
          WHEN LOWER(u.username) = $2 THEN 1
          WHEN LOWER(se.name) = $2 THEN 2
          WHEN LOWER(se.roll_no) = $2 THEN 3
          ELSE 4
        END
      LIMIT 1
    `, [`%${searchTerm}%`, searchTerm]);
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      res.json({ 
        username: row.username, 
        name: row.name, 
        rollNo: row.roll_no,
        email: row.email
      });
    } else {
      res.json({ username: null });
    }
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Add student manually
app.post('/admin/add-student', requireAuth, async (req, res) => {
  const { username, email } = req.body;
  
  if (!username || !email) {
    return res.status(400).json({ error: 'Username and email are required' });
  }
  
  try {
    await pool.query(
      'INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO NOTHING',
      [username]
    );
    
    await pool.query(
      'INSERT INTO student_emails (username, email) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET email = EXCLUDED.email',
      [username, email]
    );
    
    res.json({ success: true, message: `Student ${username} added successfully` });
  } catch (error) {
    console.error('Add student error:', error);
    res.status(500).json({ error: 'Failed to add student' });
  }
});

// Get all students
app.get('/admin/students', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.username,
        se.email,
        se.name,
        se.roll_no,
        u.created_at,
        COALESCE(ds.total_solved, 0) as total_solved,
        COALESCE(s.current_streak, 0) as current_streak,
        COALESCE(s.longest_streak, 0) as longest_streak,
        s.last_activity_date
      FROM users u
      LEFT JOIN student_emails se ON u.username = se.username
      LEFT JOIN daily_stats ds ON u.username = ds.username
      LEFT JOIN streaks s ON u.username = s.username
      WHERE (ds.date = (SELECT MAX(date) FROM daily_stats ds2 WHERE ds2.username = u.username) OR ds.date IS NULL)
      ORDER BY u.created_at DESC
    `);
    
    res.json({ students: result.rows });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Remove student
app.delete('/admin/remove-student/:username', requireAuth, async (req, res) => {
  const { username } = req.params;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query('DELETE FROM users WHERE username = $1', [username]);
    await client.query('DELETE FROM student_emails WHERE username = $1', [username]);
    await client.query('DELETE FROM daily_stats WHERE username = $1', [username]);
    await client.query('DELETE FROM streaks WHERE username = $1', [username]);
    
    await client.query('COMMIT');
    res.json({ success: true, message: `Student ${username} removed successfully` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Remove student error:', error);
    res.status(500).json({ error: 'Failed to remove student' });
  } finally {
    client.release();
  }
});

// Send custom email
app.post('/admin/send-custom-email', requireAuth, async (req, res) => {
  const { username, email, subject, message } = req.body;
  
  if (!username || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  try {
    const result = await sendCustomEmail(email, username, subject, message);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: `Email sent to ${username}`,
        messageId: result.messageId 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('Send custom email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Delete all data endpoint
app.delete('/admin/delete-all-data', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('🚨 Admin initiated delete all data operation...');
    
    await client.query('BEGIN');
    
    // Delete all data in correct order (foreign key constraints)
    await client.query('DELETE FROM daily_stats');
    await client.query('DELETE FROM streaks');
    await client.query('DELETE FROM student_emails');
    await client.query('DELETE FROM inactive_students');
    await client.query('DELETE FROM github_activity');
    await client.query('DELETE FROM github_repos');
    await client.query('DELETE FROM github_users');
    await client.query('DELETE FROM users');
    
    await client.query('COMMIT');
    
    console.log('✅ All user data deleted successfully');
    
    res.json({ 
      success: true, 
      message: 'All user data has been permanently deleted' 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Delete all data error:', error);
    res.status(500).json({ error: 'Failed to delete all data: ' + error.message });
  } finally {
    client.release();
  }
});

// Get batches
app.get('/admin/batches', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM batches ORDER BY prefix DESC');
    res.json({ batches: result.rows });
  } catch (error) {
    console.error('Get batches error:', error);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

// Add batch
app.post('/admin/batches', requireAuth, async (req, res) => {
  const { prefix, name } = req.body;
  
  if (!prefix || !name) {
    return res.status(400).json({ error: 'Prefix and name are required' });
  }
  
  try {
    await pool.query(
      'INSERT INTO batches (prefix, name) VALUES ($1, $2)',
      [prefix, name]
    );
    
    res.json({ success: true, message: `Batch ${name} added successfully` });
  } catch (error) {
    if (error.code === '23505') {
      res.status(400).json({ error: 'Batch prefix already exists' });
    } else {
      console.error('Add batch error:', error);
      res.status(500).json({ error: 'Failed to add batch' });
    }
  }
});

// Delete batch
app.delete('/admin/batches/:prefix', requireAuth, async (req, res) => {
  const { prefix } = req.params;
  
  try {
    const result = await pool.query('DELETE FROM batches WHERE prefix = $1', [prefix]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    res.json({ success: true, message: 'Batch deleted successfully' });
  } catch (error) {
    console.error('Delete batch error:', error);
    res.status(500).json({ error: 'Failed to delete batch' });
  }
});

// Get analytics history
app.get('/api/analytics-history', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT session_id, title, total_users, avg_problems, top_performer, created_at
      FROM analytics_history
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    res.json({ analytics: result.rows });
  } catch (error) {
    console.error('Analytics history error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics history' });
  }
});

// Serve shared analytics page
app.get('/share/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  // Check if request accepts HTML (browser) or JSON (API)
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    // Serve the HTML page
    res.sendFile(path.join(__dirname, 'public', 'share.html'));
  } else {
    // Serve JSON data for API requests
    try {
      const result = await pool.query(`
        SELECT title, leaderboard_data, analytics_data, created_at
        FROM analytics_history
        WHERE session_id = $1
      `, [sessionId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Analytics session not found' });
      }
      
      const data = result.rows[0];
      res.json({
        title: data.title,
        leaderboard: data.leaderboard_data,
        analytics: data.analytics_data,
        createdAt: data.created_at
      });
    } catch (error) {
      console.error('Share analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch shared analytics' });
    }
  }
});

// User submission history endpoint using Python template
app.get('/admin/submission-history/:username', requireAuth, async (req, res) => {
  const { username } = req.params;
  
  const GRAPHQL_URL = "https://leetcode.com/graphql";
  const QUERY = `
    query userProfileCalendar($username: String!, $year: Int) {
      matchedUser(username: $username) {
        userCalendar(year: $year) {
          submissionCalendar
        }
      }
    }
  `;

  try {
    console.log(`Fetching full submission history for ${username} …`);
    
    const year = null;
    const payload = { query: QUERY, variables: { username: username, year: year } };
    const headers = { "Content-Type": "application/json", "Referer": "https://leetcode.com" };
    
    const resp = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    
    const data = await resp.json();
    
    if (!data.data?.matchedUser?.userCalendar) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const calStr = data.data.matchedUser.userCalendar.submissionCalendar;
    const calendar = JSON.parse(calStr);
    
    const norm = {};
    for (const [k, v] of Object.entries(calendar)) {
      let ts = parseInt(k);
      if (ts > 10**12) {
        ts = Math.floor(ts / 1000);
      }
      norm[ts] = parseInt(v);
    }
    
    const dailyCounts = {};
    for (const [ts, cnt] of Object.entries(norm)) {
      const dt = new Date(parseInt(ts) * 1000);
      const dateStr = dt.toISOString().split('T')[0];
      dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + cnt;
    }
    
    const sortedDaily = Object.fromEntries(
      Object.entries(dailyCounts).sort(([a], [b]) => a.localeCompare(b))
    );
    
    const totalAll = Object.values(sortedDaily).reduce((sum, count) => sum + count, 0);
    console.log(`Total submissions by ${username} (all time): ${totalAll}`);
    
    res.json({
      username,
      total: totalAll,
      submissions: sortedDaily
    });
    
  } catch (error) {
    console.error(`Error:`, error);
    res.status(500).json({ error: 'Failed to fetch submission history' });
  }
});



// Export data endpoint
app.get('/admin/export-data', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.username,
        COALESCE(ds.total_solved, 0) as total_solved,
        COALESCE(ds.easy_solved, 0) as easy,
        COALESCE(ds.medium_solved, 0) as medium,
        COALESCE(ds.hard_solved, 0) as hard,
        COALESCE(ds.contest_rating, 0) as contest_rating,
        COALESCE(s.current_streak, 0) as current_streak,
        COALESCE(s.longest_streak, 0) as longest_streak,
        s.last_activity_date,
        COALESCE(se.email, '') as email
      FROM users u
      LEFT JOIN daily_stats ds ON u.username = ds.username
      LEFT JOIN streaks s ON u.username = s.username
      LEFT JOIN student_emails se ON u.username = se.username
      WHERE ds.date = (SELECT MAX(date) FROM daily_stats ds2 WHERE ds2.username = u.username)
         OR ds.date IS NULL
      ORDER BY ds.total_solved DESC
    `);
    
    const headers = ['Username', 'Email', 'Total Solved', 'Easy', 'Medium', 'Hard', 'Contest Rating', 'Current Streak', 'Longest Streak', 'Last Activity'];
    const csvData = [headers.join(',')];
    
    result.rows.forEach(row => {
      const csvRow = [
        row.username,
        row.email || '',
        row.total_solved,
        row.easy,
        row.medium,
        row.hard,
        row.contest_rating,
        row.current_streak,
        row.longest_streak,
        row.last_activity_date || 'Never'
      ];
      csvData.push(csvRow.join(','));
    });
    
    const csvContent = csvData.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leetcode_data.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Get inactive students list
app.get('/admin/inactive-students', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.username,
        COALESCE(ds.total_solved, 0) as total_solved,
        COALESCE(s.current_streak, 0) as current_streak,
        COALESCE(s.longest_streak, 0) as longest_streak,
        s.last_activity_date,
        CASE 
          WHEN s.last_activity_date IS NULL THEN 999
          ELSE (CURRENT_DATE - s.last_activity_date)
        END as days_inactive
      FROM users u
      LEFT JOIN daily_stats ds ON u.username = ds.username
      LEFT JOIN streaks s ON u.username = s.username
      WHERE (ds.date = (SELECT MAX(date) FROM daily_stats ds2 WHERE ds2.username = u.username) OR ds.date IS NULL)
      AND (
        s.last_activity_date IS NULL OR 
        (CURRENT_DATE - s.last_activity_date) >= 3
      )
      ORDER BY days_inactive DESC
    `);
    
    res.json({ inactiveStudents: result.rows });
  } catch (error) {
    console.error('Inactive students error:', error);
    res.status(500).json({ error: 'Failed to fetch inactive students' });
  }
});

// Get user performance history
app.get('/admin/user/:username', requireAuth, async (req, res) => {
  const { username } = req.params;
  
  try {
    const userInfo = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const dailyStats = await pool.query(
      'SELECT * FROM daily_stats WHERE username = $1 ORDER BY date DESC LIMIT 365',
      [username]
    );
    const streakInfo = await pool.query('SELECT * FROM streaks WHERE username = $1', [username]);
    
    res.json({
      userInfo: userInfo.rows,
      dailyStats: dailyStats.rows,
      streakInfo: streakInfo.rows,
      notifications: [],
      weeklyProgress: [],
      monthlyTrends: []
    });
  } catch (error) {
    console.error('User history error:', error);
    res.status(500).json({ error: 'Failed to fetch user history' });
  }
});

// Leaderboard endpoint
app.post('/leaderboard', async (req, res) => {
  try {
    const { usernames } = req.body;
    
    if (!usernames || !Array.isArray(usernames)) {
      return res.status(400).json({ error: 'Invalid usernames array' });
    }

    const promises = usernames.map(username => fetchLeetCodeUser(username.trim()));
    const results = await Promise.all(promises);
    
    const validUsers = results.filter(user => user !== null);
    console.log(`📊 Processing ${validUsers.length} valid users...`);
    
    // Save user data and create achievement notifications
    for (const user of validUsers) {
      await saveUserData(user);
      
      // Create milestone notifications
      const milestones = [50, 100, 200, 300, 500, 1000];
      for (const milestone of milestones) {
        if (user.totalSolved >= milestone) {
          try {
            await pool.query(`
              INSERT INTO notifications (username, message, type, created_at) 
              VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
              ON CONFLICT DO NOTHING
            `, [
              user.username,
              `🎉 Milestone achieved! ${user.username} solved ${milestone} problems!`,
              'milestone'
            ]);
          } catch (notifError) {
            // Ignore duplicate notifications
          }
        }
      }
    }

    // Get leaderboard data from database
    const userList = validUsers.map(u => u.username);
    const dbResult = await pool.query(`
      SELECT 
        u.username,
        ds.total_solved,
        ds.easy_solved as easy,
        ds.medium_solved as medium,
        ds.hard_solved as hard,
        ds.contest_rating,
        ds.last_submission_date,
        COALESCE(s.current_streak, 0) as current_streak,
        COALESCE(s.longest_streak, 0) as longest_streak
      FROM users u
      LEFT JOIN daily_stats ds ON u.username = ds.username
      LEFT JOIN streaks s ON u.username = s.username
      WHERE u.username = ANY($1)
      AND ds.date = (
        SELECT MAX(date) 
        FROM daily_stats ds2 
        WHERE ds2.username = u.username
      )
      ORDER BY ds.total_solved DESC, s.longest_streak DESC, s.current_streak DESC
    `, [userList]);

    const leaderboard = dbResult.rows.map((user, index) => {
      const originalUser = validUsers.find(u => u.username === user.username);
      
      return {
        rank: index + 1,
        username: user.username,
        avatar: originalUser?.avatar || 'https://via.placeholder.com/50',
        totalSolved: user.total_solved || 0,
        easy: user.easy || 0,
        medium: user.medium || 0,
        hard: user.hard || 0,
        contestRanking: user.contest_rating || 0,
        currentStreak: user.current_streak || 0,
        longestStreak: user.longest_streak || 0,
        lastSubmissionDate: user.last_submission_date && user.last_submission_date !== '1970-01-01' ? 
          user.last_submission_date : 'No recent activity'
      };
    });

    const analytics = calculateAnalytics(leaderboard);
    
    // Save analytics to history
    try {
      const sessionId = `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const title = `Analytics - ${leaderboard.length} users`;
      const topPerformer = leaderboard.length > 0 ? leaderboard[0].username : 'N/A';
      
      await pool.query(`
        INSERT INTO analytics_history (session_id, title, total_users, avg_problems, top_performer, leaderboard_data, analytics_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        sessionId,
        title,
        leaderboard.length,
        analytics?.averageProblems || 0,
        topPerformer,
        JSON.stringify(leaderboard),
        JSON.stringify(analytics)
      ]);
      
      console.log(`💾 Saved analytics session: ${sessionId}`);
    } catch (saveError) {
      console.error('Failed to save analytics:', saveError);
    }
    
    console.log(`✅ Sending leaderboard with ${leaderboard.length} users to frontend`);
    
    res.json({ leaderboard, analytics });
    
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Calculate analytics
function calculateAnalytics(leaderboard) {
  if (leaderboard.length === 0) return null;

  const totalUsers = leaderboard.length;
  const totalProblems = leaderboard.reduce((sum, user) => sum + user.totalSolved, 0);
  const totalContestRating = leaderboard.reduce((sum, user) => sum + (user.contestRanking || 0), 0);
  
  const difficultyStats = {
    easy: leaderboard.reduce((sum, user) => sum + user.easy, 0),
    medium: leaderboard.reduce((sum, user) => sum + user.medium, 0),
    hard: leaderboard.reduce((sum, user) => sum + user.hard, 0)
  };

  const ratingRanges = {
    'Unrated': leaderboard.filter(u => !u.contestRanking || u.contestRanking === 0).length,
    'Guardian (0-1399)': leaderboard.filter(u => u.contestRanking > 0 && u.contestRanking < 1400).length,
    'Knight (1400-1599)': leaderboard.filter(u => u.contestRanking >= 1400 && u.contestRanking < 1600).length,
    'Guardian+ (1600+)': leaderboard.filter(u => u.contestRanking >= 1600).length
  };

  return {
    totalUsers,
    averageProblems: Math.round(totalProblems / totalUsers),
    averageRating: Math.round(totalContestRating / totalUsers),
    difficultyStats,
    ratingDistribution: ratingRanges,
    topPerformers: leaderboard.slice(0, 3)
  };
}

// Public leaderboard endpoint
app.get('/api/public-leaderboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.username,
        COALESCE(ds.total_solved, 0) as total_solved,
        COALESCE(ds.easy_solved, 0) as easy,
        COALESCE(ds.medium_solved, 0) as medium,
        COALESCE(ds.hard_solved, 0) as hard,
        COALESCE(ds.contest_rating, 0) as contest_rating,
        COALESCE(s.current_streak, 0) as current_streak,
        COALESCE(s.longest_streak, 0) as longest_streak
      FROM users u
      LEFT JOIN daily_stats ds ON u.username = ds.username 
        AND ds.date = (SELECT MAX(date) FROM daily_stats ds2 WHERE ds2.username = u.username)
      LEFT JOIN streaks s ON u.username = s.username
      ORDER BY COALESCE(ds.total_solved, 0) DESC
    `);
    
    const leaderboard = result.rows.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      avatar: 'https://via.placeholder.com/50',
      totalSolved: user.total_solved,
      easy: user.easy,
      medium: user.medium,
      hard: user.hard,
      contestRanking: user.contest_rating || null,
      currentStreak: user.current_streak,
      longestStreak: user.longest_streak
    }));
    
    res.json({ leaderboard });
  } catch (error) {
    console.error('Public leaderboard error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// CSV Upload endpoint for admin - using exact same logic as index.html
app.post('/admin/upload-students-csv', requireAuth, upload.single('csvFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file uploaded' });
  }

  const csvFilePath = req.file.path;
  
  try {
    const csvData = fs.readFileSync(csvFilePath, 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    
    let processed = 0;
    let duplicates = 0;
    let invalid = 0;
    const seen = new Set();
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.split(',');
      if (parts.length !== 3) {
        invalid++;
        continue;
      }

      const name = parts[0].trim();
      const rollNumber = parts[1].trim();
      const url = parts[2].trim();

      // Check for duplicates
      if (seen.has(rollNumber)) {
        duplicates++;
        continue;
      }

      // Validate LeetCode URL
      if (!url.includes('leetcode.com')) {
        invalid++;
        continue;
      }

      // Extract username - exact same logic as index.html
      let username = '';
      if (url.includes('/u/')) {
        username = url.split('/u/')[1].replace('/', '');
      } else {
        const urlParts = url.split('/');
        username = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
      }
      
      if (!username || !name || !rollNumber) {
        invalid++;
        continue;
      }
      
      try {
        // Insert user
        await pool.query(
          'INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO NOTHING',
          [username]
        );
        
        // Insert/update student details with name and roll number
        await pool.query(`
          INSERT INTO student_emails (username, email, name, roll_no, updated_at) 
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
          ON CONFLICT (username) 
          DO UPDATE SET 
            email = COALESCE(EXCLUDED.email, student_emails.email, $2),
            name = EXCLUDED.name,
            roll_no = EXCLUDED.roll_no,
            updated_at = CURRENT_TIMESTAMP
        `, [username, `${username}@gmail.com`, name, rollNumber]);
        
        seen.add(rollNumber);
        processed++;
        console.log(`✅ Added: ${name} (${rollNumber}) -> ${username}`);
      } catch (error) {
        console.error(`❌ Error processing ${username}:`, error);
        invalid++;
      }
    }
    
    fs.unlinkSync(csvFilePath);
    res.json({
      success: true,
      processed,
      duplicates,
      invalid,
      message: `Processed ${processed} students. ${duplicates} duplicates and ${invalid} invalid entries removed.`
    });
    
  } catch (error) {
    if (fs.existsSync(csvFilePath)) {
      fs.unlinkSync(csvFilePath);
    }
    console.error('CSV processing error:', error);
    res.status(500).json({ error: 'Failed to process CSV file: ' + error.message });
  }
});

// CSV upload for public site with name/roll extraction
app.post('/api/upload-csv', upload.single('csvFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const csvFilePath = req.file.path;
  const students = [];
  const usernames = [];

  try {
    const csvData = fs.readFileSync(csvFilePath, 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      fs.unlinkSync(csvFilePath);
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    lines.forEach((line, index) => {
      if (index === 0) return; // Skip header
      
      const values = line.includes('\t') ? line.split('\t') : line.split(',');
      const cleanValues = values.map(v => v.trim().replace(/["/]/g, ''));
      
      let name = '', rollNo = '', username = '', email = '';
      
      // Parse different CSV formats
      if (cleanValues.length >= 3) {
        // Format: Name, Roll, LeetCode URL/Username
        name = cleanValues[0];
        rollNo = cleanValues[1];
        const leetcodeField = cleanValues[2];
        
        if (leetcodeField && leetcodeField.includes('leetcode.com')) {
          const match = leetcodeField.match(/leetcode\.com\/u?\/([a-zA-Z0-9_-]+)/);
          username = match ? match[1] : '';
        } else {
          username = leetcodeField;
        }
        
        email = cleanValues[3] || `${username}@gmail.com`;
      } else {
        // Single username format
        username = cleanValues[0];
        email = `${username}@gmail.com`;
      }
      
      if (username && username.length > 2) {
        students.push({ name, rollNo, username, email });
        usernames.push(username);
      }
    });

    // Save to database
    let savedCount = 0;
    for (const student of students) {
      try {
        // Insert user
        await pool.query('INSERT INTO users (username, email) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING', 
          [student.username, student.email]);
        
        // Insert student details
        await pool.query(`INSERT INTO student_emails (username, email, name, roll_no, updated_at) 
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
          ON CONFLICT (username) DO UPDATE SET 
          email = $2, name = $3, roll_no = $4, updated_at = CURRENT_TIMESTAMP`,
          [student.username, student.email, student.name, student.rollNo]);
        
        savedCount++;
      } catch (dbError) {
        console.error(`Error saving ${student.username}:`, dbError);
      }
    }

    fs.unlinkSync(csvFilePath);

    res.json({ 
      success: true, 
      usernames,
      count: usernames.length,
      savedCount,
      message: `Extracted ${usernames.length} users, saved ${savedCount} with details to database`
    });
  } catch (error) {
    if (fs.existsSync(csvFilePath)) {
      fs.unlinkSync(csvFilePath);
    }
    res.status(500).json({ error: 'Failed to process CSV file' });
  }
});

// Send email from student to instructor
app.post('/api/send-student-email', async (req, res) => {
  const { username, studentEmail, subject, message } = req.body;
  
  if (!username || !studentEmail || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  try {
    const instructorEmail = 'sanatanisofindia@gmail.com';
    const fullSubject = `[LeetCode Student] ${subject} - From ${username}`;
    const fullMessage = `Student: ${username}\nStudent Email: ${studentEmail}\n\nMessage:\n${message}\n\n---\nSent from LeetCode Analytics Pro Student Dashboard`;
    
    const result = await sendCustomEmail(instructorEmail, 'Instructor', fullSubject, fullMessage);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Email sent to instructor successfully',
        messageId: result.messageId 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('Send student email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Student data endpoint
app.get('/api/student/:username', async (req, res) => {
  const { username } = req.params;
  
  try {
    const userData = await fetchLeetCodeUser(username);
    
    if (!userData) {
      return res.status(404).json({ error: 'Student not found on LeetCode' });
    }

    const result = {
      username: userData.username,
      totalSolved: userData.totalSolved,
      easy: userData.easy,
      medium: userData.medium,
      hard: userData.hard,
      contestRanking: userData.contestRanking || 0,
      currentStreak: userData.currentStreak,
      longestStreak: userData.longestStreak,
      last_activity_date: userData.lastSubmissionDate || 'No recent activity',
      lastUpdated: new Date().toISOString()
    };
    
    res.json(result);
    
  } catch (error) {
    console.error(`Error fetching student data for ${username}:`, error);
    res.status(500).json({ error: 'Failed to fetch student data' });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wsServer = new WebSocketServer(server);

// Initialize task scheduler
const scheduler = new TaskScheduler(wsServer);

// Automatic data refresh every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('🔄 Running 6-hourly data refresh...');
  
  try {
    const usersResult = await pool.query('SELECT username FROM users');
    const users = usersResult.rows;
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        const userData = await fetchLeetCodeUser(user.username);
        if (userData) {
          await saveUserData(userData);
          successCount++;
        } else {
          errorCount++;
          // Mark user as inactive if no data found
          await pool.query(`
            INSERT INTO streaks (username, current_streak, longest_streak, last_activity_date) 
            VALUES ($1, 0, 0, NULL) 
            ON CONFLICT (username) DO UPDATE SET 
            current_streak = 0, 
            last_activity_date = NULL
          `, [user.username]);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed refresh for ${user.username}:`, error);
        errorCount++;
      }
    }
    
    // After refresh, detect and notify inactive students
    await detectAndNotifyInactiveStudents();
    
    console.log(`✅ 6-hourly refresh completed: ${successCount} success, ${errorCount} errors`);
  } catch (error) {
    console.error('6-hourly refresh error:', error);
  }
});

// Function to detect and notify inactive students
async function detectAndNotifyInactiveStudents() {
  console.log('🔍 Running inactive student detection...');
  
  try {
    const result = await pool.query(`
      SELECT 
        u.username,
        COALESCE(se.name, u.username) as name,
        COALESCE(se.email, u.username || '@gmail.com') as email,
        COALESCE(ds.total_solved, 0) as total_solved,
        s.last_activity_date,
        CASE 
          WHEN s.last_activity_date IS NULL THEN 999
          ELSE (CURRENT_DATE - s.last_activity_date)
        END as days_inactive
      FROM users u
      LEFT JOIN student_emails se ON u.username = se.username
      LEFT JOIN daily_stats ds ON u.username = ds.username 
        AND ds.date = (SELECT MAX(date) FROM daily_stats ds2 WHERE ds2.username = u.username)
      LEFT JOIN streaks s ON u.username = s.username
      WHERE (
        s.last_activity_date IS NULL OR 
        (CURRENT_DATE - s.last_activity_date) >= 3
      )
    `);
    
    console.log(`📊 Found ${result.rows.length} inactive students (3+ days)`);
    
    // Create notifications for inactive students
    for (const student of result.rows) {
      try {
        const daysText = student.days_inactive === 999 ? 'never been active' : `${student.days_inactive} days`;
        
        // Check if notification already exists for this user today
        const existingNotif = await pool.query(`
          SELECT id FROM notifications 
          WHERE username = $1 AND type = 'inactive_warning' 
          AND DATE(created_at) = CURRENT_DATE
        `, [student.username]);
        
        if (existingNotif.rows.length === 0) {
          await pool.query(`
            INSERT INTO notifications (username, message, type, created_at) 
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          `, [
            student.username,
            `⚠️ ${student.name} has been inactive for ${daysText}. Total solved: ${student.total_solved}`,
            'inactive_warning'
          ]);
          
          console.log(`🔔 Created notification for inactive user: ${student.username}`);
        }
      } catch (notifError) {
        console.error(`Error creating notification for ${student.username}:`, notifError);
      }
    }
    
    return result.rows.length;
    
  } catch (error) {
    console.error('Inactive detection error:', error);
    return 0;
  }
}

// Daily inactive student detection at 6 AM
cron.schedule('0 6 * * *', async () => {
  const inactiveCount = await detectAndNotifyInactiveStudents();
  console.log(`📅 Daily check completed: ${inactiveCount} inactive students found`);
});

// Manual inactive detection endpoint
app.post('/admin/detect-inactive', requireAuth, async (req, res) => {
  try {
    const count = await detectAndNotifyInactiveStudents();
    res.json({ 
      success: true, 
      count,
      message: `Detected ${count} inactive students and created notifications`
    });
  } catch (error) {
    console.error('Manual inactive detection error:', error);
    res.status(500).json({ error: 'Failed to detect inactive students' });
  }
});

// Visitor analytics endpoint
app.get('/admin/visitor-analytics', requireAuth, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    const analytics = await getVisitorAnalytics(timeframe);
    
    if (analytics) {
      res.json(analytics);
    } else {
      res.status(500).json({ error: 'Failed to fetch visitor analytics' });
    }
  } catch (error) {
    console.error('Visitor analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch visitor analytics' });
  }
});

// Live visitor tracking endpoint
app.get('/admin/live-visitors', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ip_address, country, city, browser, os, device, url, timestamp
      FROM visitor_logs 
      WHERE timestamp >= NOW() - INTERVAL '5 minutes'
      ORDER BY timestamp DESC
    `);
    
    res.json({ visitors: result.rows });
  } catch (error) {
    console.error('Live visitors error:', error);
    res.status(500).json({ error: 'Failed to fetch live visitors' });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 LeetCode Analytics Pro Server running at http://localhost:${PORT}`);
  console.log('📊 Admin Dashboard: http://localhost:3000/admin.html');
  console.log('👤 User Dashboard: http://localhost:3000/user-dashboard.html?username=<username>');
  console.log('🔌 WebSocket server active for real-time updates');
  console.log('📅 Task scheduler initialized');
  console.log('🔐 Admin credentials: Set in .env file (ADMIN_USERNAME/ADMIN_PASSWORD)');
  console.log('⏰ Automatic data refresh: Every 6 hours');
  console.log('🔍 Inactive detection: Daily at 6 AM + after refresh');
  console.log('👁️ Visitor tracking: Active and logging all access');
});