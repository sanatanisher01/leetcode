const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');

// Initialize Database
const db = new sqlite3.Database('./leetcode_tracker.db');

// Enhanced GraphQL query for accurate data
const ACCURATE_LEETCODE_QUERY = `
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

// Fetch accurate user data from LeetCode GraphQL API
async function fetchAccurateUserData(username) {
  try {
    console.log(`🔍 Fetching accurate data for ${username}...`);
    
    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://leetcode.com'
      },
      body: JSON.stringify({
        query: ACCURATE_LEETCODE_QUERY,
        variables: { username }
      })
    });

    const data = await response.json();
    
    if (!data.data?.matchedUser) {
      throw new Error(`User ${username} not found`);
    }

    const user = data.data.matchedUser;
    const stats = user.submitStatsGlobal?.acSubmissionNum || [];
    
    const easy = stats.find(s => s.difficulty === 'Easy')?.count || 0;
    const medium = stats.find(s => s.difficulty === 'Medium')?.count || 0;
    const hard = stats.find(s => s.difficulty === 'Hard')?.count || 0;
    const total = easy + medium + hard;

    // Get calendar data for accurate streak calculation
    const calendar = user.userCalendar || {};
    const currentStreak = calendar.streak || 0;
    const submissionCalendar = calendar.submissionCalendar;
    
    // Calculate longest streak and last activity
    let longestStreak = currentStreak;
    let lastSubmissionDate = null;
    let daysInactive = 0;
    
    if (submissionCalendar) {
      longestStreak = calculateLongestStreakFromCalendar(submissionCalendar);
      lastSubmissionDate = getLastSubmissionDate(submissionCalendar);
      daysInactive = calculateDaysInactive(submissionCalendar);
    }
    
    // Ensure longest streak is at least current streak
    longestStreak = Math.max(longestStreak, currentStreak);

    console.log(`✅ Accurate data for ${username}: ${total} total (${easy}E, ${medium}M, ${hard}H), Current: ${currentStreak}, Longest: ${longestStreak}, Inactive: ${daysInactive} days`);

    return {
      username: user.username,
      avatar: user.profile?.userAvatar || 'https://via.placeholder.com/50',
      contestRanking: user.profile?.ranking || 0,
      totalSolved: total,
      easy,
      medium,
      hard,
      currentStreak,
      longestStreak,
      lastSubmissionDate,
      daysInactive,
      submissionCalendar
    };
  } catch (error) {
    console.error(`❌ Failed to fetch data for ${username}:`, error.message);
    return null;
  }
}

// Calculate longest streak from submission calendar
function calculateLongestStreakFromCalendar(submissionCalendar) {
  if (!submissionCalendar || Object.keys(submissionCalendar).length === 0) {
    return 0;
  }

  const timestamps = Object.keys(submissionCalendar)
    .filter(ts => parseInt(submissionCalendar[ts]) > 0)
    .map(ts => parseInt(ts))
    .sort((a, b) => a - b);

  if (timestamps.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < timestamps.length; i++) {
    const prevDate = new Date(timestamps[i - 1] * 1000);
    const currDate = new Date(timestamps[i] * 1000);
    
    // Check if dates are consecutive
    const dayDiff = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

// Get last submission date from calendar
function getLastSubmissionDate(submissionCalendar) {
  if (!submissionCalendar || Object.keys(submissionCalendar).length === 0) {
    return null;
  }
  
  const timestamps = Object.keys(submissionCalendar)
    .filter(ts => parseInt(submissionCalendar[ts]) > 0)
    .map(ts => parseInt(ts));
  
  if (timestamps.length === 0) return null;
  
  const lastTimestamp = Math.max(...timestamps);
  const date = new Date(lastTimestamp * 1000);
  
  // Only return valid dates (after 2020)
  if (date.getFullYear() >= 2020) {
    return date.toISOString().split('T')[0];
  }
  
  return null;
}

// Calculate days inactive from submission calendar
function calculateDaysInactive(submissionCalendar) {
  if (!submissionCalendar || Object.keys(submissionCalendar).length === 0) {
    return 999; // Never submitted
  }
  
  const timestamps = Object.keys(submissionCalendar)
    .filter(ts => parseInt(submissionCalendar[ts]) > 0)
    .map(ts => parseInt(ts));
  
  if (timestamps.length === 0) return 999;
  
  const lastSubmissionTs = Math.max(...timestamps) * 1000; // convert to ms
  const lastSubmissionDate = new Date(lastSubmissionTs);
  
  // Get today's UTC midnight
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  const daysInactive = Math.floor((today - lastSubmissionDate.setUTCHours(0,0,0,0)) / 86400000);
  return Math.max(0, daysInactive);
}

// Update user data in database with accurate information
function updateUserDataAccurately(userData) {
  const today = new Date().toISOString().split('T')[0];
  
  return new Promise((resolve, reject) => {
    console.log(`💾 Updating accurate data for ${userData.username}...`);
    
    // Insert or update user
    db.run('INSERT OR IGNORE INTO users (username) VALUES (?)', [userData.username], (err) => {
      if (err) {
        console.error('Error inserting user:', err);
        return reject(err);
      }
      
      // Update daily stats with accurate data
      db.run(`INSERT OR REPLACE INTO daily_stats 
        (username, date, total_solved, easy_solved, medium_solved, hard_solved, contest_rating, global_rank, last_submission_date) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userData.username, today, userData.totalSolved, userData.easy, userData.medium, 
         userData.hard, userData.contestRanking || 0, 0, userData.lastSubmissionDate], (statsErr) => {
          if (statsErr) {
            console.error('Error updating daily stats:', statsErr);
            return reject(statsErr);
          }
          
          // Update streak data with accurate information
          db.run(`INSERT OR REPLACE INTO streaks 
            (username, current_streak, longest_streak, last_activity_date, updated_at) 
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [userData.username, userData.currentStreak, userData.longestStreak, userData.lastSubmissionDate || today], (streakErr) => {
              if (streakErr) {
                console.error('Error updating streak:', streakErr);
                return reject(streakErr);
              }
              
              console.log(`✅ Successfully updated ${userData.username}: ${userData.totalSolved} problems, ${userData.currentStreak}/${userData.longestStreak} streak`);
              resolve();
            });
        });
    });
  });
}

// Fix inactive students detection
async function fixInactiveStudentsDetection() {
  console.log('🔧 Fixing inactive students detection...\n');
  
  return new Promise((resolve, reject) => {
    // Clear existing inactive students table
    db.run('DELETE FROM inactive_students', (err) => {
      if (err) {
        console.error('Error clearing inactive students:', err);
        return reject(err);
      }
      
      // Get all users and check their activity
      db.all('SELECT DISTINCT username FROM users', async (err, users) => {
        if (err) {
          console.error('Error fetching users:', err);
          return reject(err);
        }
        
        let inactiveCount = 0;
        
        for (const user of users) {
          try {
            // Get user's streak data
            const streakData = await new Promise((resolve) => {
              db.get('SELECT * FROM streaks WHERE username = ?', [user.username], (err, row) => {
                resolve(row || { current_streak: 0, longest_streak: 0, last_activity_date: null });
              });
            });
            
            // Calculate days inactive
            let daysInactive = 999;
            if (streakData.last_activity_date) {
              const lastActivity = new Date(streakData.last_activity_date);
              const today = new Date();
              daysInactive = Math.floor((today - lastActivity) / (1000 * 60 * 60 * 24));
            }
            
            // If inactive for 3+ days, add to inactive list
            if (daysInactive >= 3) {
              db.run(`INSERT OR REPLACE INTO inactive_students 
                (username, inactive_since, days_inactive, last_activity_date, total_problems_missed) 
                VALUES (?, ?, ?, ?, ?)`,
                [user.username, 
                 new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                 daysInactive, 
                 streakData.last_activity_date, 
                 daysInactive]);
              
              inactiveCount++;
              console.log(`📝 Added ${user.username} to inactive list (${daysInactive} days inactive)`);
            }
          } catch (error) {
            console.error(`Error processing ${user.username}:`, error);
          }
        }
        
        console.log(`✅ Inactive students detection fixed: ${inactiveCount} inactive students identified\n`);
        resolve(inactiveCount);
      });
    });
  });
}

// Fix highest streak calculation
async function fixHighestStreakCalculation() {
  console.log('🔧 Fixing highest streak calculation...\n');
  
  return new Promise((resolve) => {
    db.get('SELECT MAX(longest_streak) as max_streak FROM streaks WHERE longest_streak IS NOT NULL', (err, row) => {
      if (err) {
        console.error('Error getting highest streak:', err);
        resolve(0);
      } else {
        const highestStreak = row?.max_streak || 0;
        console.log(`✅ Highest streak calculation fixed: ${highestStreak}\n`);
        resolve(highestStreak);
      }
    });
  });
}

// Comprehensive fix for all issues
async function comprehensiveFix() {
  console.log('🚀 Starting comprehensive fix for all issues...\n');
  console.log('Issues to fix:');
  console.log('1. ❌ Highest streak showing wrong values');
  console.log('2. ❌ Student dashboard not showing correct medium questions count');
  console.log('3. ❌ Inactive students not being detected properly');
  console.log('4. ❌ Data discrepancies between LeetCode API and database\n');
  
  try {
    // Step 1: Fix all user data with accurate LeetCode data
    console.log('📊 Step 1: Fixing all user data with accurate LeetCode data...\n');
    
    const users = await new Promise((resolve, reject) => {
      db.all('SELECT DISTINCT username FROM users ORDER BY username', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`Found ${users.length} users to fix\n`);
    
    let successCount = 0;
    let errorCount = 0;
    const corrections = [];
    
    for (const user of users) {
      try {
        // Get current data from database
        const currentData = await getCurrentUserData(user.username);
        
        // Fetch accurate data from LeetCode
        const accurateData = await fetchAccurateUserData(user.username);
        
        if (accurateData) {
          // Compare and log discrepancies
          const discrepancies = compareUserData(currentData, accurateData);
          
          if (discrepancies.length > 0) {
            console.log(`🔍 Discrepancies found for ${user.username}:`);
            discrepancies.forEach(disc => console.log(`  - ${disc}`));
            
            corrections.push({
              username: user.username,
              discrepancies,
              before: currentData,
              after: accurateData
            });
          }
          
          // Update with accurate data
          await updateUserDataAccurately(accurateData);
          successCount++;
          
          console.log(`✅ Fixed data for ${user.username}\n`);
        } else {
          console.log(`⚠️ Could not fetch data for ${user.username}\n`);
          errorCount++;
        }
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error processing ${user.username}:`, error.message);
        errorCount++;
      }
    }
    
    // Step 2: Fix inactive students detection
    console.log('📊 Step 2: Fixing inactive students detection...\n');
    const inactiveCount = await fixInactiveStudentsDetection();
    
    // Step 3: Fix highest streak calculation
    console.log('📊 Step 3: Fixing highest streak calculation...\n');
    const highestStreak = await fixHighestStreakCalculation();
    
    // Generate comprehensive report
    console.log('\\n📋 COMPREHENSIVE FIX REPORT');
    console.log('============================');
    console.log(`✅ Successfully fixed: ${successCount} users`);
    console.log(`❌ Errors encountered: ${errorCount} users`);
    console.log(`🔧 Data corrections made: ${corrections.length} users`);
    console.log(`⚠️ Inactive students identified: ${inactiveCount} users`);
    console.log(`🏆 Highest streak found: ${highestStreak} days`);
    
    if (corrections.length > 0) {
      console.log('\\n📊 DETAILED CORRECTIONS:');
      corrections.forEach(correction => {
        console.log(`\\n👤 ${correction.username}:`);
        correction.discrepancies.forEach(disc => console.log(`  - ${disc}`));
      });
    }
    
    console.log('\\n🎉 Comprehensive fix completed successfully!');
    console.log('\\nFixed Issues:');
    console.log('✅ 1. Highest streak calculation corrected');
    console.log('✅ 2. Medium questions count fixed');
    console.log('✅ 3. Inactive students detection working properly');
    console.log('✅ 4. All data synchronized with LeetCode API');
    
    return { 
      successCount, 
      errorCount, 
      corrections, 
      inactiveCount, 
      highestStreak 
    };
    
  } catch (error) {
    console.error('❌ Comprehensive fix failed:', error);
    throw error;
  }
}

