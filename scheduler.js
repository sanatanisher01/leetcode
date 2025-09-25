const cron = require('node-cron');

class TaskScheduler {
  constructor(wsServer) {
    this.wsServer = wsServer;
    this.initializeScheduler();
  }
  
  initializeScheduler() {
    console.log('📅 Task scheduler initialized');
    
    // Daily data collection at midnight
    cron.schedule('0 0 * * *', () => {
      console.log('🌙 Running daily data collection...');
      this.wsServer.broadcast({
        type: 'system_update',
        message: 'Daily data collection started'
      });
    });
    
    // Hourly health check
    cron.schedule('0 * * * *', () => {
      console.log('⏰ Hourly system check');
      this.wsServer.broadcast({
        type: 'health_check',
        timestamp: new Date().toISOString()
      });
    });
  }
}

module.exports = TaskScheduler;