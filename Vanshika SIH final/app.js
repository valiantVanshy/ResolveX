// SQLite-Powered CivicReport System - Main Application Logic
// Add Supabase client (if using CDN script in index.html)
const { createClient } = window.supabase;
console.log("Supabase available?", window.supabase);

class CivicReportSupabaseDB {
    constructor() {
        // Add your Supabase credentials here
        const SUPABASE_URL = 'https://mhyczmxixtvnqzznxucu.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oeWN6bXhpeHR2bnF6em54dWN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNDE4NDcsImV4cCI6MjA3NDkxNzg0N30.dkP_ALejx_JkwhdqMkBxcFKT99K8_6-LyjWv35LJh4Y';

        this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    async init() {
        try {
            // Test connection and initialize default data
            await this.initializeDefaultData();
            console.log('Supabase database initialized successfully');
            return true;
        } catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }

    async initializeDefaultData() {
        // Categories are now managed via SQL - just verify they exist
        const categories = await this.select('categories');
        console.log('Categories loaded from database:', categories.length);
    }


    async insert(tableName, data) {
        const { data: inserted, error } = await this.supabase
            .from(tableName)
            .insert([data])
            .select();
        if (error) throw error;
        return inserted[0];
    }

    async select(tableName, where = null, orderBy = null) {
        let query = this.supabase.from(tableName).select("*");
        
        if (where) {
            Object.entries(where).forEach(([key, value]) => {
                if (typeof value === "object" && value.like) {
                    query = query.ilike(key, `%${value.like}%`);
                } else {
                    query = query.eq(key, value);
                }
            });
        }

        if (orderBy) {
            query = query.order(orderBy.field, { ascending: orderBy.direction !== "DESC" });
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async update(tableName, data, where) {
        let query = this.supabase.from(tableName).update(data);
        if (where) {
            Object.entries(where).forEach(([k, v]) => {
                query = query.eq(k, v);
            });
        }
        const { data: updated, error } = await query.select();
        if (error) throw error;
        return updated;
    }
    

    async delete(table, where) {
        let q = this.supabase.from(table).delete();
        Object.entries(where).forEach(([k,v]) => q = q.eq(k,v));
        const { error } = await q;
        if (error) throw error;
    }



    async count(tableName, where = null) {
        let query = this.supabase.from(tableName).select("*", { count: "exact", head: true });
        if (where) {
            Object.entries(where).forEach(([k, v]) => {
                query = query.eq(k, v);
            });
        }
        const { count, error } = await query;
        if (error) throw error;
        return count;
    }

    async getReportsWithDetails() {
        const reports = await this.select("reports", null, { field: "created_at", direction: "DESC" });
        const categories = await this.select("categories");
        const departments = await this.select("departments");

        return reports.map(report => ({
            ...report,
            category_details: categories.find(c => c.name === report.category),
            department_details: departments.find(d => d.name === report.assigned_department),
        }));
    }

    async getReportStatistics() {
        const reports = await this.select("reports");
        return {
            total: reports.length,
            pending: reports.filter(r => r.status === "Pending").length,
            inProgress: reports.filter(r => r.status === "In Progress").length,
            resolved: reports.filter(r => r.status === "Resolved").length,
            byCategory: reports.reduce((acc, r) => {
                acc[r.category] = (acc[r.category] || 0) + 1;
                return acc;
            }, {}),
            byDepartment: reports.reduce((acc, r) => {
                acc[r.assigned_department] = (acc[r.assigned_department] || 0) + 1;
                return acc;
            }, {}),
            byPriority: reports.reduce((acc, r) => {
                acc[r.priority] = (acc[r.priority] || 0) + 1;
                return acc;
            }, {}),
        };
    }
}


class CivicReportApp {
    constructor() {
        this.db = new CivicReportSupabaseDB();

        this.currentPage = 'landingPage';
        this.currentUser = null;
        this.notifications = [];
        this.map = null;
        this.charts = {};
        this.currentLocation = null;
        this.isInitialized = false;
        this.wsConnection = null; // WebSocket simulation
        this.isSubmitting = false;
    }

    async init() {
        try {
            await this.db.init();
            this.setupEventListeners();
            this.loadNotifications();
            await this.updateStats();
            
            // Start at login selection page instead of landing page
            this.showPage('loginSelectionPage');
            
            this.simulateWebSocket();
            this.isInitialized = true;
            console.log('SQLite-powered CivicReport app initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showToast('Failed to initialize application', 'error');
        }
    }

    simulateWebSocket() {
        // Simulate real-time WebSocket connection
        this.wsConnection = {
            connected: true,
            send: (data) => {
                console.log('WebSocket send:', data);
                // Simulate real-time notifications
                if (data.type === 'report_submitted') {
                    setTimeout(() => {
                        this.showToast('New report received by department', 'success');
                    }, 1000);
                }
            },
            onMessage: (callback) => {
                // Simulate incoming messages
                setInterval(() => {
                    if (this.currentUser && Math.random() > 0.95) {
                        callback({
                            type: 'status_update',
                            message: 'Report status updated'
                        });
                    }
                }, 10000);
            }
        };
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('homeBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showPage('landingPage');
        });
        
        document.getElementById('mapBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showPage('mapPage');
        });
        
        document.getElementById('trackBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showPage('trackPage');
        });
        
        document.getElementById('adminBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showPage('adminLogin');
        });
        
        // Report form
        document.getElementById('reportIssueBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showPage('reportForm');
            // Load categories when showing the form - this fixes the bug
            setTimeout(() => this.loadCategories(), 100);
        });
        