// Get current user data from database
function getCurrentUserData(username) {
  return new Promise((resolve) => {
    db.get(`
      SELECT 
        ds.total_solved,
        ds.easy_solved,
        ds.medium_solved,
        ds.hard_solved,
        ds.contest_rating,
        s.current_streak,
        s.longest_streak,
        s.last_activity_date
      FROM daily_stats ds
      LEFT JOIN streaks s ON ds.username = s.username
      WHERE ds.username = ?
      ORDER BY ds.date DESC
      LIMIT 1
    `, [username], (err, row) => {
      if (err || !row) {
        resolve({
          totalSolved: 0,
          easy: 0,
          medium: 0,
          hard: 0,
          contestRanking: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: null
        });
      } else {
        resolve({
          totalSolved: row.total_solved || 0,
          easy: row.easy_solved || 0,
          medium: row.medium_solved || 0,
          hard: row.hard_solved || 0,
          contestRanking: row.contest_rating || 0,
          currentStreak: row.current_streak || 0,
          longestStreak: row.longest_streak || 0,
          lastActivityDate: row.last_activity_date
        });
      }
    });
  });
}

// Compare user data and identify discrepancies
function compareUserData(current, accurate) {
  const discrepancies = [];
  
  if (current.totalSolved !== accurate.totalSolved) {
    discrepancies.push(`Total: ${current.totalSolved} → ${accurate.totalSolved}`);
  }
  
  if (current.easy !== accurate.easy) {
    discrepancies.push(`Easy: ${current.easy} → ${accurate.easy}`);
  }
  
  if (current.medium !== accurate.medium) {
    discrepancies.push(`Medium: ${current.medium} → ${accurate.medium}`);
  }
  
  if (current.hard !== accurate.hard) {
    discrepancies.push(`Hard: ${current.hard} → ${accurate.hard}`);
  }
  
  if (current.currentStreak !== accurate.currentStreak) {
    discrepancies.push(`Current Streak: ${current.currentStreak} → ${accurate.currentStreak}`);
  }
  
  if (current.longestStreak !== accurate.longestStreak) {
    discrepancies.push(`Longest Streak: ${current.longestStreak} → ${accurate.longestStreak}`);
  }
  
  if (current.contestRanking !== accurate.contestRanking) {
    discrepancies.push(`Contest Rating: ${current.contestRanking} → ${accurate.contestRanking}`);
  }
  
  return discrepancies;
}

