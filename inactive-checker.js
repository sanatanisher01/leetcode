const fetch = require('node-fetch');

async function checkRealInactiveDays(username) {
  try {
    const query = {
      operationName: "userProfileCalendar",
      variables: { username },
      query: `query userProfileCalendar($username: String!) {
        matchedUser(username: $username) {
          userCalendar {
            submissionCalendar
          }
        }
      }`
    };

    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data?.data?.matchedUser?.userCalendar?.submissionCalendar) return null;

    const calendar = JSON.parse(data.data.matchedUser.userCalendar.submissionCalendar);
    const today = Math.floor(Date.now() / 86400000) * 86400;
    
    const activeTimestamps = Object.keys(calendar)
      .filter(ts => parseInt(calendar[ts]) > 0)
      .map(ts => parseInt(ts));

    if (activeTimestamps.length === 0) return 999;

    const lastActiveTimestamp = Math.max(...activeTimestamps);
    const daysInactive = Math.floor((today - lastActiveTimestamp) / 86400);
    
    return daysInactive;
  } catch (error) {
    console.error(`Error checking ${username}:`, error);
    return null;
  }
}

module.exports = { checkRealInactiveDays };