        document.getElementById('cancelReportBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showPage('landingPage');
        });
        
        document.getElementById('issueForm')?.addEventListener('submit', (e) => this.handleReportSubmit(e));
        
        // Photo upload
        document.getElementById('takePhotoBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('photoInput')?.click();
        });
        
        document.getElementById('photoInput')?.addEventListener('change', (e) => this.handlePhotoUpload(e));
        // Inside setupEventListeners() of CivicReportApp class:
        document.getElementById('addDepartmentBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAddDepartmentModal();
        });

        document.getElementById('addCategoryBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAddCategoryModal();
        });
        // Category change to load subcategories
        document.getElementById('category')?.addEventListener('change', (e) => {
            this.loadSubcategories(e.target.value);
        });

        // Location
        document.getElementById('getLocationBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.getCurrentLocation();
        });
        
        // Admin
        document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleAdminLogin(e));
        document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });
        
        // Admin tabs
        document.getElementById('dashboardTab')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAdminTab('dashboard');
        });
        document.getElementById('reportsTab')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAdminTab('reports');
        });
        document.getElementById('analyticsTab')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAdminTab('analytics');
        });
        document.getElementById('usersTab')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAdminTab('users');
        });
        document.getElementById('settingsTab')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAdminTab('settings');
        });
        
        // Track reports
        document.getElementById('loadReportsBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.loadUserReports();
        });
        
        // Modal
        document.getElementById('closeModal')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.hideModal();
        });
        document.getElementById('closeModalBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.hideModal();
        });
        
        // User modal
        document.getElementById('addUserBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showUserModal();
        });
        document.getElementById('closeUserModal')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.hideUserModal();
        });
        document.getElementById('saveUserBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.saveUser();
        });
        document.getElementById('cancelUserBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.hideUserModal();
        });
        // Notification Listeners
        document.getElementById('notificationBell')?.addEventListener('click', () => this.toggleNotificationPanel());
        document.getElementById('markAllReadBtn')?.addEventListener('click', () => this.markAllAsRead());
        
        // Database actions
        document.getElementById('backupDbBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.backupDatabase();
        });
        document.getElementById('clearDataBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.clearDatabase();
        });
        
        // Toast
        document.getElementById('closeToast')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.hideToast();
        });
        // Citizen auth
        document.getElementById('citizenLoginForm')?.addEventListener('submit', (e) => this.handleCitizenLogin(e));
        document.getElementById('citizenRegisterForm')?.addEventListener('submit', (e) => this.handleCitizenRegister(e));

        // Staff login
        document.getElementById('staffLoginForm')?.addEventListener('submit', (e) => this.handleStaffLogin(e));
    }
    
    showLoginType(type) {
        if (type === 'citizen') {
            this.showPage('citizenAuthPage');
        } else if (type === 'staff') {
            this.showPage('staffLoginPage');
        } else if (type === 'admin') {
            this.showPage('adminLogin');
        }
    }

    showAuthTab(tab) {
        const loginTab = document.getElementById('citizenLoginTab');
        const registerTab = document.getElementById('citizenRegisterTab');
        const loginForm = document.getElementById('citizenLoginForm');
        const registerForm = document.getElementById('citizenRegisterForm');
        
        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
        } else {
            loginTab.classList.remove('active');
            registerTab.classList.add('active');
            loginForm.classList.remove('active');
            registerForm.classList.add('active');
        }
    }

    updateNavigation() {
        const navLinks = document.getElementById('navLinks');
        const navbar = document.getElementById('mainNavbar');
        
        if (!this.currentUser) {
            navbar.style.display = 'none';
            return;
        }
        
        navbar.style.display = 'block';
        
        if (this.currentUserRole === 'citizen') {
            navLinks.innerHTML = `
                <button id="homeBtn" class="nav-link active">Home</button>
                <button id="mapBtn" class="nav-link">Map</button>
                <button id="trackBtn" class="nav-link">Track Reports</button>
                <button id="logoutBtn" class="nav-link">Logout</button>
            `;
        } else if (this.currentUserRole === 'staff') {
            navLinks.innerHTML = `
                <button id="homeBtn" class="nav-link active">Home</button>
                <button id="mapBtn" class="nav-link">Map</button>
                <button id="trackBtn" class="nav-link">Track Reports</button>
                <button id="adminBtn" class="nav-link">Staff Dashboard</button>
                <button id="logoutBtn" class="nav-link">Logout</button>
            `;
        } else if (this.currentUserRole === 'admin') {
            navLinks.innerHTML = `
                <button id="homeBtn" class="nav-link active">Home</button>
                <button id="mapBtn" class="nav-link">Map</button>
                <button id="trackBtn" class="nav-link">Track Reports</button>
                <button id="adminBtn" class="nav-link">Admin</button>
                <button id="logoutBtn" class="nav-link">Logout</button>
            `;
        }
        
        // Re-attach event listeners for navigation
        this.setupEventListeners();
    }

    async handleCitizenRegister(e) {
        e.preventDefault();
        
        const name = document.getElementById('citizenRegisterName').value.trim();
        const email = document.getElementById('citizenRegisterEmail').value.trim();
        const password = document.getElementById('citizenRegisterPassword').value.trim();
        const confirmPassword = document.getElementById('citizenRegisterConfirm').value.trim();
        
        if (password !== confirmPassword) {
            this.showToast('Passwords do not match', 'error');
            return;
        }
        
        if (password.length < 6) {
            this.showToast('Password must be at least 6 characters', 'error');
            return;
        }
        
        try {
            const existing = await this.db.select('users', { email });
            if (existing.length > 0) {
                this.showToast('Email already registered', 'error');
                return;
            }
            
            await this.db.insert('users', {
                name,
                email,
                password_hash: password,
                role: 'citizen',
                department: null
            });

            this.addNotification('WELCOME', { name: name });

            this.showToast('Registration successful! Please login', 'success');
            this.showAuthTab('login');
            document.getElementById('citizenRegisterForm').reset();
        } catch (error) {
            console.error('Registration failed:', error);
            this.showToast('Registration failed. Please try again.', 'error');
        }
    }

    async handleCitizenLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('citizenLoginEmail').value.trim();
        const password = document.getElementById('citizenLoginPassword').value.trim();
        
        try {
            const users = await this.db.select('users', { email, role: 'citizen' });
            const user = users.find(u => u.password_hash === password);
            
            if (user) {
                this.currentUser = user;
                this.currentUserRole = 'citizen';
                this.loadNotifications();
                this.updateNavigation();
                this.showPage('landingPage');
                this.showToast(`Welcome back, ${user.name}!`, 'success');
            } else {
                this.showToast('Invalid credentials', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Login failed. Please try again.', 'error');
        }
    }

    async handleStaffLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('staffEmail').value.trim();
        const password = document.getElementById('staffPassword').value.trim();
        
        try {
            const users = await this.db.select('users', { email, role: 'staff' });
            const user = users.find(u => u.password_hash === password);
            
            if (user) {
                this.currentUser = user;
                this.currentUser = user;
                this.currentUserRole = 'staff';
                this.loadNotifications();
                this.updateNavigation();
                this.showPage('adminDashboard');
                document.getElementById('currentUserInfo').textContent = 
                    `Welcome, ${user.name} (Staff - ${user.department})`;
                this.showToast(`Welcome, ${user.name}!`, 'success');
                this.applyRoleBasedPermissions();
            } else {
                this.showToast('Invalid credentials', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Login failed. Please try again.', 'error');
        }
    }
    showPage(pageId) {
        console.log('Showing page:', pageId);
        
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // Update nav active state
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Show selected page
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
        } else {
            console.error('Page not found:', pageId);
            return;
        }
        
        // Update nav active state
        const navMap = {
            'landingPage': 'homeBtn',
            'mapPage': 'mapBtn',
            'trackPage': 'trackBtn',
            'adminLogin': 'adminBtn',
            'adminDashboard': 'adminBtn'
        };
        
        if (navMap[pageId]) {
            const navBtn = document.getElementById(navMap[pageId]);
            if (navBtn) navBtn.classList.add('active');
        }
        
        // Handle page-specific logic
        if (pageId === 'mapPage') {
            setTimeout(() => this.initMap(), 100);
        } else if (pageId === 'adminDashboard') {
            setTimeout(() => this.updateAdminDashboard(), 100);
        }
    }

    async loadCategories() {
        try {
            console.log('Loading categories...');
            const categories = await this.db.select('categories');
            console.log('Categories loaded:', categories);
            
            const categorySelect = document.getElementById('category');
            const mapCategoryFilter = document.getElementById('mapCategoryFilter');
            const adminCategoryFilter = document.getElementById('adminCategoryFilter');
            
            if (categorySelect) {
                categorySelect.innerHTML = '<option value="">Select category...</option>';
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.name;
                    option.textContent = cat.name;
                    categorySelect.appendChild(option);
                });
                console.log('Category select populated with', categories.length, 'categories');
            }
            
            if (mapCategoryFilter) {
                mapCategoryFilter.innerHTML = '<option value="">All Categories</option>';
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.name;
                    option.textContent = cat.name;
                    mapCategoryFilter.appendChild(option);
                });
            }
            
            if (adminCategoryFilter) {
                adminCategoryFilter.innerHTML = '<option value="">All Categories</option>';
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.name;
                    option.textContent = cat.name;
                    adminCategoryFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load categories:', error);
            this.showToast('Failed to load categories', 'error');
        }
    }
    async loadSubcategories(categoryName) {
        try {
            const subcategoryGroup = document.getElementById('subcategoryGroup');
            const subcategorySelect = document.getElementById('subcategory');
            
            if (!categoryName) {
                subcategoryGroup.style.display = 'none';
                subcategorySelect.required = false;
                return;
            }
            
            const subcategories = await this.db.select('subcategories', { category_name: categoryName });
            
            if (subcategories.length > 0) {
                subcategoryGroup.style.display = 'block';
                subcategorySelect.required = true;
                subcategorySelect.innerHTML = '<option value="">Select specific issue...</option>';
                
                subcategories.forEach(sub => {
                    const option = document.createElement('option');
                    option.value = sub.subcategory_name;
                    option.textContent = sub.subcategory_name;
                    if (sub.description) {
                        option.title = sub.description;
                    }
                    subcategorySelect.appendChild(option);
                });
            } else {
                subcategoryGroup.style.display = 'none';
                subcategorySelect.required = false;
            }
        } catch (error) {
            console.error('Failed to load subcategories:', error);
        }
    }
    async deleteReport(id) {
        if (this.currentUserRole !== 'admin') {
            return this.showToast('Only admins can delete reports', 'error');
        }
        if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
            return;
        }
        try {
            await this.db.delete('reports', { id });
            this.showToast('Report deleted successfully', 'success');
            this.hideModal();
            this.loadReportsManagement();
            this.updateAdminDashboard();
        } catch (error) {
            console.error('Delete failed:', error);
            this.showToast('Failed to delete report', 'error');
        }
    }

    async deleteUser(id) {
        if (this.currentUserRole !== 'admin') {
            return this.showToast('Only admins can delete users', 'error');
        }
        if (id === this.currentUser.id) {
            return this.showToast('Cannot delete your own account', 'error');
        }
        if (!confirm('Are you sure you want to delete this user?')) {
            return;
        }
        try {
            await this.db.delete('users', { id });
            this.showToast('User deleted successfully', 'success');
            this.loadUsersManagement();
        } catch (error) {
            console.error('Delete failed:', error);
            this.showToast('Failed to delete user', 'error');
        }
    }

    async handleReportSubmit(e) {
        e.preventDefault();
        
        // Prevent duplicate submissions
        if (this.isSubmitting) {
            return;
        }
        this.isSubmitting = true;
        
        // Disable submit button and show loading state
        const submitBtn = document.querySelector('#issueForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }
        
        try {
            const photoFile = document.getElementById('photoInput').files[0];
            
            const report = {
                title: document.getElementById('title').value.trim(),
                description: document.getElementById('description').value.trim(),
                category: document.getElementById('category').value,
                subcategory: document.getElementById('subcategory')?.value || null,
                priority: document.getElementById('priority').value,
                citizen_contact: document.getElementById('contactEmail').value.trim(),
                latitude: this.currentLocation?.lat || null,
                longitude: this.currentLocation?.lng || null,
                address: this.currentLocation?.address || document.getElementById('manualAddress').value.trim(),
                photo_path: photoFile ? await this.convertToBase64(photoFile) : null,
                internal_notes: ''
            };

            // Auto-assign department based on category
            try {
                const categories = await this.db.select('categories');
                const category = categories.find(c => c.name === report.category);
                if (category) {
                    report.assigned_department = category.department_mapping;
                }
            } catch (error) {
                console.error('Failed to assign department:', error);
            }

            // Submit the report
            const insertedReport = await this.db.insert('reports', report);
            this.addNotification('NEW_REPORT', insertedReport);
            this.showToast(`Report #${insertedReport.id || insertedReport} submitted successfully! Department has been notified.`, 'success');
            this.resetReportForm();
            this.showPage('landingPage');
            await this.updateStats();

            // Simulate WebSocket notification
            if (this.wsConnection) {
                this.wsConnection.send({
                    type: 'report_submitted',
                    reportId: reportId.id || reportId,
                    department: report.assigned_department
                });
            }
            
        } catch (error) {
            console.error('Failed to submit report:', error);
            this.showToast('Failed to submit report. Please try again.', 'error');
        } finally {
            // Always reset submission state and re-enable button
            this.isSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Report';
            }
        }
    }

    async handlePhotoUpload(e) {
        const file = e.target.files[0];
        if (file) {
            // Validate file
            if (!file.type.startsWith('image/')) {
                this.showToast('Please select a valid image file', 'error');
                return;
            }
            
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                this.showToast('Image file too large. Please select a file under 5MB', 'error');
                return;
            }
            
            const preview = document.getElementById('photoPreview');
            const reader = new FileReader();
            
            reader.onload = (e) => {
                preview.innerHTML = `<img src="${e.target.result}" alt="Photo preview">`;
                preview.classList.remove('hidden');
            };
            
            reader.readAsDataURL(file);
        }
    }

    async convertToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    getCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        // ✅ FIXED: Changed from toFixed(6) to toFixed(15)
                        address: `${position.coords.latitude.toFixed(15)}, ${position.coords.longitude.toFixed(15)}`
                    };
                    const locationDisplay = document.getElementById('locationDisplay');
                    if (locationDisplay) {
                        locationDisplay.innerHTML = `📍 Location captured: ${this.currentLocation.address}`;
                        locationDisplay.classList.add('active');
                    }
                    this.showToast('Location captured successfully!', 'success');
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    
                    // ✅ IMPROVED: Better error handling
                    let errorMessage = 'Failed to get location. ';
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = 'Location access denied. Please enable location services and refresh the page.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Location information unavailable. Check your internet connection.';
                            break;
                        case error.TIMEOUT:
                            errorMessage = 'Location request timed out. Please try again.';
                            break;
                        default:
                            errorMessage = 'Unknown location error occurred.';
                            break;
                    }
                    this.showToast(errorMessage, 'error');
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000, // ✅ INCREASED: from 10s to 15s
                    maximumAge: 300000
                }
            );
        } else {
            this.showToast('Geolocation is not supported by this browser.', 'error');
        }
    }


    async handleAdminLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value.trim();
        
        try {
            const users = await this.db.select('users');
            const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password_hash === password);
            
            if (user) {
                this.currentUser = user;
                this.currentUser = user;
                this.currentUserRole = 'admin';  // Add this line                      // store role
                this.loadNotifications();
                this.updateNavigation();
                document.getElementById('currentUserInfo').textContent =
                    `Welcome, ${user.name} (${user.role})`;
                this.showPage('adminDashboard');
                this.showToast(`Login successful! Welcome, ${user.name}`, 'success');
                this.applyRoleBasedPermissions();                       // apply UI restrictions
            } else {
                this.showToast('Invalid credentials.', 'error');
            }

        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Login failed. Please try again.', 'error');
        }
    }
    applyRoleBasedPermissions() {
        const isAdmin = this.currentUserRole === 'admin';
        const isStaff = this.currentUserRole === 'staff';

        // Users Tab
        document.getElementById('usersTab').style.display = isAdmin ? 'block' : 'none';
        // Add User button
        document.getElementById('addUserBtn').style.display = isAdmin ? 'inline-block' : 'none';
        // Export section
        document.getElementById('exportSection').style.display = (isAdmin || isStaff) ? 'block' : 'none';
    }


    handleLogout() {
        this.currentUser = null;
        this.currentUserRole = null;
        const currentUserInfo = document.getElementById('currentUserInfo');
        if (currentUserInfo) {
            currentUserInfo.textContent = 'Welcome, Admin';
        }
        this.showPage('loginSelectionPage');
        this.showToast('Logged out successfully', 'success');
    }

    // ===============================================
    // == NOTIFICATION SYSTEM
    // ===============================================

    toggleNotificationPanel() {
        const panel = document.getElementById('notificationPanel');
        panel?.classList.toggle('hidden');
    }

    loadNotifications() {
        if (!this.currentUser) return;
        const savedNotifications = localStorage.getItem(`notifications_${this.currentUser.email}`);
        this.notifications = savedNotifications ? JSON.parse(savedNotifications) : [];
        this.renderNotifications();
    }

    saveNotifications() {
        if (!this.currentUser) return;
        localStorage.setItem(`notifications_${this.currentUser.email}`, JSON.stringify(this.notifications));
    }

    addNotification(type, data) {
        const notification = {
            id: Date.now(),
            type: type,
            message: this.getNotificationMessage(type, data),
            icon: this.getNotificationIcon(type),
            timestamp: new Date().toISOString(),
            read: false,
            reportId: data.id || null
        };

        this.notifications.unshift(notification); // Add to the beginning of the array
        if (this.notifications.length > 50) { // Keep only the latest 50
            this.notifications.pop();
        }

        this.renderNotifications();
        this.saveNotifications();
    }

    getNotificationMessage(type, data) {
        switch (type) {
            case 'NEW_REPORT':
                return `New report submitted: <strong>"${data.title}"</strong> in the ${data.category} category.`;
            case 'STATUS_UPDATE':
                return `The status of your report <strong>"${data.title}"</strong> has been updated to <strong>${data.status}</strong>.`;
            case 'REASSIGNMENT':
                return `Report <strong>"${data.title}"</strong> has been assigned to the <strong>${data.assigned_department}</strong> department.`;
            case 'WELCOME':
                 return `Welcome to CivicReport, ${data.name}! Start by reporting an issue.`;
            default:
                return 'You have a new notification.';
        }
    }

    getNotificationIcon(type) {
        const icons = {
            'NEW_REPORT': {
                bg: '#2563EB', // Blue
                svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>`
            },
            'STATUS_UPDATE': {
                bg: '#16A34A', // Green
                svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
            },
            'REASSIGNMENT': {
                bg: '#F97316', // Orange
                svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>`
            },
            'WELCOME': {
                bg: '#7C3AED', // Violet
                svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`
            }
        };
        return icons[type] || icons['NEW_REPORT'];
    }

    renderNotifications() {
        const list = document.getElementById('notificationList');
        const badge = document.getElementById('notificationBadge');
        if (!list || !badge) return;

        const unreadCount = this.notifications.filter(n => !n.read).length;

        // Update badge
        badge.textContent = unreadCount;
        if (unreadCount > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        // Update list
        if (this.notifications.length === 0) {
            list.innerHTML = `<div class="empty-state"><p>You have no new notifications.</p></div>`;
        } else {
            list.innerHTML = this.notifications.map(n => {
                const icon = this.getNotificationIcon(n.type);
                const timeAgo = this.formatTimeAgo(n.timestamp);
                return `
                    <div class="notification-item ${n.read ? 'read' : 'unread'}" data-id="${n.id}">
                        <div class="notification-logo" style="background-color: ${icon.bg};">
                            ${icon.svg}
                        </div>
                        <div class="notification-content">
                            <p>${n.message}</p>
                            <span class="timestamp">${timeAgo}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.renderNotifications();
        this.saveNotifications();
    }
    
    formatTimeAgo(isoString) {
        const date = new Date(isoString);
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return "Just now";
    }

    async updateStats() {
        try {
            const stats = await this.db.getReportStatistics();
            
            // Calculate average resolution time (mock calculation based on resolved reports)
            const avgResolutionTime = stats.resolved > 0 ? Math.floor(Math.random() * 3) + 2 : 0;
            
            const elements = {
                totalReports: document.getElementById('totalReports'),
                resolvedReports: document.getElementById('resolvedReports'),
                avgResolutionTime: document.getElementById('avgResolutionTime'),
                pendingReports: document.getElementById('pendingReports')
            };
            
            if (elements.totalReports) elements.totalReports.textContent = stats.total;
            if (elements.resolvedReports) elements.resolvedReports.textContent = stats.resolved;
            if (elements.avgResolutionTime) elements.avgResolutionTime.textContent = avgResolutionTime;
            if (elements.pendingReports) elements.pendingReports.textContent = stats.pending;
        } catch (error) {
            console.error('Failed to update stats:', error);
        }
    }

    async initMap() {
        if (this.map) {
            this.map.remove();
        }
        
        const mapContainer = document.getElementById('mapContainer');
        if (!mapContainer) return;
        
        this.map = L.map('mapContainer').setView([20.5937, 78.9629], 5);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        await this.loadMapReports();
        this.setupMapFilters();
        this.setupMapLegend();
    }

    async loadMapReports() {
        try {
            const reports = await this.db.select('reports');
            const categoryColors = {
                'Education': '#FF6B6B',
                'Healthcare': '#4ECDC4',
                'Drinking Water': '#45B7D1',
                'Sanitation': '#96CEB4',
                'Electricity': '#FFEAA7',
                'Roads & Connectivity': '#DFE6E9',
                'Skill Development': '#A29BFE',
                'Agriculture & Livelihood': '#6C5CE7',
                'Housing': '#FD79A8',
                'Social Welfare': '#FDCB6E'
            };
            
            reports.forEach(report => {
                if (report.latitude && report.longitude && this.map) {
                    const marker = L.circleMarker([report.latitude, report.longitude], {
                        radius: this.getPriorityRadius(report.priority),
                        fillColor: categoryColors[report.category] || '#964325',
                        color: this.getStatusColor(report.status),
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(this.map);
                    marker.on('click', function(e) {
                        this.map.setView([report.latitude, report.longitude], 16, {
                            animate: true,
                            duration: 1.0
                        });
                    }.bind(this));
                    marker.bindPopup(`
                        <div class="map-popup">
                            <h4>${report.title}</h4>
                            <p><strong>Category:</strong> ${report.category}</p>
                            <p><strong>Priority:</strong> ${report.priority}</p>
                            <p><strong>Status:</strong> ${report.status}</p>
                            <p><strong>Department:</strong> ${report.assigned_department}</p>
                            <p><strong>Description:</strong> ${report.description}</p>
                            <p><strong>Reported:</strong> ${new Date(report.created_at).toLocaleDateString()}</p>
                            ${report.address ? `<p><strong>Address:</strong> ${report.address}</p>` : ''}
                        </div>
                    `);
                }
            });
        } catch (error) {
            console.error('Failed to load map reports:', error);
        }
    }

    getPriorityRadius(priority) {
        switch(priority) {
            case 'Emergency': return 12;
            case 'High': return 10;
            case 'Medium': return 8;
            case 'Low': return 6;
            default: return 8;
        }
    }

    getStatusColor(status) {
        switch(status) {
            case 'Pending': return '#FFC185';
            case 'In Progress': return '#1FB8CD';
            case 'Resolved': return '#5D878F';
            default: return '#964325';
        }
    }

    setupMapFilters() {
        this.loadCategories();
        
        const categoryFilter = document.getElementById('mapCategoryFilter');
        const statusFilter = document.getElementById('mapStatusFilter');
        const priorityFilter = document.getElementById('mapPriorityFilter');
        
        [categoryFilter, statusFilter, priorityFilter].forEach(filter => {
            if (filter) {
                filter.addEventListener('change', () => this.filterMapReports());
            }
        });
    }

    async filterMapReports() {
        // Clear existing markers
        this.map.eachLayer(layer => {
            if (layer instanceof L.CircleMarker) {
                this.map.removeLayer(layer);
            }
        });
        
        // Get filter values
        const categoryFilter = document.getElementById('mapCategoryFilter')?.value;
        const statusFilter = document.getElementById('mapStatusFilter')?.value;
        const priorityFilter = document.getElementById('mapPriorityFilter')?.value;
        
        // Build where clause
        const where = {};
        if (categoryFilter) where.category = categoryFilter;
        if (statusFilter) where.status = statusFilter;
        if (priorityFilter) where.priority = priorityFilter;
        
        try {
            const filteredReports = await this.db.select('reports', Object.keys(where).length ? where : null);
            
            const categoryColors = {
                'Potholes': '#1FB8CD',
                'Street Lights': '#FFC185',
                'Trash Collection': '#B4413C',
                'Water Issues': '#ECEBD5',
                'Traffic Signs': '#5D878F',
                'Graffiti': '#DB4545',
                'Parks & Recreation': '#D2BA4C',
                'Other': '#964325'
            };
            
            filteredReports.forEach(report => {
                if (report.latitude && report.longitude) {
                    const marker = L.circleMarker([report.latitude, report.longitude], {
                        radius: this.getPriorityRadius(report.priority),
                        fillColor: categoryColors[report.category] || '#964325',
                        color: this.getStatusColor(report.status),
                        weight: 2,
                        opacity: 1, 
                        fillOpacity: 0.8
                    }).addTo(this.map);
                    
                    marker.bindPopup(`
                        <div class="map-popup">
                            <h4>${report.title}</h4>
                            <p><strong>Category:</strong> ${report.category}</p>
                            ${report.subcategory ? `<p><strong>Issue:</strong> ${report.subcategory}</p>` : ''}
                            <p><strong>Priority:</strong> ${report.priority}</p>
                            <p><strong>Status:</strong> ${report.status}</p>
                            <p><strong>Department:</strong> ${report.assigned_department}</p>
                            <p><strong>Description:</strong> ${report.description}</p>
                            <p><strong>Reported:</strong> ${new Date(report.created_at).toLocaleDateString()}</p>
                            ${report.address ? `<p><strong>Location:</strong> ${report.address}</p>` : ''}
                        </div>
                    `);
                }
            });
        } catch (error) {
            console.error('Failed to filter map reports:', error);
        }
    }

    setupMapLegend() {
        const legendItems = document.querySelector('.legend-items');
        if (!legendItems) return;
        
        const categoryColors = {
            'Education': '#FF6B6B',
            'Healthcare': '#4ECDC4',
            'Drinking Water': '#45B7D1',
            'Sanitation': '#96CEB4',
            'Electricity': '#FFEAA7',
            'Roads & Connectivity': '#DFE6E9',
            'Skill Development': '#A29BFE',
            'Agriculture & Livelihood': '#6C5CE7',
            'Housing': '#FD79A8',
            'Social Welfare': '#FDCB6E'
        };
        
        legendItems.innerHTML = '';
        Object.entries(categoryColors).forEach(([category, color]) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.innerHTML = `
                <div class="legend-color" style="background-color: ${color}"></div>
                <span>${category}</span>
            `;
            legendItems.appendChild(legendItem);
        });
    }

    async loadUserReports() {
        const emailInput = document.getElementById('trackingEmail');
        const container = document.getElementById('userReports');
        
        if (!emailInput || !container) return;
        
        const email = emailInput.value.trim();
        if (!email) {
            this.showToast('Please enter your email address', 'error');
            return;
        }
        
        try {
            const reports = await this.db.select('reports', {citizen_contact: email}, {field: 'created_at', direction: 'DESC'});
            
            if (reports.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary); padding: var(--space-24);">No reports found for this email address.</p>';
                return;
            }
            
            container.innerHTML = reports.map(report => `
                <div class="report-item">
                    <div class="report-header">
                        <div class="report-title">${report.title}</div>
                        <div class="report-tags">
                            <span class="report-tag">${report.status}</span>
                            <span class="report-tag priority-${report.priority.toLowerCase()}">${report.priority}</span>
                        </div>
                    </div>
                    <div class="report-meta">
                        <span><strong>Category:</strong> ${report.category}</span>
                        <span><strong>Department:</strong> ${report.assigned_department}</span>
                        <span><strong>Reported:</strong> ${new Date(report.created_at).toLocaleDateString()}</span>
                        <span><strong>ID:</strong> #${report.id}</span>
                    </div>
                    <div class="report-description">${report.description}</div>
                    ${report.address ? `<p><small><strong>Location:</strong> ${report.address}</small></p>` : ''}
                    ${report.internal_notes ? `<p><small><strong>Latest Update:</strong> ${report.internal_notes}</small></p>` : ''}
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load user reports:', error);
            this.showToast('Failed to load reports', 'error');
        }
    }

    showAdminTab(tabName) {
        // Update tab active state
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = document.getElementById(`${tabName}Tab`);
        if (activeTab) activeTab.classList.add('active');
        
        // Show content
        document.querySelectorAll('.admin-content').forEach(content => {
            content.classList.remove('active');
        });
        const activeContent = document.getElementById(`${tabName}Content`);
        if (activeContent) activeContent.classList.add('active');
        
        // Load content
        setTimeout(() => {
            if (tabName === 'dashboard') {
                this.updateAdminDashboard();
            } else if (tabName === 'reports') {
                this.loadReportsManagement();
            } else if (tabName === 'analytics') {
                this.loadAnalytics();
            } else if (tabName === 'users') {
                this.loadUsersManagement();
            } else if (tabName === 'settings') {
                this.loadSettings();
            }
        }, 100);
    }

    async updateAdminDashboard() {
        try {
            const stats = await this.db.getReportStatistics();
            
            // Update metrics
            const elements = {
                adminTotalReports: document.getElementById('adminTotalReports'),
                adminPendingReports: document.getElementById('adminPendingReports'),
                adminInProgressReports: document.getElementById('adminInProgressReports'),
                adminResolvedReports: document.getElementById('adminResolvedReports')
            };
            
            if (elements.adminTotalReports) elements.adminTotalReports.textContent = stats.total;
            if (elements.adminPendingReports) elements.adminPendingReports.textContent = stats.pending;
            if (elements.adminInProgressReports) elements.adminInProgressReports.textContent = stats.inProgress;
            if (elements.adminResolvedReports) elements.adminResolvedReports.textContent = stats.resolved;
            
            // Load urgent issues
            const urgentReports = await this.db.select('reports', null, {field: 'created_at', direction: 'DESC'});
            const urgentIssues = urgentReports.filter(r => 
                (r.priority === 'High' || r.priority === 'Emergency') && r.status !== 'Resolved'
            ).slice(0, 5);
            
            const urgentContainer = document.getElementById('urgentIssues');
            if (urgentContainer) {
                if (urgentIssues.length === 0) {
                    urgentContainer.innerHTML = '<p style="color: var(--color-text-secondary); font-style: italic;">No urgent issues at this time.</p>';
                } else {
                    urgentContainer.innerHTML = urgentIssues.map(issue => `
                        <div class="urgent-issue">
                            <div class="urgent-issue-info">
                                <div class="urgent-issue-title">${issue.title}</div>
                                <div class="urgent-issue-meta">${issue.category} • ${issue.priority} Priority • ${issue.assigned_department}</div>
                            </div>
                            <button class="btn btn--sm btn--primary" onclick="app.showReportModal(${issue.id})">View</button>
                        </div>
                    `).join('');
                }
            }
            
            // Load recent reports
            const recentReports = urgentReports.slice(0, 5);
            const recentContainer = document.getElementById('recentReports');
            if (recentContainer) {
                recentContainer.innerHTML = recentReports.map(report => `
                    <div class="report-item" style="cursor: pointer;" onclick="app.showReportModal(${report.id})">
                        <div class="report-header">
                            <div class="report-title">${report.title}</div>
                            <div class="report-tags">
                                <span class="report-tag">${report.status}</span>
                            </div>
                        </div>
                        <div class="report-meta">
                            <span>${report.category}</span>
                            <span>${new Date(report.created_at).toLocaleDateString()}</span>
                            <span>${report.assigned_department}</span>
                        </div>
                    </div>
                `).join('');
            }
            
            // Load department workload
            const workloadContainer = document.getElementById('departmentWorkload');
            if (workloadContainer) {
                const departments = await this.db.select('departments');
                
                workloadContainer.innerHTML = departments.map(dept => {
                    const deptReports = urgentReports.filter(r => r.assigned_department === dept.name);
                    const pending = deptReports.filter(r => r.status === 'Pending').length;
                    const inProgress = deptReports.filter(r => r.status === 'In Progress').length;
                    
                    return `
                        <div class="department-card">
                            <div class="department-name">${dept.name}</div>
                            <div class="department-stats">
                                <span>Pending: ${pending}</span>
                                <span>In Progress: ${inProgress}</span>
                                <span>Total: ${deptReports.length}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Failed to update admin dashboard:', error);
        }
    }

    async loadReportsManagement() {
        try {
            this.loadCategories();
            await this.loadDepartmentFilters();
            this.setupReportsFilters();
            
            const reports = await this.db.getReportsWithDetails();
            this.renderReportsTable(reports);
        } catch (error) {
            console.error('Failed to load reports management:', error);
        }
    }

    async loadDepartmentFilters() {
        try {
            const departments = await this.db.select('departments');
            const adminDepartmentFilter = document.getElementById('adminDepartmentFilter');
            
            if (adminDepartmentFilter) {
                adminDepartmentFilter.innerHTML = '<option value="">All Departments</option>';
                departments.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept.name;
                    option.textContent = dept.name;
                    adminDepartmentFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load department filters:', error);
        }
    }

    setupReportsFilters() {
        const filters = ['adminCategoryFilter', 'adminStatusFilter', 'adminDepartmentFilter'];
        const searchInput = document.getElementById('searchReports');
        
        filters.forEach(filterId => {
            const filter = document.getElementById(filterId);
            if (filter) {
                filter.removeEventListener('change', this.filterReports.bind(this));
                filter.addEventListener('change', this.filterReports.bind(this));
            }
        });
        
        if (searchInput) {
            searchInput.removeEventListener('input', this.filterReports.bind(this));
            searchInput.addEventListener('input', this.debounce(this.filterReports.bind(this), 300));
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async filterReports() {
        try {
            let reports = await this.db.getReportsWithDetails();
            
            const categoryValue = document.getElementById('adminCategoryFilter')?.value;
            const statusValue = document.getElementById('adminStatusFilter')?.value;
            const departmentValue = document.getElementById('adminDepartmentFilter')?.value;
            const searchTerm = document.getElementById('searchReports')?.value.toLowerCase().trim();
            
            if (categoryValue) {
                reports = reports.filter(r => r.category === categoryValue);
            }
            
            if (statusValue) {
                reports = reports.filter(r => r.status === statusValue);
            }
            
            if (departmentValue) {
                reports = reports.filter(r => r.assigned_department === departmentValue);
            }
            
            if (searchTerm) {
                reports = reports.filter(r => 
                    r.title.toLowerCase().includes(searchTerm) || 
                    r.description.toLowerCase().includes(searchTerm) ||
                    r.address?.toLowerCase().includes(searchTerm)
                );
            }
            
            this.renderReportsTable(reports);
        } catch (error) {
            console.error('Failed to filter reports:', error);
        }
    }

    renderReportsTable(reports) {
        const isAdmin = this.currentUserRole === 'admin';
        const isStaff = this.currentUserRole === 'staff';

        const container = document.getElementById('reportsTable');
        if (!container) return;
        
        if (reports.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: var(--space-24); color: var(--color-text-secondary);">No reports found matching your criteria.</p>';
            return;
        }
        
        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Issue</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Department</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${reports.map(report => `
                        <tr>
                            <td>#${report.id}</td>
                            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${report.title}">${report.title}</td>
                            <td>${report.category}</td>
                            <td style="font-size: 0.85em;">${report.subcategory || 'N/A'}</td>
                            <td>
                                ${(isAdmin||isStaff) ? `
                                    <select class="priority-selector" data-id="${report.id}"
                                    onchange="app.updateReportPriority(${report.id}, this.value)">
                                    <option value="Low" ${report.priority==='Low'?'selected':''}>Low</option>
                                    <option value="Medium" ${report.priority==='Medium'?'selected':''}>Medium</option>
                                    <option value="High" ${report.priority==='High'?'selected':''}>High</option>
                                    <option value="Emergency" ${report.priority==='Emergency'?'selected':''}>Emergency</option>
                                    </select>
                                ` : `<span>${report.priority}</span>`}
                            </td>
                            <td><span class="status status--${this.getStatusClass(report.status)}">${report.status}</span></td>
                            <td>${report.assigned_department}</td>
                            <td>${new Date(report.created_at).toLocaleDateString()}</td>
                            <td>
                                <div class="table-actions">
                                    <button class="btn btn-sm btn--primary" onclick="app.showReportModal(${report.id})">View</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    async updateReportPriority(id, value) {
        try {
            await this.db.update('reports', { priority: value }, { id });
            this.showToast('Priority updated successfully', 'success');
            this.loadReportsManagement();
        } catch (error) {
            console.error('Priority update failed:', error);
            this.showToast('Failed to update priority', 'error');
        }
    }

    getStatusClass(status) {
        switch(status) {
            case 'Pending': return 'info';
            case 'In Progress': return 'warning';
            case 'Resolved': return 'success';
            default: return 'info';
        }
    }

    async showReportModal(reportId) {
        try {
            const reports = await this.db.select('reports');
            const report = reports.find(r => r.id === reportId);
            
            if (!report) {
                this.showToast('Report not found', 'error');
                return;
            }
            
            const modalBody = document.getElementById('reportModalBody');
            if (!modalBody) return;
            
            modalBody.innerHTML = `
                <div class="report-details">
                    <h4>${report.title}</h4>
                    <div class="report-meta">
                        <p><strong>ID:</strong> #${report.id}</p>
                        <p><strong>Category:</strong> ${report.category}</p>
                        ${report.subcategory ? `<p><strong>Specific Issue:</strong> ${report.subcategory}</p>` : ''}
                        <p><strong>Priority:</strong> ${report.priority}</p>
                        <p><strong>Status:</strong> ${report.status}</p>
                        <p><strong>Department:</strong> ${report.assigned_department}</p>
                        <p><strong>Created:</strong> ${new Date(report.created_at).toLocaleString()}</p>
                        <p><strong>Updated:</strong> ${new Date(report.updated_at).toLocaleString()}</p>
                        <p><strong>Contact:</strong> ${report.citizen_contact || 'Anonymous'}</p>
                    </div>
                    ${report.address ? `<p><strong>Village/Location:</strong> ${report.address}</p>` : ''}
                    ${report.latitude && report.longitude ? `<p><strong>Coordinates:</strong> ${report.latitude}, ${report.longitude}</p>` : ''}
                    <div class="report-description">
                        <strong>Description:</strong>
                        <p>${report.description}</p>
                    </div>
                    ${report.photo_path ? `
                        <div class="report-photo">
                            <strong>Photo:</strong>
                            <img src="${report.photo_path}" alt="Report photo" style="max-width: 100%; height: auto; border-radius: var(--radius-base); margin-top: var(--space-8);">
                        </div>
                    ` : ''}
                    <div class="status-update-form">
                        <label for="modalStatusSelect">Update Status:</label>
                        <select id="modalStatusSelect" class="form-control">
                            <option value="Pending" ${report.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="In Progress" ${report.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Resolved" ${report.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                        </select>
                        <label for="modalDepartmentSelect">Assign Department:</label>
                        <select id="modalDepartmentSelect" class="form-control">
                            ${await this.getDepartmentOptions(report.assigned_department)}
                        </select>
                        <label for="modalNotesText">Internal Notes:</label>
                        <textarea id="modalNotesText" class="form-control" rows="3" placeholder="Add internal notes...">${report.internal_notes || ''}</textarea>
                    </div>
                </div>
            `;
            
            const updateBtn = document.getElementById('updateStatusBtn');
            if (updateBtn) {
                updateBtn.onclick = () => this.updateModalReport(reportId);
            }
            
            // Add delete button for admins
            const modal = document.getElementById('reportModal');
            const modalFooter = modal.querySelector('.modal-footer');
            if (this.currentUserRole === 'admin' && modalFooter) {
                // Remove existing delete button if any
                const existingDeleteBtn = document.getElementById('deleteReportBtn');
                if (existingDeleteBtn) {
                    existingDeleteBtn.remove();
                }
                
                // Create new delete button
                const deleteBtn = document.createElement('button');
                deleteBtn.id = 'deleteReportBtn';
                deleteBtn.className = 'btn btn--outline';
                deleteBtn.style.marginRight = 'auto';
                deleteBtn.style.color = 'var(--color-error)';
                deleteBtn.style.borderColor = 'var(--color-error)';
                deleteBtn.textContent = 'Delete Report';
                deleteBtn.onclick = () => this.deleteReport(reportId);
                
                // Insert at the beginning of modal footer
                modalFooter.insertBefore(deleteBtn, modalFooter.firstChild);
            }
            
            this.showModal();
        } catch (error) {
            console.error('Failed to show report modal:', error);
            this.showToast('Failed to load report details', 'error');
        }
    }

    async getDepartmentOptions(currentDepartment) {
        try {
            const departments = await this.db.select('departments');
            return departments.map(dept => `
                <option value="${dept.name}" ${dept.name === currentDepartment ? 'selected' : ''}>${dept.name}</option>
            `).join('');
        } catch (error) {
            console.error('Failed to get department options:', error);
            return `<option value="${currentDepartment}" selected>${currentDepartment}</option>`;
        }
    }

    async updateModalReport(reportId) {
        try {
            const statusSelect = document.getElementById('modalStatusSelect');
            const departmentSelect = document.getElementById('modalDepartmentSelect');
            const notesText = document.getElementById('modalNotesText');
            
            if (!statusSelect || !departmentSelect || !notesText) {
                this.showToast('Form elements not found', 'error');
                return;
            }

            // Build update object with only the fields we want to change
            const updateData = {
                status: statusSelect.value,
                assigned_department: departmentSelect.value,
                internal_notes: notesText.value
            };

            // Store old values for the success message
            const reports = await this.db.select('reports', { id: reportId });
            const oldReport = reports[0];
            
            if (!oldReport) {
                this.showToast('Report not found', 'error');
                return;
            }

            const oldStatus = oldReport.status;
            const oldDepartment = oldReport.assigned_department;
            
            // Perform the update
            await this.db.update('reports', updateData, { id: reportId });
            
            // Build success message
            let message = 'Report updated successfully';
            if (oldStatus !== updateData.status) {
                message += ` - Status changed to ${updateData.status}`;
            }
            if (oldDepartment !== updateData.assigned_department) {
                message += ` - Reassigned to ${updateData.assigned_department}`;
            }
            
            this.showToast(message, 'success');
            this.hideModal();
            this.updateAdminDashboard();
            this.loadReportsManagement();
            
            // Simulate WebSocket notification
            if (this.wsConnection) {
                this.wsConnection.send({
                    type: 'status_update',
                    reportId,
                    newStatus: updateData.status,
                    department: updateData.assigned_department
                });
            }
        } catch (error) {
            console.error('Failed to update report:', error);
            this.showToast('Failed to update report: ' + error.message, 'error');
        }
    }

    showModal() {
        const modal = document.getElementById('reportModal');
        if (modal) modal.classList.remove('hidden');
    }

    hideModal() {
        const modal = document.getElementById('reportModal');
        if (modal) modal.classList.add('hidden');
    }

    async loadAnalytics() {
        try {
            const stats = await this.db.getReportStatistics();
            
            // Update analytics summary
            const avgResponseTime = document.getElementById('avgResponseTime');
            const resolutionRate = document.getElementById('resolutionRate');
            const satisfactionRate = document.getElementById('satisfactionRate');
            
            if (avgResponseTime) avgResponseTime.textContent = (2.3 + Math.random() * 0.4).toFixed(1);
            if (resolutionRate) resolutionRate.textContent = Math.floor(87 + Math.random() * 10);
            if (satisfactionRate) satisfactionRate.textContent = (4.2 + Math.random() * 0.6).toFixed(1);
            
            // Create charts
            setTimeout(() => {
                this.createReportsChart();
                this.createCategoryChart(stats);
                this.createResolutionChart();
                this.createDepartmentChart(stats);
            }, 100);
        } catch (error) {
            console.error('Failed to load analytics:', error);
        }
    }

    async createReportsChart() {
        const canvas = document.getElementById('reportsChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts.reports) {
            this.charts.reports.destroy();
        }
        
        try {
            const reports = await this.db.select('reports', null, {field: 'created_at', direction: 'ASC'});
            
            // Group reports by month
            const monthlyData = {};
            reports.forEach(report => {
                const date = new Date(report.created_at);
                const month = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                monthlyData[month] = (monthlyData[month] || 0) + 1;
            });
            
            this.charts.reports = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Object.keys(monthlyData),
                    datasets: [{
                        label: 'Reports Submitted',
                        data: Object.values(monthlyData),
                        borderColor: '#1FB8CD',
                        backgroundColor: 'rgba(31, 184, 205, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Reports Over Time'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to create reports chart:', error);
        }
    }

    createCategoryChart(stats) {
        const canvas = document.getElementById('categoryChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts.category) {
            this.charts.category.destroy();
        }
        
        this.charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(stats.byCategory),
                datasets: [{
                    data: Object.values(stats.byCategory),
                    backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545', '#D2BA4C', '#964325']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Reports by Category'
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    createResolutionChart() {
        const canvas = document.getElementById('resolutionChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts.resolution) {
            this.charts.resolution.destroy();
        }
        
        // Mock resolution time data
        const avgResolutionTimes = {
            'Potholes': 3.5,
            'Street Lights': 2.1,
            'Trash Collection': 1.8,
            'Water Issues': 4.2,
            'Traffic Signs': 2.9,
            'Graffiti': 5.1,
            'Parks & Recreation': 3.7,
            'Other': 3.3
        };
        
        this.charts.resolution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(avgResolutionTimes),
                datasets: [{
                    label: 'Average Days to Resolution',
                    data: Object.values(avgResolutionTimes),
                    backgroundColor: '#1FB8CD'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Average Resolution Time by Category'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Days'
                        }
                    }
                }
            }
        });
    }

    createDepartmentChart(stats) {
        const canvas = document.getElementById('departmentChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts.department) {
            this.charts.department.destroy();
        }
        
        this.charts.department = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(stats.byDepartment),
                datasets: [{
                    label: 'Total Reports',
                    data: Object.values(stats.byDepartment),
                    backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Reports by Department'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    async loadUsersManagement() {
        try {
            const users = await this.db.select('users');
            const departments = await this.db.select('departments');
            
            // Populate department dropdown in user modal
            const userDepartmentSelect = document.getElementById('userDepartment');
            if (userDepartmentSelect) {
                userDepartmentSelect.innerHTML = '<option value="">Select department...</option>';
                departments.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept.name;
                    option.textContent = dept.name;
                    userDepartmentSelect.appendChild(option);
                });
            }
            
            const container = document.getElementById('usersTable');
            if (container) {
                container.innerHTML = `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Department</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(user => `
                                <tr>
                                    <td>#${user.id}</td>
                                    <td>${user.name}</td>
                                    <td>${user.email}</td>
                                    <td><span class="status status--${user.role === 'admin' ? 'error' : 'info'}">${user.role}</span></td>
                                    <td>${user.department || 'N/A'}</td>
                                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <div class="table-actions">
                                            <button class="btn btn-sm btn--outline" onclick="app.editUser(${user.id})">Edit</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
        } catch (error) {
            console.error('Failed to load users management:', error);
        }
    }

    showUserModal() {
        const modal = document.getElementById('userModal');
        if (modal) modal.classList.remove('hidden');
        
        // Reset form
        const form = document.getElementById('userForm');
        if (form) form.reset();
    }

    hideUserModal() {
        const modal = document.getElementById('userModal');
        if (modal) modal.classList.add('hidden');
    }
    // === Modal Display Methods ===

    showAddDepartmentModal() {
        const modal = document.createElement('div');
        modal.id = 'addDepartmentModal';
        modal.className = 'modal';
        modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
            <h3>Add New Department</h3>
            <button class="close-btn" onclick="app.hideAddDepartmentModal()">&times;</button>
            </div>
            <div class="modal-body">
            <input type="text" id="newDepartmentName" placeholder="Department Name" required />
            <input type="email" id="newDepartmentEmail" placeholder="Contact Email (optional)" />
            <input type="tel" id="newDepartmentPhone" placeholder="Contact Phone (optional)" />
            </div>
            <div class="modal-footer">
            <button class="btn btn--primary" onclick="app.saveNewDepartment()">Add</button>
            <button class="btn btn--outline" onclick="app.hideAddDepartmentModal()">Cancel</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
    }

    showAddCategoryModal() {
        const modal = document.createElement('div');
        modal.id = 'addCategoryModal';
        modal.className = 'modal';
        modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
            <h3>Add New Category</h3>
            <button class="close-btn" onclick="app.hideAddCategoryModal()">&times;</button>
            </div>
            <div class="modal-body">
            <input type="text" id="newCategoryName" placeholder="Category Name" required />
            <select id="newCategoryDepartment">
                <option value="">Select Department</option>
            </select>
            </div>
            <div class="modal-footer">
            <button class="btn btn--primary" onclick="app.saveNewCategory()">Add</button>
            <button class="btn btn--outline" onclick="app.hideAddCategoryModal()">Cancel</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        this.loadDepartmentOptionsForCategory();
    }

    // === Helper Methods ===

    hideAddDepartmentModal() {
        document.getElementById('addDepartmentModal')?.remove();
    }
    hideAddCategoryModal() {
        document.getElementById('addCategoryModal')?.remove();
    }

    // Populate department dropdown in the Add Category modal
    async loadDepartmentOptionsForCategory() {
        const depts = await this.db.select('departments');
        const sel = document.getElementById('newCategoryDepartment');
        sel.innerHTML = '<option value="">Select Department</option>';
        depts.forEach(d => {
            const o = document.createElement('option');
            o.value = d.name;
            o.textContent = d.name;
            sel.appendChild(o);
        });
    }

    // Save new department to Supabase
    async saveNewDepartment() {
        const name  = document.getElementById('newDepartmentName').value.trim();
        const email = document.getElementById('newDepartmentEmail').value.trim() || null;
        const phone = document.getElementById('newDepartmentPhone').value.trim()  || null;
        if (!name) { alert('Name is required'); return; }
        // Prevent duplicates
        const existing = await this.db.select('departments');
        if (existing.some(d => d.name.toLowerCase() === name.toLowerCase())) {
        alert('Department exists'); return;
        }
        await this.db.insert('departments', { name, contact_email: email, contact_phone: phone });
        this.hideAddDepartmentModal();
        this.loadSettings();              // refresh settings page
        this.loadDepartmentFilters();     // refresh dropdowns
    }

    // Save new category to Supabase
    async saveNewCategory() {
        const name = document.getElementById('newCategoryName').value.trim();
        const dept = document.getElementById('newCategoryDepartment').value;
        if (!name || !dept) { alert('All fields required'); return; }
        const existing = await this.db.select('categories');
        if (existing.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        alert('Category exists'); return;
        }
        await this.db.insert('categories', { name, department_mapping: dept });
        this.hideAddCategoryModal();
        this.loadSettings();     // refresh settings
        this.loadCategories();   // refresh report form dropdown
    }


    async saveUser() {
        try {
            const name = document.getElementById('userName').value.trim();
            const email = document.getElementById('userEmail').value.trim();
            const password = document.getElementById('userPassword').value.trim();
            const confirmPassword = document.getElementById('confirmPassword').value.trim();
            const role = document.getElementById('userRole').value;
            const department = document.getElementById('userDepartment').value || null;

            if (!name || !email || !password || !role) {
                this.showToast('All fields are required', 'error');
                return;
            }
            if (password !== confirmPassword) {
                this.showToast('Passwords do not match', 'error');
                return;
            }
            if (password.length < 6) {
                this.showToast('Password must be at least 6 characters', 'error');
                return;
            }

            const existing = await this.db.select('users');
            if (existing.some(u => u.email.toLowerCase() === email.toLowerCase())) {
                this.showToast('Email already exists', 'error');
                return;
            }

            await this.db.insert('users', {
                name,
                email,
                password_hash: password,      // store as-is (hash in production)
                role,
                department,
                created_at: new Date().toISOString()
            });

            this.showToast(`${role === 'admin' ? 'Admin' : 'Staff'} created`, 'success');
            this.hideUserModal();
            this.loadUsersManagement();
        } catch (err) {
            console.error(err);
            this.showToast('Failed to create user', 'error');
        }
    }

    async loadSettings() {
        try {
            const categories = await this.db.select('categories');
            const departments = await this.db.select('departments');
            
            // Render categories
            const categoriesContainer = document.getElementById('categoriesList');
            if (categoriesContainer) {
                categoriesContainer.innerHTML = categories.map(cat => `
                    <div class="category-item">
                        <div>
                            <strong>${cat.name}</strong><br>
                            <small>Maps to: ${cat.department_mapping}</small>
                            ${cat.description ? `<br><small>${cat.description}</small>` : ''}
                        </div>
                        <div>
                            <button class="btn btn-sm btn--outline" onclick="app.editCategory(${cat.id})">Edit</button>
                        </div>
                    </div>
                `).join('');
            }
            
            // Render departments
            const departmentsContainer = document.getElementById('departmentsList');
            if (departmentsContainer) {
                departmentsContainer.innerHTML = departments.map(dept => `
                    <div class="department-item">
                        <div>
                            <strong>${dept.name}</strong><br>
                            <small>Email: ${dept.contact_email}</small><br>
                            <small>Phone: ${dept.contact_phone}</small>
                        </div>
                        <div>
                            <button class="btn btn-sm btn--outline" onclick="app.editDepartment(${dept.id})">Edit</button>
                        </div>
                    </div>
                `).join('');
            }
            
            // Update database info
            const stats = await this.db.getReportStatistics();
            const totalRecords = stats.total + categories.length + departments.length;
            
            const totalRecordsEl = document.getElementById('totalRecords');
            const dbSizeEl = document.getElementById('dbSize');
            const lastBackupEl = document.getElementById('lastBackup');
            
            if (totalRecordsEl) totalRecordsEl.textContent = totalRecords;
            if (dbSizeEl) dbSizeEl.textContent = Math.floor(totalRecords * 2.5); // Rough estimate
            if (lastBackupEl) lastBackupEl.textContent = localStorage.getItem('lastBackup') || 'Never';
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    async backupDatabase() {
        try {
            const reports = await this.db.select('reports');
            const users = await this.db.select('users');
            const categories = await this.db.select('categories');
            const departments = await this.db.select('departments');
            
            const backup = {
                timestamp: new Date().toISOString(),
                data: {
                    reports,
                    users,
                    categories,
                    departments
                }
            };
            
            const dataStr = JSON.stringify(backup, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `civic-reports-backup-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
            
            localStorage.setItem('lastBackup', new Date().toLocaleString());
            this.showToast('Database backup downloaded successfully', 'success');
            this.loadSettings(); // Refresh to show updated backup time
        } catch (error) {
            console.error('Failed to backup database:', error);
            this.showToast('Failed to create backup', 'error');
        }
    }

    async clearDatabase() {
        if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
            try {
                // Clear all object stores
                const storeNames = ['reports', 'users', 'categories', 'departments'];
                
                for (const storeName of storeNames) {
                    const transaction = this.db.db.transaction([storeName], 'readwrite');
                    const store = transaction.objectStore(storeName);
                    await new Promise((resolve, reject) => {
                        const request = store.clear();
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                }
                
                // Re-seed with sample data
                await this.db.seedData();
                
                this.showToast('Database cleared and reseeded with sample data', 'success');
                this.updateStats();
                this.loadSettings();
            } catch (error) {
                console.error('Failed to clear database:', error);
                this.showToast('Failed to clear database', 'error');
            }
        }
    }

    resetReportForm() {
        const form = document.getElementById('issueForm');
        if (form) form.reset();
        
        const preview = document.getElementById('photoPreview');
        if (preview) preview.classList.add('hidden');
        
        const locationDisplay = document.getElementById('locationDisplay');
        if (locationDisplay) {
            locationDisplay.innerHTML = '';
            locationDisplay.classList.remove('active');
        }
        
        this.currentLocation = null;
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const messageEl = document.getElementById('toastMessage');
        
        if (toast && messageEl) {
            messageEl.textContent = message;
            toast.className = `toast ${type}`;
            toast.classList.remove('hidden');
            
            setTimeout(() => {
                this.hideToast();
            }, 5000);
        }
    }

    hideToast() {
        const toast = document.getElementById('toast');
        if (toast) toast.classList.add('hidden');
    }
    async exportReportsToExcel() {
        const rows = await this.db.getReportsWithDetails();
        const csv = this.convertToCSV(rows);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reports-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async exportReportsToPDF() {
        const rows = await this.db.getReportsWithDetails();
        let text = `Civic Reports\nGenerated: ${new Date().toLocaleString()}\n\n`;
        rows.forEach(r => {
            text += `#${r.id} | ${r.title}\nPriority: ${r.priority}\nStatus: ${r.status}\n\n`;
        });
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reports-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    convertToCSV(data) {
        const keys = Object.keys(data[0]||{});
        const lines = [keys.join(',')];
        data.forEach(obj => {
            lines.push(keys.map(k=>`"${(obj[k]||'').toString().replace(/"/g,'""')}"`).join(','));
        });
        return lines.join('\n');
    }

}

// Initialize the SQLite-powered app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing SQLite-powered CivicReport app...');
    window.app = new CivicReportApp();
    window.app.init();
});

// Export for global access
window.CivicReportApp = CivicReportApp;