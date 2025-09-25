// Fix for Student Performance Tracker Issues
// This script addresses the main problems causing wrong output

const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');

const db = new sqlite3.Database('./leetcode_tracker.db');

// Enhanced GraphQL query with better error handling
const ENHANCED_LEETCODE_QUERY = `
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

// Fixed LeetCode data fetching with proper validation
async function fetchAccurateLeetCodeData(username) {
  try {
    console.log(`🔍 Fetching ACCURATE data for ${username}...`);
    
    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://leetcode.com',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: ENHANCED_LEETCODE_QUERY,
        variables: { username }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }
    
    if (!data.data?.matchedUser) {
      throw new Error(`User ${username} not found on LeetCode`);
    }

    const user = data.data.matchedUser;
    const stats = user.submitStatsGlobal?.acSubmissionNum || [];
    
    // Validate and extract problem counts
    const easy = Math.max(0, stats.find(s => s.difficulty === 'Easy')?.count || 0);
    const medium = Math.max(0, stats.find(s => s.difficulty === 'Medium')?.count || 0);
    const hard = Math.max(0, stats.find(s => s.difficulty === 'Hard')?.count || 0);
    const total = easy + medium + hard;

    // Validate calendar data
    const calendar = user.userCalendar || {};
    const currentStreak = Math.max(0, calendar.streak || 0);
    const totalActiveDays = Math.max(0, calendar.totalActiveDays || 0);
    const submissionCalendar = calendar.submissionCalendar || {};
    
    // Calculate accurate longest streak
    const longestStreak = calculateAccurateLongestStreak(submissionCalendar, currentStreak);
    
    // Get accurate last submission date
    const lastSubmissionDate = getAccurateLastSubmissionDate(submissionCalendar);
    
    // Validate contest ranking
    const contestRanking = Math.max(0, user.profile?.ranking || 0);
    
    console.log(`✅ ACCURATE data for ${username}:`);
    console.log(`   📊 Problems: ${total} (${easy}E + ${medium}M + ${hard}H)`);
    console.log(`   🔥 Streaks: Current=${currentStreak}, Longest=${longestStreak}`);
    console.log(`   🏆 Contest: ${contestRanking}`);
    console.log(`   📅 Last: ${lastSubmissionDate || 'No recent activity'}`);

    return {
      username: user.username,
      avatar: user.profile?.userAvatar || 'https://via.placeholder.com/50',
      contestRanking,
      totalSolved: total,
      easy,
      medium,
      hard,
      currentStreak,
      longestStreak,
      totalActiveDays,
      lastSubmissionDate,
      submissionCalendar,
      isValid: true,
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`❌ Failed to fetch data for ${username}:`, error.message);
    return null;
  }
}

// Calculate accurate longest streak from submission calendar
function calculateAccurateLongestStreak(submissionCalendar, currentStreak) {
  if (!submissionCalendar || Object.keys(submissionCalendar).length === 0) {
    return Math.max(0, currentStreak);
  }

  const timestamps = Object.keys(submissionCalendar)
    .filter(ts => parseInt(submissionCalendar[ts]) > 0)
    .map(ts => parseInt(ts))
    .sort((a, b) => a - b);

  if (timestamps.length === 0) return Math.max(0, currentStreak);

  let maxStreak = 1;
  let currentCalculatedStreak = 1;

  for (let i = 1; i < timestamps.length; i++) {
    const prevDate = new Date(timestamps[i - 1] * 1000);
    const currDate = new Date(timestamps[i] * 1000);
    
    prevDate.setHours(0, 0, 0, 0);
    currDate.setHours(0, 0, 0, 0);
    
    const dayDiff = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 1) {
      currentCalculatedStreak++;
      maxStreak = Math.max(maxStreak, currentCalculatedStreak);
    } else {
      currentCalculatedStreak = 1;
    }
  }

  // Return the maximum of calculated streak and current streak from API
  return Math.max(maxStreak, currentStreak);
}

// Get accurate last submission date
function getAccurateLastSubmissionDate(submissionCalendar) {
  if (!submissionCalendar || Object.keys(submissionCalendar).length === 0) {
    return null;
  }
  
  const timestamps = Object.keys(submissionCalendar)
    .filter(ts => parseInt(submissionCalendar[ts]) > 0)
    .map(ts => parseInt(ts));
  
  if (timestamps.length === 0) return null;
  
  const lastTimestamp = Math.max(...timestamps);
  const date = new Date(lastTimestamp * 1000);
  
  // Validate date (should be after 2020 and not in future)
  const now = new Date();
  const year2020 = new Date('2020-01-01');
  
  if (date >= year2020 && date <= now) {
    return date.toISOString().split('T')[0];
  }
  
  return null;
}

// Save accurate user data with validation
function saveAccurateUserData(userData) {
  console.log(`🔍 DEBUG saveAccurateUserData - received:`, {
    hasUserData: !!userData,
    username: userData?.username,
    isValid: userData?.isValid,
    totalSolved: userData?.totalSolved
  });
  
  if (!userData || !userData.isValid) {
    console.log(`❌ Invalid data for ${userData?.username || 'unknown'}, skipping save`);
    console.log(`🔍 Validation failed - userData exists: ${!!userData}, isValid: ${userData?.isValid}`);
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  
  console.log(`💾 Saving ACCURATE data for ${userData.username}...`);
  
  // Insert or update user
  db.run('INSERT OR IGNORE INTO users (username) VALUES (?)', [userData.username], (err) => {
    if (err) {
      console.error(`❌ Error inserting user ${userData.username}:`, err);
      return;
    }
    
    // Save daily stats with validation
    db.run(`INSERT OR REPLACE INTO daily_stats 
      (username, date, total_solved, easy_solved, medium_solved, hard_solved, contest_rating, global_rank, last_submission_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userData.username, 
        today, 
        userData.totalSolved, 
        userData.easy, 
        userData.medium, 
        userData.hard, 
        userData.contestRanking, 
        0, // global_rank not used
        userData.lastSubmissionDate
      ], (statsErr) => {
        if (statsErr) {
          console.error(`❌ Error saving daily stats for ${userData.username}:`, statsErr);
        } else {
          console.log(`✅ Daily stats saved for ${userData.username}: ${userData.totalSolved} problems`);
        }
      });
    
    // Save streak data with validation
    db.run(`INSERT OR REPLACE INTO streaks 
      (username, current_streak, longest_streak, last_activity_date, updated_at) 
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        userData.username, 
        userData.currentStreak, 
        userData.longestStreak, 
        userData.lastSubmissionDate || today
      ], (streakErr) => {
        if (streakErr) {
          console.error(`❌ Error saving streak for ${userData.username}:`, streakErr);
        } else {
          console.log(`✅ Streak saved for ${userData.username}: Current=${userData.currentStreak}, Longest=${userData.longestStreak}`);
        }
      });
  });
}

// Fix all user data with comprehensive validation
async function fixAllUserData() {
  console.log('🚀 Starting comprehensive fix for all user data...');
  
  return new Promise((resolve) => {
    db.all('SELECT DISTINCT username FROM users ORDER BY username', async (err, users) => {
      if (err) {
        console.error('❌ Error fetching users:', err);
        resolve({ success: false, error: err.message });
        return;
      }
      
      console.log(`📊 Found ${users.length} users to fix`);
      
      let successCount = 0;
      let errorCount = 0;
      const results = [];
      
      for (const user of users) {
        try {
          console.log(`\n🔄 Processing ${user.username}...`);
          
          const userData = await fetchAccurateLeetCodeData(user.username);
          
          if (userData && userData.isValid) {
            saveAccurateUserData(userData);
            successCount++;
            results.push({
              username: user.username,
              status: 'success',
              data: {
                totalSolved: userData.totalSolved,
                currentStreak: userData.currentStreak,
                longestStreak: userData.longestStreak,
                contestRanking: userData.contestRanking
              }
            });
            console.log(`✅ Fixed ${user.username}`);
          } else {
            errorCount++;
            results.push({
              username: user.username,
              status: 'error',
              error: 'Failed to fetch valid data'
            });
            console.log(`❌ Failed to fix ${user.username}`);
          }
          
          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 1500));
          
        } catch (error) {
          console.error(`❌ Error processing ${user.username}:`, error);
          errorCount++;
          results.push({
            username: user.username,
            status: 'error',
            error: error.message
          });
        }
      }
      
      console.log(`\n📈 Fix completed: ${successCount} success, ${errorCount} errors`);
      
      resolve({
        success: true,
        successCount,
        errorCount,
        results,
        message: `Fixed ${successCount} users successfully, ${errorCount} errors`
      });
    });
  });
}

// Fix specific user data
async function fixSpecificUserData(username) {
  console.log(`🔧 Fixing data for specific user: ${username}`);
  
  try {
    const userData = await fetchAccurateLeetCodeData(username);
    
    if (userData && userData.isValid) {
      saveAccurateUserData(userData);
      console.log(`✅ Successfully fixed ${username}`);
      return {
        success: true,
        username,
        data: {
          totalSolved: userData.totalSolved,
          currentStreak: userData.currentStreak,
          longestStreak: userData.longestStreak,
          contestRanking: userData.contestRanking,
          lastSubmissionDate: userData.lastSubmissionDate
        }
      };
    } else {
      console.log(`❌ Failed to fix ${username} - invalid data`);
      return {
        success: false,
        username,
        error: 'Failed to fetch valid data from LeetCode'
      };
    }
  } catch (error) {
    console.error(`❌ Error fixing ${username}:`, error);
    return {
      success: false,
      username,
      error: error.message
    };
  }
}

// Validate database consistency
function validateDatabaseConsistency() {
  console.log('🔍 Validating database consistency...');
  
  return new Promise((resolve) => {
    db.all(`
      SELECT 
        u.username,
        ds.total_solved,
        ds.easy_solved,
        ds.medium_solved,
        ds.hard_solved,
        s.current_streak,
        s.longest_streak,
        ds.last_submission_date
      FROM users u
      LEFT JOIN daily_stats ds ON u.username = ds.username
      LEFT JOIN streaks s ON u.username = s.username
      WHERE ds.date = (SELECT MAX(date) FROM daily_stats ds2 WHERE ds2.username = u.username)
    `, (err, rows) => {
      if (err) {
        console.error('❌ Database validation error:', err);
        resolve({ valid: false, error: err.message });
        return;
      }
      
      const issues = [];
      let validCount = 0;
      
      rows.forEach(row => {
        const problems = [];
        
        // Check for negative values
        if (row.total_solved < 0) problems.push('negative total_solved');
        if (row.easy_solved < 0) problems.push('negative easy_solved');
        if (row.medium_solved < 0) problems.push('negative medium_solved');
        if (row.hard_solved < 0) problems.push('negative hard_solved');
        if (row.current_streak < 0) problems.push('negative current_streak');
        if (row.longest_streak < 0) problems.push('negative longest_streak');
        
        // Check for inconsistent totals
        const calculatedTotal = (row.easy_solved || 0) + (row.medium_solved || 0) + (row.hard_solved || 0);
        if (Math.abs(calculatedTotal - (row.total_solved || 0)) > 0) {
          problems.push(`total mismatch: ${row.total_solved} vs ${calculatedTotal}`);
        }
        
        // Check for impossible streak values
        if (row.current_streak > row.longest_streak && row.longest_streak > 0) {
          problems.push('current_streak > longest_streak');
        }
        
        // Check for invalid dates
        if (row.last_submission_date === '1970-01-01') {
          problems.push('invalid last_submission_date');
        }
        
        if (problems.length > 0) {
          issues.push({
            username: row.username,
            problems
          });
        } else {
          validCount++;
        }
      });
      
      console.log(`📊 Validation complete: ${validCount} valid, ${issues.length} with issues`);
      
      if (issues.length > 0) {
        console.log('⚠️ Issues found:');
        issues.forEach(issue => {
          console.log(`  ${issue.username}: ${issue.problems.join(', ')}`);
        });
      }
      
      resolve({
        valid: issues.length === 0,
        validCount,
        issueCount: issues.length,
        issues
      });
    });
  });
}

// Export functions for use in server
module.exports = {
  fixAllUserData,
  fixSpecificUserData,
  validateDatabaseConsistency,
  fetchAccurateLeetCodeData,
  saveAccurateUserData
};

// Run fix if called directly
if (require.main === module) {
  console.log('🚀 Running performance tracker fix...');
  
  fixAllUserData().then(result => {
    console.log('\n📋 Final Result:', result);
    
    // Validate after fix
    validateDatabaseConsistency().then(validation => {
      console.log('\n🔍 Validation Result:', validation);
      process.exit(0);
    });
  }).catch(error => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });
}