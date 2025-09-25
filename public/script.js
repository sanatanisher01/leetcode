class LeaderboardApp {
    constructor() {
        this.leaderboardData = [];
        this.analyticsData = null;
        this.charts = {};
        this.currentInputMethod = 'textarea';
        this.theme = localStorage.getItem('theme') || 'light';
        this.currentDate = new Date();
        this.selectedUser = null;
        this.userCalendarData = {};
        this.isAuthenticated = false;
        
        this.initializeApp();
    }

    initializeApp() {
        this.initializeTheme();
        this.initializePinProtection();
        this.initializeEventListeners();
        this.initializeAnimations();
    }

    initializePinProtection() {
        // Auto-verify PIN on input
        document.getElementById('pin-input').addEventListener('input', (e) => {
            if (e.target.value.length === 4) {
                this.validatePin();
            }
        });
        
        // PIN form submission
        document.getElementById('pin-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.validatePin();
        });
    }

    validatePin() {
        const enteredPin = document.getElementById('pin-input').value;
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const correctPin = hours + minutes;

        if (enteredPin === correctPin) {
            this.isAuthenticated = true;
            this.hidePinModal();
            document.getElementById('pin-error').textContent = '';
            document.getElementById('pin-input').value = '';
            // Continue with leaderboard generation
            this.generateLeaderboard();
        } else {
            document.getElementById('pin-error').textContent = 'Invalid PIN';
            document.getElementById('pin-input').value = '';
        }
    }

    showPinModal() {
        document.getElementById('pin-modal').classList.remove('hidden');
        document.getElementById('pin-input').focus();
    }

    hidePinModal() {
        document.getElementById('pin-modal').classList.add('hidden');
    }

    initializeTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const themeIcon = document.querySelector('#theme-toggle i');
        themeIcon.className = this.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    initializeEventListeners() {
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Navigation
        document.getElementById('nav-toggle').addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        // Smooth scroll for navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                
                // Check if it's an external link (like admin.html)
                if (href && !href.startsWith('#')) {
                    // Let the browser handle external links normally
                    this.closeMobileMenu();
                    return;
                }
                
                // Handle internal navigation
                e.preventDefault();
                const targetId = href.substring(1);
                
                // Load position data for position section
                if (targetId === 'position') {
                    this.loadPositionData();
                }
                
                this.scrollToSection(targetId);
                this.closeMobileMenu();
            });
        });

        // Form submission
        document.getElementById('leaderboard-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        // Input method selection
        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchInputMethod(tab.dataset.method);
            });
        });

        // Sorting buttons
        document.getElementById('sort-total').addEventListener('click', () => {
            this.sortLeaderboard('total');
        });

        document.getElementById('sort-contest').addEventListener('click', () => {
            this.sortLeaderboard('contest');
        });

        // CSV processing buttons
        document.getElementById('process-csv').addEventListener('click', () => {
            this.processCSVData();
        });

        document.getElementById('load-sample-csv').addEventListener('click', () => {
            this.loadSampleCSV();
        });

        // CSV file upload
        document.getElementById('csv-file').addEventListener('change', (e) => {
            this.handleCSVFileUpload(e.target.files[0]);
        });

        // File upload drag & drop
        const uploadArea = document.getElementById('file-upload-area');
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleCSVFileUpload(files[0]);
            }
        });

        // Calendar controls
        document.getElementById('calendar-user-select').addEventListener('change', (e) => {
            this.selectUserForCalendar(e.target.value);
        });

        document.getElementById('prev-month').addEventListener('click', () => {
            this.navigateMonth(-1);
        });

        document.getElementById('next-month').addEventListener('click', () => {
            this.navigateMonth(1);
        });

        document.getElementById('close-details').addEventListener('click', () => {
            this.hideSubmissionDetails();
        });

        // Error toast close and chart controls
        document.addEventListener('click', (e) => {
            if (e.target.closest('.toast-close')) {
                this.hideError();
            }
            
            // Handle chart type switching
            if (e.target.classList.contains('chart-btn') && e.target.dataset.type) {
                const chartCard = e.target.closest('.chart-card');
                chartCard.querySelectorAll('.chart-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                this.createUserComparisonChart(e.target.dataset.type);
            }

            // Handle calendar day clicks
            if (e.target.classList.contains('calendar-day') && !e.target.classList.contains('calendar-day-header')) {
                this.selectCalendarDay(e.target);
            }
        });

        // Intersection Observer for animations
        this.setupScrollAnimations();
    }

    initializeAnimations() {
        // Add entrance animations to elements
        const animatedElements = document.querySelectorAll('.hero-text, .hero-visual, .section-header');
        animatedElements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            
            setTimeout(() => {
                el.style.transition = 'all 0.8s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, index * 200);
        });
    }

    setupScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, { threshold: 0.1 });

        // Observe elements for scroll animations
        document.querySelectorAll('.glass-card, .stat-card, .chart-card').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'all 0.6s ease';
            observer.observe(el);
        });
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
        
        const themeIcon = document.querySelector('#theme-toggle i');
        themeIcon.className = this.theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        
        // Add smooth transition effect
        document.body.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            document.body.style.transition = '';
        }, 300);
    }

    toggleMobileMenu() {
        const navMenu = document.getElementById('nav-menu');
        const navToggle = document.getElementById('nav-toggle');
        
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    }

    closeMobileMenu() {
        const navMenu = document.getElementById('nav-menu');
        const navToggle = document.getElementById('nav-toggle');
        
        navMenu.classList.remove('active');
        navToggle.classList.remove('active');
    }

    scrollToSection(sectionId) {
        const element = document.getElementById(sectionId);
        if (element) {
            const offsetTop = element.offsetTop - 80; // Account for fixed navbar
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    }

    switchInputMethod(method) {
        this.currentInputMethod = method;
        
        // Update active method tab
        document.querySelectorAll('.method-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.method === method);
        });

        // Show/hide input methods with animation
        const textareaInput = document.getElementById('textarea-input');
        const csvInput = document.getElementById('csv-input');
        
        if (method === 'textarea') {
            csvInput.classList.add('hidden');
            textareaInput.classList.remove('hidden');
        } else {
            textareaInput.classList.add('hidden');
            csvInput.classList.remove('hidden');
        }
    }

    processCSVData() {
        const csvData = document.getElementById('csv-data').value.trim();
        if (!csvData) {
            this.showError('Please enter CSV data');
            return;
        }

        const lines = csvData.split('\n');
        const usernames = [];
        const seen = new Set();
        let processed = 0;
        let duplicates = 0;
        let invalid = 0;

        lines.forEach((line, index) => {
            if (!line.trim()) return;
            
            const parts = line.split(',');
            if (parts.length !== 3) {
                invalid++;
                return;
            }

            const name = parts[0].trim();
            const rollNumber = parts[1].trim();
            const url = parts[2].trim();

            // Check for duplicates
            if (seen.has(rollNumber)) {
                duplicates++;
                return;
            }

            // Validate LeetCode URL
            if (!url.includes('leetcode.com')) {
                invalid++;
                return;
            }

            // Extract username
            let username = '';
            if (url.includes('/u/')) {
                username = url.split('/u/')[1].replace('/', '');
            } else {
                const urlParts = url.split('/');
                username = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
            }

            usernames.push(username);
            seen.add(rollNumber);
            processed++;
        });

        if (usernames.length > 0) {
            document.getElementById('usernames').value = usernames.join('\n');
            this.switchInputMethod('textarea');
            this.showSuccess(`Processed ${processed} students. ${duplicates} duplicates and ${invalid} invalid entries removed.`);
        } else {
            this.showError('No valid LeetCode usernames found in CSV data');
        }
    }

    loadSampleCSV() {
        const sampleData = `Mayank Sharma,2315800050,https://leetcode.com/mayank-05-old
Anuj Kumar,2315800012,https://leetcode.com/u/anuj1210/
Prerita Saini,2315800066,https://leetcode.com/u/Prerita_1/
Parth Garg,2315800060,https://leetcode.com/u/parth_garg77/
Sarvagya Saxena,2315800073,https://leetcode.com/u/sarvagyasaxena2006/`;
        document.getElementById('csv-data').value = sampleData;
    }

    async handleCSVFileUpload(file) {
        if (!file) return;

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
            this.showError('Please upload a CSV or TXT file');
            return;
        }

        try {
            const text = await file.text();
            document.getElementById('csv-data').value = text;
            this.showSuccess(`File "${file.name}" loaded successfully!`);
        } catch (error) {
            this.showError(`Failed to read file: ${error.message}`);
        }
    }

    handleFormSubmit() {
        let usernames = [];
        
        if (this.currentInputMethod === 'textarea') {
            const textarea = document.getElementById('usernames');
            usernames = textarea.value.trim().split('\n').filter(u => u.trim());
        } else {
            // For CSV method, process first if not already done
            const csvData = document.getElementById('csv-data').value.trim();
            if (csvData) {
                this.processCSVData();
                const textarea = document.getElementById('usernames');
                usernames = textarea.value.trim().split('\n').filter(u => u.trim());
            }
        }
        
        if (usernames.length === 0) {
            this.showError('Please enter usernames or process CSV data first');
            return;
        }
        
        // Check authentication first
        if (!this.isAuthenticated) {
            this.showPinModal();
            return;
        }
        this.generateLeaderboard();
    }

    async generateLeaderboard() {
        const textarea = document.getElementById('usernames');
        const usernames = textarea.value.trim().split('\n').filter(u => u.trim());

        if (usernames.length === 0) {
            this.showError('Please enter at least one username or upload a CSV file');
            return;
        }

        this.showLoading(true);
        this.hideError();
        this.hideResults();

        try {
            const response = await fetch('/leaderboard', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ usernames })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch leaderboard');
            }

            this.leaderboardData = data.leaderboard;
            this.analyticsData = data.analytics;
            
            // Show results with smooth animation
            setTimeout(() => {
                this.displayAnalytics();
                this.displayLeaderboard();
                this.populateCalendarUsers();
                this.setActiveSort('total');
                this.scrollToSection('analytics');
            }, 500);

        } catch (error) {
            this.showError(`Error: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    displayAnalytics() {
        if (!this.analyticsData) return;

        // Update statistics cards with animation
        this.animateCounter('total-users', this.analyticsData.totalUsers);
        this.animateCounter('avg-problems', this.analyticsData.averageProblems);
        this.animateCounter('avg-rating', this.analyticsData.averageRating);

        // Display top performers
        this.displayTopPerformers();

        // Create charts
        this.createDifficultyChart();
        this.createRatingChart();
        this.createUserComparisonChart('bar');
        this.createUserBreakdownChart();

        // Show analytics section
        document.getElementById('analytics').classList.remove('hidden');
    }

    animateCounter(elementId, targetValue) {
        const element = document.getElementById(elementId);
        const startValue = 0;
        const duration = 1000;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentValue = Math.floor(startValue + (targetValue - startValue) * progress);
            element.textContent = currentValue.toLocaleString();

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    displayTopPerformers() {
        const container = document.getElementById('top-performers-cards');
        container.innerHTML = '';

        this.analyticsData.topPerformers.forEach((user, index) => {
            const card = document.createElement('div');
            card.className = `performer-card rank-${index + 1}`;
            
            const medals = ['🥇', '🥈', '🥉'];
            const medal = medals[index];
            
            card.innerHTML = `
                <img src="${user.avatar}" alt="${user.username}" class="performer-avatar" 
                     onerror="this.src='https://via.placeholder.com/80'" 
                     style="border: 3px solid #6366f1;">
                <div class="performer-name" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <span>${medal}</span>
                    <div style="text-align: center;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
                            <i class="fab fa-leetcode" style="color: #ffa116; font-size: 1rem;"></i>
                            <span style="font-weight: 600;">${user.username}</span>
                        </div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">LeetCode Student</div>
                    </div>
                </div>
                <div class="performer-stats">
                    <div><strong style="color: #6366f1;">${user.totalSolved}</strong> problems solved</div>
                    <div>Contest Rating: <strong>${user.contestRanking || 'N/A'}</strong></div>
                    <div class="performer-streak-info" style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
                        <span class="performer-current-streak" style="font-size: 0.85rem;">🔥 ${user.currentStreak || 0} current</span>
                        <span class="performer-longest-streak" style="font-size: 0.85rem;">🏆 ${user.longestStreak || 0} best</span>
                    </div>
                </div>
            `;
            
            // Add entrance animation
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            container.appendChild(card);
            
            setTimeout(() => {
                card.style.transition = 'all 0.6s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 200);
        });
    }

    createDifficultyChart() {
        const ctx = document.getElementById('difficulty-chart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.charts.difficulty) {
            this.charts.difficulty.destroy();
        }

        const data = this.analyticsData.difficultyStats;
        
        this.charts.difficulty = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Easy', 'Medium', 'Hard'],
                datasets: [{
                    data: [data.easy, data.medium, data.hard],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ],
                    borderColor: [
                        'rgb(16, 185, 129)',
                        'rgb(245, 158, 11)',
                        'rgb(239, 68, 68)'
                    ],
                    borderWidth: 3,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: { 
                                size: 14,
                                family: 'Inter'
                            },
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const total = data.easy + data.medium + data.hard;
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 1000
                }
            }
        });
    }

    createRatingChart() {
        const ctx = document.getElementById('rating-chart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.charts.rating) {
            this.charts.rating.destroy();
        }

        const data = this.analyticsData.ratingDistribution;
        
        this.charts.rating = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    label: 'Number of Users',
                    data: Object.values(data),
                    backgroundColor: [
                        'rgba(107, 114, 128, 0.8)',
                        'rgba(6, 182, 212, 0.8)',
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(245, 158, 11, 0.8)'
                    ],
                    borderColor: [
                        'rgb(107, 114, 128)',
                        'rgb(6, 182, 212)',
                        'rgb(16, 185, 129)',
                        'rgb(245, 158, 11)'
                    ],
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y} users`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: {
                                family: 'Inter'
                            }
                        },
                        grid: {
                            color: 'rgba(156, 163, 175, 0.2)'
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                family: 'Inter'
                            }
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    createUserComparisonChart(type = 'bar') {
        const ctx = document.getElementById('user-comparison-chart').getContext('2d');
        
        if (this.charts.userComparison) {
            this.charts.userComparison.destroy();
        }

        const topUsers = this.leaderboardData.slice(0, 8); // Show top 8 users
        const usernames = topUsers.map(user => user.username);
        const totalSolved = topUsers.map(user => user.totalSolved);
        
        const colors = [
            'rgba(99, 102, 241, 0.8)', 'rgba(6, 182, 212, 0.8)', 'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(168, 85, 247, 0.8)',
            'rgba(236, 72, 153, 0.8)', 'rgba(34, 197, 94, 0.8)'
        ];

        this.charts.userComparison = new Chart(ctx, {
            type: type,
            data: {
                labels: usernames,
                datasets: [{
                    label: 'Problems Solved',
                    data: totalSolved,
                    backgroundColor: colors,
                    borderColor: colors.map(color => color.replace('0.8', '1')),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: type === 'pie',
                        position: 'bottom'
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8
                    }
                },
                scales: type === 'bar' ? {
                    y: {
                        beginAtZero: true,
                        ticks: { font: { family: 'Inter' } },
                        grid: { color: 'rgba(156, 163, 175, 0.2)' }
                    },
                    x: {
                        ticks: { font: { family: 'Inter' } },
                        grid: { display: false }
                    }
                } : {},
                animation: { duration: 1000 }
            }
        });
    }

    createUserBreakdownChart() {
        const ctx = document.getElementById('user-breakdown-chart').getContext('2d');
        
        if (this.charts.userBreakdown) {
            this.charts.userBreakdown.destroy();
        }

        const topUsers = this.leaderboardData.slice(0, 5); // Show top 5 users
        const usernames = topUsers.map(user => user.username);
        
        this.charts.userBreakdown = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: usernames,
                datasets: [
                    {
                        label: 'Easy',
                        data: topUsers.map(user => user.easy),
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderColor: 'rgb(16, 185, 129)',
                        borderWidth: 2
                    },
                    {
                        label: 'Medium',
                        data: topUsers.map(user => user.medium),
                        backgroundColor: 'rgba(245, 158, 11, 0.8)',
                        borderColor: 'rgb(245, 158, 11)',
                        borderWidth: 2
                    },
                    {
                        label: 'Hard',
                        data: topUsers.map(user => user.hard),
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                        borderColor: 'rgb(239, 68, 68)',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: 'Inter' },
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: { font: { family: 'Inter' } },
                        grid: { display: false }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: { font: { family: 'Inter' } },
                        grid: { color: 'rgba(156, 163, 175, 0.2)' }
                    }
                },
                animation: { duration: 1000 }
            }
        });
    }

    sortLeaderboard(type) {
        if (type === 'total') {
            this.leaderboardData.sort((a, b) => b.totalSolved - a.totalSolved);
        } else if (type === 'contest') {
            this.leaderboardData.sort((a, b) => {
                // Handle users with no contest rating (put them at the end)
                if (!a.contestRanking && !b.contestRanking) return 0;
                if (!a.contestRanking) return 1;
                if (!b.contestRanking) return -1;
                // Lower rating = better rank (higher position)
                return a.contestRanking - b.contestRanking;
            });
        }

        // Update ranks
        this.leaderboardData.forEach((user, index) => {
            user.rank = index + 1;
        });

        this.displayLeaderboard();
        this.setActiveSort(type);
    }

    displayLeaderboard() {
        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = '';

        this.leaderboardData.forEach((user, index) => {
            const row = document.createElement('tr');
            
            // Add entrance animation
            row.style.opacity = '0';
            row.style.transform = 'translateX(-20px)';
            
            const rankDisplay = user.rank <= 3 ? 
                `<div class="rank-badge rank-${user.rank}">${user.rank}</div>` : 
                `<span class="rank-number">#${user.rank}</span>`;
            
            const lastSubmissionDisplay = this.formatLastSubmissionDate(user.lastSubmissionDate);
            
            row.innerHTML = `
                <td>${rankDisplay}</td>
                <td>
                    <div class="user-info" style="display: flex; align-items: center; gap: 0.75rem;">
                        <img src="${user.avatar}" alt="${user.username}" class="user-avatar" 
                             onerror="this.src='https://via.placeholder.com/50'" 
                             style="width: 50px; height: 50px; border-radius: 50%; border: 2px solid #6366f1;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                                <i class="fab fa-leetcode" style="color: #ffa116; font-size: 1.1rem;"></i>
                                <span class="username" style="font-weight: 600; font-size: 1rem;">${user.username}</span>
                            </div>
                            <div style="font-size: 0.75rem; color: #64748b;">
                                LeetCode Student
                            </div>
                        </div>
                    </div>
                </td>
                <td><span class="total-solved" style="font-weight: 600; color: #6366f1; font-size: 1.1rem;">${user.totalSolved}</span></td>
                <td class="difficulty-col easy" style="color: #10b981; font-weight: 500;">${user.easy}</td>
                <td class="difficulty-col medium" style="color: #f59e0b; font-weight: 500;">${user.medium}</td>
                <td class="difficulty-col hard" style="color: #ef4444; font-weight: 500;">${user.hard}</td>
                <td class="contest-rating" style="font-weight: 500;">${user.contestRanking && user.contestRanking > 0 ? user.contestRanking : 'Unrated'}</td>
                <td class="streak-col">
                    <div class="streak-info" style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <div class="current-streak" title="Current Streak: ${user.currentStreak || 0} days" style="display: flex; align-items: center; gap: 0.25rem; font-weight: 500;">
                            <span class="streak-icon">🔥</span>
                            <span class="streak-value">${user.currentStreak || 0}</span>
                            <span class="streak-label" style="font-size: 0.8rem; color: #64748b;">current</span>
                        </div>
                        <div class="longest-streak" title="Longest Streak: ${user.longestStreak || 0} days" style="display: flex; align-items: center; gap: 0.25rem; font-weight: 500; font-size: 0.9rem;">
                            <span class="streak-icon">🏆</span>
                            <span class="streak-value">${user.longestStreak || 0}</span>
                            <span class="streak-label" style="font-size: 0.75rem; color: #64748b;">best</span>
                        </div>
                    </div>
                </td>

            `;
            
            tbody.appendChild(row);
            
            // Animate row entrance
            setTimeout(() => {
                row.style.transition = 'all 0.4s ease';
                row.style.opacity = '1';
                row.style.transform = 'translateX(0)';
            }, index * 50);
        });

        document.getElementById('leaderboard').classList.remove('hidden');
    }

    setActiveSort(type) {
        document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`sort-${type}`).classList.add('active');
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        const submitBtn = document.getElementById('submit-btn');
        
        if (show) {
            loading.classList.remove('hidden');
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <div class="spinner-ring" style="width: 20px; height: 20px; margin-right: 8px;"></div>
                <span>Generating...</span>
            `;
        } else {
            loading.classList.add('hidden');
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <i class="fas fa-chart-line"></i>
                <span>Generate Analytics</span>
                <div class="btn-shine"></div>
            `;
        }
    }

    showResults() {
        document.getElementById('analytics').classList.remove('hidden');
        document.getElementById('leaderboard').classList.remove('hidden');
    }

    hideResults() {
        document.getElementById('analytics').classList.add('hidden');
        document.getElementById('leaderboard').classList.add('hidden');
    }

    showError(message) {
        const errorDiv = document.getElementById('error-message');
        const textSpan = errorDiv.querySelector('.toast-text');
        textSpan.textContent = message;
        errorDiv.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    showSuccess(message) {
        // Create success toast
        const successToast = document.createElement('div');
        successToast.className = 'error-toast';
        successToast.style.background = 'var(--success-color)';
        successToast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-check-circle"></i>
                <span class="toast-text">${message}</span>
                <button class="toast-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(successToast);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            successToast.remove();
        }, 3000);
        
        // Close button functionality
        successToast.querySelector('.toast-close').addEventListener('click', () => {
            successToast.remove();
        });
    }

    hideError() {
        document.getElementById('error-message').classList.add('hidden');
    }

    // Calendar Methods
    populateCalendarUsers() {
        const select = document.getElementById('calendar-user-select');
        select.innerHTML = '<option value="">Choose a user...</option>';
        
        this.leaderboardData.forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = `${user.username} (${user.totalSolved} problems)`;
            select.appendChild(option);
        });
    }

    async selectUserForCalendar(username) {
        if (!username) {
            this.selectedUser = null;
            this.updateCalendarStats(null);
            this.renderCalendar();
            return;
        }

        this.selectedUser = username;
        const userData = this.leaderboardData.find(u => u.username === username);
        
        if (userData) {
            this.updateCalendarStats(userData);
        }

        // Fetch calendar data from LeetCode API
        try {
            const response = await fetch(`/api/leetcode/${username}/calendar`);
            const calendarData = await response.json();
            
            if (calendarData && calendarData.submissionCalendar) {
                this.userCalendarData[username] = calendarData.submissionCalendar;
            } else {
                this.userCalendarData[username] = {};
            }
        } catch (error) {
            console.error('Failed to fetch calendar data:', error);
            this.userCalendarData[username] = {};
        }

        this.renderCalendar();
    }

    updateCalendarStats(userData) {
        const currentStreakEl = document.getElementById('calendar-current-streak');
        const longestStreakEl = document.getElementById('calendar-longest-streak');
        const activeDaysEl = document.getElementById('calendar-active-days');
        const lastSubmissionEl = document.getElementById('calendar-last-submission');

        if (userData) {
            currentStreakEl.textContent = userData.currentStreak || 0;
            longestStreakEl.textContent = userData.longestStreak || 0;
            
            // Calculate active days from calendar data
            const calendarData = this.userCalendarData[userData.username] || {};
            const activeDays = Object.keys(calendarData).filter(date => parseInt(calendarData[date]) > 0).length;
            activeDaysEl.textContent = activeDays;
            
            // Show last submission date
            if (userData.lastSubmissionDate && userData.lastSubmissionDate !== 'No recent activity' && userData.lastSubmissionDate !== '1970-01-01') {
                const lastDate = new Date(userData.lastSubmissionDate);
                if (!isNaN(lastDate.getTime()) && lastDate.getFullYear() >= 2020) {
                    const today = new Date();
                    const diffTime = Math.abs(today - lastDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays === 1) {
                        lastSubmissionEl.textContent = 'Today';
                    } else if (diffDays === 2) {
                        lastSubmissionEl.textContent = 'Yesterday';
                    } else if (diffDays <= 7) {
                        lastSubmissionEl.textContent = `${diffDays - 1} days ago`;
                    } else {
                        lastSubmissionEl.textContent = lastDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                        });
                    }
                } else {
                    lastSubmissionEl.textContent = 'No recent activity';
                }
            } else {
                lastSubmissionEl.textContent = 'No recent activity';
            }
        } else {
            currentStreakEl.textContent = '0';
            longestStreakEl.textContent = '0';
            activeDaysEl.textContent = '0';
            lastSubmissionEl.textContent = 'Never';
        }
    }

    navigateMonth(direction) {
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        this.renderCalendar();
    }

    renderCalendar() {
        const monthYearEl = document.getElementById('calendar-month-year');
        const calendarGrid = document.getElementById('calendar-grid');
        
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        monthYearEl.textContent = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        
        // Clear calendar
        calendarGrid.innerHTML = '';
        
        // Add day headers
        dayNames.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day calendar-day-header';
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });
        
        // Get first day of month and number of days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        // Generate calendar days
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.textContent = date.getDate();
            dayEl.dataset.date = date.toISOString().split('T')[0];
            
            // Add classes based on date
            if (date.getMonth() !== this.currentDate.getMonth()) {
                dayEl.classList.add('other-month');
            }
            
            if (this.isToday(date)) {
                dayEl.classList.add('today');
            }
            
            // Add activity class based on submissions
            if (this.selectedUser && this.userCalendarData[this.selectedUser]) {
                const timestamp = Math.floor(date.getTime() / 1000);
                const submissions = parseInt(this.userCalendarData[this.selectedUser][timestamp]) || 0;
                
                if (submissions === 0) {
                    dayEl.classList.add('no-activity');
                } else if (submissions <= 2) {
                    dayEl.classList.add('low-activity');
                } else if (submissions <= 5) {
                    dayEl.classList.add('medium-activity');
                } else {
                    dayEl.classList.add('high-activity');
                }
                
                dayEl.title = `${submissions} problems solved`;
            } else {
                dayEl.classList.add('no-activity');
            }
            
            calendarGrid.appendChild(dayEl);
        }
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    async selectCalendarDay(dayEl) {
        if (!this.selectedUser) {
            this.showError('Please select a user first');
            return;
        }

        const date = dayEl.dataset.date;
        const timestamp = Math.floor(new Date(date).getTime() / 1000);
        const submissions = parseInt(this.userCalendarData[this.selectedUser][timestamp]) || 0;
        
        // Show submission details
        this.showSubmissionDetails(date, submissions);
    }

    async showSubmissionDetails(date, submissionCount) {
        const detailsEl = document.getElementById('submission-details');
        const selectedDateEl = document.getElementById('selected-date');
        const detailsContent = document.getElementById('details-content');
        
        selectedDateEl.textContent = new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        if (submissionCount === 0) {
            detailsContent.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No submissions on this date</p>';
        } else {
            // Try to fetch detailed submissions for this date
            try {
                const response = await fetch(`/api/leetcode/${this.selectedUser}/acSubmission?limit=50`);
                const data = await response.json();
                
                if (data && data.submission) {
                    // Filter submissions for the selected date
                    const selectedDate = new Date(date);
                    const daySubmissions = data.submission.filter(sub => {
                        const subDate = new Date(sub.timestamp * 1000);
                        return subDate.toDateString() === selectedDate.toDateString();
                    });
                    
                    if (daySubmissions.length > 0) {
                        detailsContent.innerHTML = daySubmissions.map(sub => `
                            <div class="submission-item">
                                <div class="submission-info">
                                    <h5>${sub.title}</h5>
                                    <p>Submitted at ${new Date(sub.timestamp * 1000).toLocaleTimeString()}</p>
                                </div>
                                <div class="submission-difficulty ${this.getDifficultyClass(sub.title)}">
                                    ${this.getDifficultyLevel(sub.title)}
                                </div>
                            </div>
                        `).join('');
                    } else {
                        detailsContent.innerHTML = `
                            <div style="text-align: center; padding: 20px;">
                                <p><strong>${submissionCount}</strong> problems solved on this date</p>
                                <p style="color: var(--text-secondary);">Detailed submission data not available</p>
                            </div>
                        `;
                    }
                } else {
                    detailsContent.innerHTML = `
                        <div style="text-align: center; padding: 20px;">
                            <p><strong>${submissionCount}</strong> problems solved on this date</p>
                            <p style="color: var(--text-secondary);">Detailed submission data not available</p>
                        </div>
                    `;
                }
            } catch (error) {
                detailsContent.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <p><strong>${submissionCount}</strong> problems solved on this date</p>
                        <p style="color: var(--text-secondary);">Unable to fetch detailed submissions</p>
                    </div>
                `;
            }
        }
        
        detailsEl.classList.remove('hidden');
    }

    hideSubmissionDetails() {
        document.getElementById('submission-details').classList.add('hidden');
    }

    getDifficultyClass(title) {
        // This is a simplified approach - in a real app, you'd need to fetch problem difficulty
        const easyKeywords = ['two sum', 'palindrome', 'reverse'];
        const hardKeywords = ['median', 'trap', 'serialize'];
        
        const lowerTitle = title.toLowerCase();
        if (easyKeywords.some(keyword => lowerTitle.includes(keyword))) {
            return 'easy';
        } else if (hardKeywords.some(keyword => lowerTitle.includes(keyword))) {
            return 'hard';
        }
        return 'medium';
    }

    getDifficultyLevel(title) {
        const diffClass = this.getDifficultyClass(title);
        return diffClass.charAt(0).toUpperCase() + diffClass.slice(1);
    }

    async loadPositionData() {
        try {
            this.showLoading(true);
            const response = await fetch('/api/public-leaderboard');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.leaderboard && Array.isArray(data.leaderboard)) {
                this.allPositionData = data.leaderboard;
                this.displayPositionLeaderboard(data.leaderboard);
                this.setupPositionSearch();
                document.getElementById('position').classList.remove('hidden');
                this.scrollToSection('position');
            } else {
                throw new Error('Invalid leaderboard data received');
            }
        } catch (error) {
            console.error('Position data error:', error);
            this.showError(`Failed to load position data: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    setupPositionSearch() {
        const searchInput = document.getElementById('position-search');
        
        // Clear any existing listeners
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        
        newSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            
            if (!searchTerm) {
                this.displayPositionLeaderboard(this.allPositionData);
                return;
            }
            
            const filteredData = this.allPositionData.filter(user => 
                user.username.toLowerCase().includes(searchTerm)
            );
            
            this.displayPositionLeaderboard(filteredData);
            
            // Show message if no results found
            if (filteredData.length === 0) {
                const tbody = document.getElementById('position-body');
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                            <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                            <p>No users found matching "${searchTerm}"</p>
                        </td>
                    </tr>
                `;
            }
        });
        
        // Add search icon and clear button
        const searchContainer = newSearchInput.parentElement;
        searchContainer.style.position = 'relative';
        
        // Add search icon
        const searchIcon = document.createElement('i');
        searchIcon.className = 'fas fa-search';
        searchIcon.style.cssText = `
            position: absolute;
            left: 16px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-secondary);
            pointer-events: none;
        `;
        searchContainer.appendChild(searchIcon);
        
        // Adjust input padding for icon
        newSearchInput.style.paddingLeft = '48px';
    }

    displayPositionLeaderboard(leaderboardData) {
        const tbody = document.getElementById('position-body');
        tbody.innerHTML = '';

        if (!leaderboardData || leaderboardData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <i class="fas fa-users" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>No leaderboard data available</p>
                    </td>
                </tr>
            `;
            return;
        }

        leaderboardData.forEach((user, index) => {
            const row = document.createElement('tr');
            
            // Add entrance animation
            row.style.opacity = '0';
            row.style.transform = 'translateX(-20px)';
            
            const rankDisplay = user.rank <= 3 ? 
                `<div class="rank-badge rank-${user.rank}">${user.rank}</div>` : 
                `<span class="rank-number">#${user.rank}</span>`;
            
            row.innerHTML = `
                <td>${rankDisplay}</td>
                <td>
                    <div class="user-info" style="display: flex; align-items: center; gap: 0.75rem;">
                        <img src="${user.avatar || 'https://via.placeholder.com/50'}" alt="${user.username}" class="user-avatar" 
                             onerror="this.src='https://via.placeholder.com/50'" 
                             style="width: 50px; height: 50px; border-radius: 50%; border: 2px solid #6366f1;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                                <i class="fab fa-leetcode" style="color: #ffa116; font-size: 1.1rem;"></i>
                                <span class="username" style="font-weight: 600; font-size: 1rem;">${user.username}</span>
                            </div>
                            <div style="font-size: 0.75rem; color: #64748b;">
                                LeetCode Student
                            </div>
                        </div>
                    </div>
                </td>
                <td><span class="total-solved" style="font-weight: 600; color: #6366f1; font-size: 1.1rem;">${user.totalSolved || 0}</span></td>
                <td class="difficulty-col easy" style="color: #10b981; font-weight: 500;">${user.easy || 0}</td>
                <td class="difficulty-col medium" style="color: #f59e0b; font-weight: 500;">${user.medium || 0}</td>
                <td class="difficulty-col hard" style="color: #ef4444; font-weight: 500;">${user.hard || 0}</td>
                <td class="contest-rating" style="font-weight: 500;">${user.contestRanking && user.contestRanking > 0 ? user.contestRanking : 'Unrated'}</td>
                <td class="streak-col">
                    <div class="streak-info" style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <div class="current-streak" title="Current Streak: ${user.currentStreak || 0} days" style="display: flex; align-items: center; gap: 0.25rem; font-weight: 500;">
                            <span class="streak-icon">🔥</span>
                            <span class="streak-value">${user.currentStreak || 0}</span>
                            <span class="streak-label" style="font-size: 0.8rem; color: #64748b;">current</span>
                        </div>
                        <div class="longest-streak" title="Longest Streak: ${user.longestStreak || 0} days" style="display: flex; align-items: center; gap: 0.25rem; font-weight: 500; font-size: 0.9rem;">
                            <span class="streak-icon">🏆</span>
                            <span class="streak-value">${user.longestStreak || 0}</span>
                            <span class="streak-label" style="font-size: 0.75rem; color: #64748b;">best</span>
                        </div>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
            
            // Animate row entrance
            setTimeout(() => {
                row.style.transition = 'all 0.4s ease';
                row.style.opacity = '1';
                row.style.transform = 'translateX(0)';
            }, index * 50);
        });
    }

    formatLastSubmissionDate(dateString) {
        if (!dateString || dateString === 'No recent activity' || dateString === '1970-01-01') {
            return '<span class="no-submission">📅 No recent activity</span>';
        }

        // Check if it's a valid date
        const submissionDate = new Date(dateString);
        if (isNaN(submissionDate.getTime()) || submissionDate.getFullYear() < 2020) {
            return '<span class="no-submission">📅 No recent activity</span>';
        }

        const today = new Date();
        const diffTime = Math.abs(today - submissionDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let displayText = '';
        let className = '';

        if (diffDays === 1) {
            displayText = 'Today';
            className = 'recent-submission';
        } else if (diffDays === 2) {
            displayText = 'Yesterday';
            className = 'recent-submission';
        } else if (diffDays <= 7) {
            displayText = `${diffDays - 1} days ago`;
            className = 'recent-submission';
        } else if (diffDays <= 30) {
            displayText = `${diffDays - 1} days ago`;
            className = 'old-submission';
        } else {
            displayText = submissionDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: submissionDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
            });
            className = 'very-old-submission';
        }

        return `
            <div class="last-submission ${className}" title="Last submission: ${submissionDate.toLocaleDateString()}">
                <span class="submission-icon">📅</span>
                <span class="submission-text">${displayText}</span>
            </div>
        `;
    }
}

// Global scroll function for hero CTA
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        const offsetTop = element.offsetTop - 80;
        window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LeaderboardApp();
    
    // Add scroll effect to navbar
    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            navbar.style.backdropFilter = 'blur(20px)';
        } else {
            navbar.style.background = 'var(--glass-bg)';
            navbar.style.backdropFilter = 'blur(20px)';
        }
    });
});