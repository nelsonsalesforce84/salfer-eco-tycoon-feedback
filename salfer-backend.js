import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    signInAnonymously, 
    onAuthStateChanged,
    signInWithCustomToken
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    increment,
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    onSnapshot,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { 
    getAnalytics,
    logEvent,
    setUserProperties 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';

class SalferBackend {
    constructor(config) {
        this.app = initializeApp(config);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        try {
            this.analytics = getAnalytics(this.app);
        } catch (e) {
            this.analytics = null;
        }
        this.user = null;
        this.userId = null;
        this.initialized = false;
    }

    async init() {
        return new Promise((resolve, reject) => {
            onAuthStateChanged(this.auth, async (user) => {
                if (user) {
                    this.user = user;
                    this.userId = user.uid;
                    this.initialized = true;
                    console.log('🎮 Salfer Backend: User authenticated', this.userId);
                    resolve(user);
                } else {
                    try {
                        const result = await signInAnonymously(this.auth);
                        this.user = result.user;
                        this.userId = result.user.uid;
                        this.initialized = true;
                        console.log('🎮 Salfer Backend: New anonymous user created', this.userId);
                        
                        await this.initUserData();
                        resolve(result.user);
                    } catch (error) {
                        console.error('Auth error:', error);
                        reject(error);
                    }
                }
            });
        });
    }

    async initUserData() {
        const userRef = doc(this.db, 'players', this.userId);
        const snap = await getDoc(userRef);
        
        if (!snap.exists()) {
            await setDoc(userRef, {
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
                totalEnergy: 0,
                rank: 1,
                referrals: 0,
                referredBy: null,
                credits: 0,
                country: navigator.language || 'unknown',
                platform: navigator.platform || 'unknown'
            });
            this.logEvent('new_player');
        } else {
            await updateDoc(userRef, {
                lastLogin: serverTimestamp()
            });
        }
    }

    async saveProgress(gameData) {
        if (!this.userId) return;
        
        const userRef = doc(this.db, 'players', this.userId);
        try {
            await updateDoc(userRef, {
                energy: gameData.energy || 0,
                totalEnergy: gameData.totalEnergyEver || 0,
                rank: gameData.rank || 1,
                credits: gameData.salferCredits || 0,
                ecoCredits: gameData.ecoCredits || 0,
                buildingsCount: Object.keys(gameData.buildings || {}).length,
                mainHouseLevel: gameData.mainHouseLevel || 1,
                playtime: gameData.achStats?.totalPlaytime || 0,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Save error:', error);
        }
    }

    async loadProgress() {
        if (!this.userId) return null;
        
        const userRef = doc(this.db, 'players', this.userId);
        const snap = await getDoc(userRef);
        
        if (snap.exists()) {
            return snap.data();
        }
        return null;
    }

    async processReferral(refCode) {
        if (!this.userId || !refCode) return false;
        
        const myCode = await this.getMyReferralCode();
        if (refCode === myCode) return false;
        
        const userRef = doc(this.db, 'players', this.userId);
        const snap = await getDoc(userRef);
        
        if (snap.exists() && snap.data().referredBy) {
            return false;
        }
        
        const referrerRef = doc(this.db, 'players', refCode);
        const referrerSnap = await getDoc(referrerRef);
        
        if (!referrerSnap.exists()) {
            console.log('Invalid referral code');
            return false;
        }
        
        await updateDoc(userRef, {
            referredBy: refCode,
            credits: increment(100)
        });
        
        await updateDoc(referrerRef, {
            referrals: increment(1),
            credits: increment(100)
        });
        
        await setDoc(doc(this.db, 'referrals', `${refCode}_${this.userId}`), {
            referrer: refCode,
            referred: this.userId,
            createdAt: serverTimestamp(),
            rewarded: true
        }, { merge: true });
        
        this.logEvent('referral_completed', { referrer: refCode });
        
        return true;
    }

    async getMyReferralCode() {
        return this.userId;
    }

    async getReferralStats() {
        if (!this.userId) return { count: 0, referredBy: null };
        
        const userRef = doc(this.db, 'players', this.userId);
        const snap = await getDoc(userRef);
        
        if (snap.exists()) {
            const data = snap.data();
            return {
                count: data.referrals || 0,
                referredBy: data.referredBy || null
            };
        }
        return { count: 0, referredBy: null };
    }

    async getLeaderboard(type = 'energy', limitCount = 100) {
        const field = type === 'energy' ? 'totalEnergy' : 'rank';
        
        const q = query(
            collection(this.db, 'players'),
            orderBy(field, 'desc'),
            limit(limitCount)
        );
        
        const snap = await getDocs(q);
        const leaderboard = [];
        
        snap.forEach((doc, index) => {
            const data = doc.data();
            leaderboard.push({
                rank: index + 1,
                id: doc.id.substring(0, 8),
                energy: data.totalEnergy || 0,
                gameRank: data.rank || 1,
                country: data.country || 'unknown'
            });
        });
        
        return leaderboard;
    }

    subscribeToLeaderboard(callback, type = 'energy') {
        const field = type === 'energy' ? 'totalEnergy' : 'rank';
        
        const q = query(
            collection(this.db, 'players'),
            orderBy(field, 'desc'),
            limit(50)
        );
        
        return onSnapshot(q, (snap) => {
            const leaderboard = [];
            snap.forEach((doc, index) => {
                const data = doc.data();
                leaderboard.push({
                    rank: index + 1,
                    id: doc.id.substring(0, 8),
                    energy: data.totalEnergy || 0,
                    gameRank: data.rank || 1
                });
            });
            callback(leaderboard);
        });
    }

    logEvent(eventName, params = {}) {
        if (this.analytics) {
            logEvent(this.analytics, eventName, params);
        }
    }

    setUserProp(name, value) {
        if (this.analytics) {
            setUserProperties(this.analytics, { [name]: value });
        }
    }

    async getGlobalStats() {
        const statsRef = doc(this.db, 'stats', 'global');
        const snap = await getDoc(statsRef);
        
        if (snap.exists()) {
            return snap.data();
        }
        return {
            totalPlayers: 0,
            totalEnergy: 0,
            totalReferrals: 0
        };
    }
}

export { SalferBackend };
