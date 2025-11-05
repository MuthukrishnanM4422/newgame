// shared-storage-firebase.js
class FirebaseStorage {
    constructor() {
        // 🔥 YOUR COMPLETE FIREBASE CONFIG
        this.firebaseConfig = {
            apiKey: "AIzaSyCHEiQG5WgGmUxNDwlv9VkDjtpmvtw3ANk",
            authDomain: "funfriday-mk4422.firebaseapp.com",
            databaseURL: "https://funfriday-mk4422-default-rtdb.firebaseio.com",
            projectId: "funfriday-mk4422",
            storageBucket: "funfriday-mk4422.firebasestorage.app",
            messagingSenderId: "845580604433",
            appId: "1:845580604433:web:5ddb4410837fbd0fb08db0",
            measurementId: "G-6Z6KB49BCK"
        };
        
        this.app = null;
        this.db = null;
        this.listeners = [];
        this.initialized = false;
        
        console.log('🚀 Initializing Firebase with your config...');
        this.initializeFirebase();
    }

    async initializeFirebase() {
        try {
            // Load Firebase scripts
            console.log('📥 Loading Firebase scripts...');
            await this.loadScript('https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js');
            await this.loadScript('https://www.gstatic.com/firebasejs/9.6.10/firebase-database-compat.js');
            
            console.log('🔥 Initializing Firebase app...');
            // Initialize Firebase
            this.app = firebase.initializeApp(this.firebaseConfig);
            this.db = firebase.database();
            this.initialized = true;
            
            console.log('✅ Firebase initialized successfully!');
            console.log('📊 Database URL:', this.firebaseConfig.databaseURL);
        } catch (error) {
            console.error('❌ Firebase initialization error:', error);
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (document.querySelector(`script[src="${src}"]`)) {
                console.log('📚 Script already loaded:', src);
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                console.log('✅ Loaded:', src);
                resolve();
            };
            script.onerror = (error) => {
                console.error('❌ Failed to load:', src, error);
                reject(error);
            };
            document.head.appendChild(script);
        });
    }

    async waitForInitialization() {
        let attempts = 0;
        while (!this.initialized && attempts < 50) { // 5 second timeout
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        if (!this.initialized) {
            throw new Error('Firebase initialization timeout');
        }
    }

    async init() {
        try {
            await this.waitForInitialization();
            console.log('🎯 Firebase storage ready for use');
            return true;
        } catch (error) {
            console.error('❌ Firebase init failed:', error);
            return false;
        }
    }

    // Generic storage methods
    async setItem(key, value) {
        try {
            await this.waitForInitialization();
            await this.db.ref(key).set(value);
            console.log('💾 Saved to Firebase:', key, value);
            return true;
        } catch (error) {
            console.error('❌ Error setting item in Firebase:', error);
            return false;
        }
    }

    async getItem(key) {
        try {
            await this.waitForInitialization();
            const snapshot = await this.db.ref(key).once('value');
            const value = snapshot.val();
            console.log('📥 Retrieved from Firebase:', key, value);
            return value;
        } catch (error) {
            console.error('❌ Error getting item from Firebase:', error);
            return null;
        }
    }

    async removeItem(key) {
        try {
            await this.waitForInitialization();
            await this.db.ref(key).remove();
            console.log('🗑️ Removed from Firebase:', key);
            return true;
        } catch (error) {
            console.error('❌ Error removing item from Firebase:', error);
            return false;
        }
    }

    // Games specific methods
    async getGames() {
        try {
            await this.waitForInitialization();
            const snapshot = await this.db.ref('games').once('value');
            const games = snapshot.val() || {};
            console.log('📥 Games loaded from Firebase. Total games:', Object.keys(games).length);
            return games;
        } catch (error) {
            console.error('❌ Error getting games from Firebase:', error);
            return {};
        }
    }

    async saveGames(games) {
        try {
            await this.waitForInitialization();
            console.log('💾 Saving games to Firebase...');
            await this.db.ref('games').set(games);
            console.log('✅ Games saved successfully!');
            this.notifyListeners(games);
            return true;
        } catch (error) {
            console.error('❌ Error saving games to Firebase:', error);
            return false;
        }
    }

    // ⚡ INSTANT REAL-TIME UPDATES
    startMonitoring(callback) {
        console.log('🔔 Starting real-time monitoring...');
        this.addListener(callback);
        
        this.waitForInitialization().then(() => {
            console.log('👂 Listening for real-time changes...');
            
            this.db.ref('games').on('value', (snapshot) => {
                const games = snapshot.val() || {};
                console.log('🔄 REAL-TIME UPDATE: Games changed');
                callback(games);
            }, (error) => {
                console.error('❌ Firebase monitoring error:', error);
            });
        }).catch(error => {
            console.error('❌ Failed to start monitoring:', error);
        });
    }

    stopMonitoring() {
        if (this.db) {
            this.db.ref('games').off();
            console.log('🔕 Real-time monitoring stopped');
        }
        this.listeners = [];
    }

    addListener(callback) {
        this.listeners.push(callback);
    }

    removeListener(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    }

    notifyListeners(games) {
        this.listeners.forEach(listener => {
            try {
                listener(games);
            } catch (error) {
                console.error('❌ Error in listener:', error);
            }
        });
    }

    async forceSync() {
        console.log('🔄 Manual sync requested');
        return await this.getGames();
    }

    async clearAll() {
        try {
            await this.waitForInitialization();
            await this.db.ref('games').set({});
            console.log('🗑️ All games cleared from Firebase');
            return true;
        } catch (error) {
            console.error('❌ Error clearing games:', error);
            return false;
        }
    }

    // Test connection
    async testConnection() {
        try {
            await this.waitForInitialization();
            console.log('🧪 Testing Firebase connection...');
            
            // Test write operation
            await this.db.ref('connectionTest').set({ 
                timestamp: Date.now(),
                message: 'Firebase connection test successful',
                project: 'funfriday-mk4422'
            });
            
            // Test read operation
            const snapshot = await this.db.ref('connectionTest').once('value');
            const data = snapshot.val();
            
            console.log('✅ Firebase connection test passed!', data);
            return true;
        } catch (error) {
            console.error('❌ Firebase connection test failed:', error);
            return false;
        }
    }

    // Subscribe to real-time changes for any path
    subscribe(path, callback) {
        this.waitForInitialization().then(() => {
            console.log('👂 Subscribing to:', path);
            this.db.ref(path).on('value', (snapshot) => {
                const value = snapshot.val();
                callback(value);
            });
        }).catch(error => {
            console.error('❌ Subscription failed:', error);
        });
    }

    // Unsubscribe from real-time changes
    unsubscribe(path) {
        if (this.db) {
            this.db.ref(path).off();
            console.log('🔕 Unsubscribed from:', path);
        }
    }
}

// Create global instance
const sharedStorage = new FirebaseStorage();

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 Page loaded, initializing Firebase...');
    sharedStorage.init().then(success => {
        if (success) {
            console.log('🎉 Firebase fully initialized and ready!');
        } else {
            console.error('💥 Firebase initialization failed');
        }
    });
});

console.log('🎯 Firebase storage system loaded');