const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send warning email with beautiful template
async function sendWarningEmail(email, username, daysInactive, totalSolved, longestStreak) {
  try {
    const mailOptions = {
      from: `"Ruby Panwar" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '⚠️ LeetCode Activity Alert - Let\'s Get Back on Track!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>LeetCode Activity Alert</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%); min-height: 100vh;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <!-- Header -->
            <div style="background: rgba(255,255,255,0.95); border-radius: 20px 20px 0 0; padding: 40px 30px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ff6b6b, #ffa500); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem;">⚠️</div>
              <h1 style="margin: 0; color: #2d3748; font-size: 1.8rem; font-weight: 700;">Activity Alert</h1>
              <p style="margin: 10px 0 0 0; color: #718096; font-size: 1rem;">Time to Resume Your Coding Journey!</p>
            </div>
            
            <!-- Main Content -->
            <div style="background: white; padding: 40px 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="margin: 0 0 15px 0; color: #2d3748; font-size: 1.5rem;">Hi ${username}! 👋</h2>
                <p style="margin: 0; color: #4a5568; font-size: 1.1rem;">We noticed you've been away for a while...</p>
              </div>
              
              <!-- Stats Card -->
              <div style="background: linear-gradient(135deg, #ff6b6b, #ffa500); padding: 30px; border-radius: 15px; color: white; text-align: center; margin: 30px 0;">
                <h3 style="margin: 0 0 20px 0; font-size: 1.3rem; font-weight: 600;">📈 Your Progress So Far</h3>
                <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 20px;">
                  <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; margin-bottom: 5px;">${totalSolved}</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">Problems Solved</div>
                  </div>
                  <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; margin-bottom: 5px;">${longestStreak}</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">Longest Streak</div>
                  </div>
                  <div style="text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; margin-bottom: 5px;">${daysInactive}</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">Days Away</div>
                  </div>
                </div>
              </div>
              
              <div style="background: #f7fafc; padding: 25px; border-radius: 12px; border-left: 4px solid #ff6b6b; margin: 30px 0;">
                <h4 style="margin: 0 0 15px 0; color: #2d3748; font-size: 1.1rem; font-weight: 600;">🎯 Let's Get Back on Track!</h4>
                <p style="margin: 0 0 15px 0; color: #4a5568; line-height: 1.6;">Consistency is key to mastering coding skills. Even solving one problem a day can make a huge difference in your growth!</p>
                <p style="margin: 0; color: #4a5568; line-height: 1.6;"><strong>Remember:</strong> Every expert was once a beginner. Your coding journey matters, and I'm here to support you every step of the way.</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://leetcode.com/problemset/" style="display: inline-block; background: linear-gradient(135deg, #ff6b6b, #ffa500); color: white; padding: 15px 30px; border-radius: 25px; text-decoration: none; font-weight: 600; font-size: 1rem; box-shadow: 0 5px 15px rgba(255, 107, 107, 0.3);">🚀 Start Coding Now</a>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #2d3748; color: white; padding: 30px; border-radius: 0 0 20px 20px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
              <p style="margin: 0 0 15px 0; font-size: 1rem;">Keep coding, keep growing! 🌱</p>
              <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 20px;">
                <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #ff6b6b, #ffa500); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2rem;">R</div>
                <div style="text-align: left;">
                  <p style="margin: 0; font-size: 1.2rem; font-weight: 700; color: #ff6b6b;">Ruby Panwar</p>
                  <p style="margin: 0; font-size: 0.9rem; color: #a0aec0;">Your Coding Mentor</p>
                </div>
              </div>
              <div style="border-top: 1px solid #4a5568; padding-top: 20px; color: #a0aec0; font-size: 0.8rem;">
                <p style="margin: 0;">LeetCode Analytics Pro • Empowering Your Coding Journey</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
}

// Send bulk warning emails
async function sendBulkWarningEmails(students) {
  const results = [];
  
  for (const student of students) {
    const result = await sendWarningEmail(
      `${student.username}@gmail.com`,
      student.username,
      student.days_inactive,
      student.total_solved,
      student.longest_streak
    );
    
    results.push({
      username: student.username,
      success: result.success,
      error: result.error
    });
    
    // Delay between emails
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

// Send custom email with beautiful template
async function sendCustomEmail(email, username, subject, message) {
  try {
    const mailOptions = {
      from: `"Ruby Panwar" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <!-- Header -->
            <div style="background: rgba(255,255,255,0.95); border-radius: 20px 20px 0 0; padding: 40px 30px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
              <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem; font-weight: bold;">⚡</div>
              <h1 style="margin: 0; color: #2d3748; font-size: 2rem; font-weight: 700; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">LeetCode Analytics Pro</h1>
              <p style="margin: 10px 0 0 0; color: #718096; font-size: 1.1rem;">Your Coding Journey Companion</p>
            </div>
            
            <!-- Main Content -->
            <div style="background: white; padding: 40px 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
              <div style="border-left: 4px solid #667eea; padding-left: 20px; margin-bottom: 30px;">
                <h2 style="margin: 0 0 10px 0; color: #2d3748; font-size: 1.5rem; font-weight: 600;">${subject}</h2>
                <p style="margin: 0; color: #4a5568; font-size: 1rem;">Hello ${username},</p>
              </div>
              
              <div style="color: #4a5568; font-size: 1rem; line-height: 1.6; margin-bottom: 30px;">
                ${message.replace(/\n/g, '<br><br>')}
              </div>
              
              <div style="background: linear-gradient(135deg, #f7fafc, #edf2f7); padding: 25px; border-radius: 12px; border-left: 4px solid #48bb78; margin: 30px 0;">
                <p style="margin: 0; color: #2d3748; font-weight: 600; font-size: 1rem;">💡 Keep coding and stay consistent!</p>
                <p style="margin: 10px 0 0 0; color: #4a5568; font-size: 0.9rem;">Remember: Every problem solved is a step towards mastery.</p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #2d3748; color: white; padding: 30px; border-radius: 0 0 20px 20px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
              <p style="margin: 0 0 15px 0; font-size: 1.1rem; font-weight: 600;">Best regards,</p>
              <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 20px;">
                <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2rem;">R</div>
                <div style="text-align: left;">
                  <p style="margin: 0; font-size: 1.2rem; font-weight: 700; color: #667eea;">Ruby Panwar</p>
                  <p style="margin: 0; font-size: 0.9rem; color: #a0aec0;">Instructor & Mentor</p>
                </div>
              </div>
              <div style="border-top: 1px solid #4a5568; padding-top: 20px; color: #a0aec0; font-size: 0.8rem;">
                <p style="margin: 0;">LeetCode Analytics Pro • Empowering Coders Worldwide</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Custom email send error:', error);
    return { success: false, error: error.message };
  }
}

// Send welcome email with beautiful template
async function sendWelcomeEmail(email, username) {
  try {
    const mailOptions = {
      from: `"Ruby Panwar" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎉 Welcome to LeetCode Analytics Pro - Your Coding Journey Begins!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to LeetCode Analytics Pro</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <!-- Header -->
            <div style="background: rgba(255,255,255,0.95); border-radius: 20px 20px 0 0; padding: 40px 30px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
              <div style="width: 100px; height: 100px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem;">🎉</div>
              <h1 style="margin: 0; color: #2d3748; font-size: 2.2rem; font-weight: 700; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Welcome Aboard!</h1>
              <p style="margin: 15px 0 0 0; color: #718096; font-size: 1.2rem; font-weight: 500;">Your Coding Adventure Starts Now</p>
            </div>
            
            <!-- Main Content -->
            <div style="background: white; padding: 40px 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="margin: 0 0 15px 0; color: #2d3748; font-size: 1.8rem;">Hello ${username}! 👋</h2>
                <p style="margin: 0; color: #4a5568; font-size: 1.1rem; line-height: 1.6;">Welcome to <strong>LeetCode Analytics Pro</strong> - your personal coding companion that will help you track progress, stay motivated, and achieve your programming goals!</p>
              </div>
              
              <!-- Features Grid -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0;">
                <div style="background: #f0f9ff; padding: 20px; border-radius: 12px; text-align: center; border: 2px solid #e0f2fe;">
                  <div style="font-size: 2rem; margin-bottom: 10px;">📈</div>
                  <h4 style="margin: 0 0 10px 0; color: #0369a1; font-size: 1rem;">Track Progress</h4>
                  <p style="margin: 0; color: #4a5568; font-size: 0.9rem;">Monitor your daily coding activity</p>
                </div>
                <div style="background: #f0fdf4; padding: 20px; border-radius: 12px; text-align: center; border: 2px solid #dcfce7;">
                  <div style="font-size: 2rem; margin-bottom: 10px;">🔥</div>
                  <h4 style="margin: 0 0 10px 0; color: #059669; font-size: 1rem;">Build Streaks</h4>
                  <p style="margin: 0; color: #4a5568; font-size: 0.9rem;">Maintain consistent coding habits</p>
                </div>
                <div style="background: #fefce8; padding: 20px; border-radius: 12px; text-align: center; border: 2px solid #fef3c7;">
                  <div style="font-size: 2rem; margin-bottom: 10px;">🏆</div>
                  <h4 style="margin: 0 0 10px 0; color: #d97706; font-size: 1rem;">Compete</h4>
                  <p style="margin: 0; color: #4a5568; font-size: 0.9rem;">See how you rank among peers</p>
                </div>
                <div style="background: #fdf2f8; padding: 20px; border-radius: 12px; text-align: center; border: 2px solid #fce7f3;">
                  <div style="font-size: 2rem; margin-bottom: 10px;">🎯</div>
                  <h4 style="margin: 0 0 10px 0; color: #be185d; font-size: 1rem;">Achieve Goals</h4>
                  <p style="margin: 0; color: #4a5568; font-size: 0.9rem;">Reach new coding milestones</p>
                </div>
              </div>
              
              <!-- CTA Section -->
              <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; border-radius: 15px; color: white; text-align: center; margin: 30px 0;">
                <h3 style="margin: 0 0 15px 0; font-size: 1.4rem; font-weight: 600;">🚀 Ready to Start Your Journey?</h3>
                <p style="margin: 0 0 25px 0; font-size: 1rem; opacity: 0.9;">Access your personalized dashboard and begin tracking your progress today!</p>
                <a href="${process.env.BASE_URL || 'http://localhost:3000'}/user-dashboard.html?username=${username}" style="display: inline-block; background: white; color: #667eea; padding: 15px 30px; border-radius: 25px; text-decoration: none; font-weight: 600; font-size: 1rem; box-shadow: 0 5px 15px rgba(0,0,0,0.2);">📊 View My Dashboard</a>
              </div>
              
              <div style="background: #f7fafc; padding: 25px; border-radius: 12px; border-left: 4px solid #48bb78; margin: 30px 0;">
                <h4 style="margin: 0 0 15px 0; color: #2d3748; font-size: 1.1rem; font-weight: 600;">💡 Pro Tips for Success:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #4a5568; line-height: 1.6;">
                  <li>Start with easy problems and gradually increase difficulty</li>
                  <li>Aim for consistency - even 1 problem per day makes a difference</li>
                  <li>Review and understand solutions, don't just submit</li>
                  <li>Join coding contests to challenge yourself</li>
                </ul>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #2d3748; color: white; padding: 30px; border-radius: 0 0 20px 20px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
              <p style="margin: 0 0 15px 0; font-size: 1.1rem;">Happy Coding! 🚀</p>
              <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 20px;">
                <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2rem;">R</div>
                <div style="text-align: left;">
                  <p style="margin: 0; font-size: 1.2rem; font-weight: 700; color: #667eea;">Ruby Panwar</p>
                  <p style="margin: 0; font-size: 0.9rem; color: #a0aec0;">Your Coding Mentor & Guide</p>
                </div>
              </div>
              <div style="border-top: 1px solid #4a5568; padding-top: 20px; color: #a0aec0; font-size: 0.8rem;">
                <p style="margin: 0;">LeetCode Analytics Pro • Empowering Coders Worldwide • Your Success is Our Mission</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Welcome email send error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendWarningEmail,
  sendBulkWarningEmails,
  sendCustomEmail,
  sendWelcomeEmail
};