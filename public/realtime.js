class RealtimeUpdates {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.connect();
    }

    connect() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            this.ws = new WebSocket(`${protocol}//${window.location.host}`);
            
            this.ws.onopen = () => {
                console.log('🔌 WebSocket connected');
                this.reconnectAttempts = 0;
                this.showConnectionStatus(true);
                
                // Subscribe to leaderboard updates
                this.ws.send(JSON.stringify({
                    type: 'subscribe_leaderboard'
                }));
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('WebSocket message error:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                this.showConnectionStatus(false);
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.showConnectionStatus(false);
            };

        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.attemptReconnect();
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'connected':
                console.log('✅ WebSocket connection confirmed');
                break;
                
            case 'leaderboard_update':
                this.updateLeaderboard(data.data);
                this.showNotification(`🚀 ${data.data.username} solved new problems!`);
                break;
                
            case 'student_update':
                this.updateStudentData(data.username, data.data);
                break;
        }
    }

    updateLeaderboard(studentData) {
        // Update leaderboard table if visible
        const leaderboardBody = document.getElementById('leaderboard-body');
        if (leaderboardBody) {
            // Find and update the student's row
            const rows = leaderboardBody.querySelectorAll('tr');
            rows.forEach(row => {
                const usernameEl = row.querySelector('.username');
                if (usernameEl && usernameEl.textContent === studentData.username) {
                    // Update total solved
                    const totalEl = row.querySelector('.total-solved');
                    if (totalEl) {
                        totalEl.textContent = studentData.totalSolved;
                        totalEl.style.animation = 'pulse 1s ease-in-out';
                    }
                    
                    // Update difficulty counts
                    const easyEl = row.querySelector('.difficulty-col.easy');
                    const mediumEl = row.querySelector('.difficulty-col.medium');
                    const hardEl = row.querySelector('.difficulty-col.hard');
                    
                    if (easyEl) easyEl.textContent = studentData.easy;
                    if (mediumEl) mediumEl.textContent = studentData.medium;
                    if (hardEl) hardEl.textContent = studentData.hard;
                }
            });
        }
    }

    updateStudentData(username, data) {
        // Update student dashboard if open
        if (window.location.pathname.includes('user-dashboard.html')) {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('username') === username) {
                document.getElementById('total-solved').textContent = data.totalSolved;
                document.getElementById('easy-solved').textContent = data.easy;
                document.getElementById('medium-solved').textContent = data.medium;
                document.getElementById('hard-solved').textContent = data.hard;
            }
        }
    }

    showNotification(message) {
        // Create notification toast
        const notification = document.createElement('div');
        notification.className = 'realtime-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-bolt"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showConnectionStatus(connected) {
        let statusEl = document.getElementById('ws-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'ws-status';
            statusEl.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 0.8rem;
                font-weight: 600;
                z-index: 9999;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(statusEl);
        }
        
        if (connected) {
            statusEl.innerHTML = '🟢 Live';
            statusEl.style.background = 'rgba(16, 185, 129, 0.9)';
            statusEl.style.color = 'white';
        } else {
            statusEl.innerHTML = '🔴 Offline';
            statusEl.style.background = 'rgba(239, 68, 68, 0.9)';
            statusEl.style.color = 'white';
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.log('❌ Max reconnection attempts reached');
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
    }
`;
document.head.appendChild(style);

// Initialize real-time updates when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.realtimeUpdates = new RealtimeUpdates();
});