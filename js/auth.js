const VoidAuth = {
    currentUser: null,
    
    init() {
        auth.onAuthStateChanged(async user => {
            this.currentUser = user;
            if (user) {
                if (window.location.pathname.includes('auth.html')) {
                    location.href = 'index.html';
                }
                this.updateUI();
            }
            if (document.getElementById('loadingStatus')) {
                document.getElementById('loadingStatus').textContent = user ? '✅ جاهز' : '👁️ وضع المشاهدة';
            }
        });
    },
    
    updateUI() {
        if (!this.currentUser) return;
        const isAdmin = this.currentUser.email === ADMIN_EMAIL;
        const profileBtn = document.getElementById('profileNavBtn');
        if (profileBtn) {
            profileBtn.dataset.page = isAdmin ? 'admin' : 'profile';
            profileBtn.innerHTML = isAdmin ? '<i class="fas fa-crown"></i><span>التحكم</span>' : '<i class="fas fa-user"></i><span>حسابي</span>';
        }
    },
    
    async login(email, password) {
        try {
            await auth.signInWithEmailAndPassword(email, password);
            return { success: true };
        } catch (e) {
            return { success: false, error: this.getError(e.code) };
        }
    },
    
    async register(username, email, password) {
        if (password.length < 6) return { success: false, error: 'كلمة المرور 6 أحرف على الأقل' };
        if (username.length < 3) return { success: false, error: 'اسم المستخدم 3 أحرف على الأقل' };
        
        try {
            const res = await auth.createUserWithEmailAndPassword(email, password);
            const userId = res.user.uid;
            
            // ⭐ صورة كارتونية بشرية
            const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
            const coverUrl = 'https://images.unsplash.com/photo-1515630278258-407f66498911?w=1200';
            
            // ⭐ حفظ بيانات المستخدم كاملة
            await db.ref('users/' + userId).set({
                username: username,
                email: email,
                avatar: avatarUrl,
                cover: coverUrl,
                bio: '🦁 مستكشف في VOID LION',
                website: '',
                verified: false,
                role: 'user',
                followers: {},
                following: {},
                presence: 'online',
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            
            return { success: true };
        } catch (e) {
            return { success: false, error: this.getError(e.code) };
        }
    },
    
    async logout() {
        await auth.signOut();
        location.href = 'auth.html';
    },
    
    getError(code) {
        const errors = {
            'auth/invalid-email': 'بريد غير صالح',
            'auth/user-not-found': 'مستخدم غير موجود',
            'auth/wrong-password': 'كلمة مرور خاطئة',
            'auth/email-already-in-use': 'البريد مسجل مسبقاً',
            'auth/weak-password': 'كلمة مرور ضعيفة'
        };
        return errors[code] || 'حدث خطأ';
    }
};

VoidAuth.init();