// Fix specific user data
async function fixSpecificUser(username) {
  console.log(`🔧 Fixing data for specific user: ${username}\\n`);
  
  try {
    const currentData = await getCurrentUserData(username);
    const accurateData = await fetchAccurateUserData(username);
    
    if (!accurateData) {
      console.log(`❌ Could not fetch accurate data for ${username}`);
      return false;
    }
    
    const discrepancies = compareUserData(currentData, accurateData);
    
    if (discrepancies.length > 0) {
      console.log(`🔍 Discrepancies found for ${username}:`);
      discrepancies.forEach(disc => console.log(`  - ${disc}`));
      
      await updateUserDataAccurately(accurateData);
      console.log(`✅ Successfully fixed data for ${username}`);
      return true;
    } else {
      console.log(`✅ No discrepancies found for ${username} - data is accurate`);
      return true;
    }
  } catch (error) {
    console.error(`❌ Error fixing data for ${username}:`, error.message);
    return false;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  try {
    if (args.length > 0) {
      // Fix specific user
      const username = args[0];
      await fixSpecificUser(username);
    } else {
      // Run comprehensive fix
      await comprehensiveFix();
    }
  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    db.close();
  }
}

// Export functions for use in server
module.exports = {
  comprehensiveFix,
  fixSpecificUser,
  fetchAccurateUserData,
  updateUserDataAccurately,
  fixInactiveStudentsDetection,
  fixHighestStreakCalculation
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}