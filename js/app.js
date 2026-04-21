// ==================== نظام الفيديوهات - معدل ====================
const VoidVideo = {
    currentVideoId: null,
    currentVideoUserId: null,

    async loadFeed() {
        const feed = document.getElementById('videoFeed');
        feed.innerHTML = '<div style="text-align:center;padding-top:50%"><div class="spinner"></div></div>';
        
        try {
            const snap = await db.ref('videos').orderByChild('timestamp').limitToLast(20).once('value');
            const videos = snap.val();
            
            feed.innerHTML = '';
            
            if (!videos) {
                feed.innerHTML = '<p style="text-align:center;padding-top:50%;color:#888">لا توجد فيديوهات بعد</p>';
                return;
            }
            
            // تحويل إلى مصفوفة وعكس الترتيب
            const videosArray = Object.entries(videos).reverse();
            
            for (const [id, video] of videosArray) {
                this.renderVideo(id, video);
            }
            
            this.initObserver();
        } catch (error) {
            console.error('خطأ في تحميل الفيديوهات:', error);
            feed.innerHTML = '<p style="text-align:center;padding-top:50%;color:#888">حدث خطأ في تحميل الفيديوهات</p>';
        }
    },

    renderVideo(id, video) {
        const feed = document.getElementById('videoFeed');
        const div = document.createElement('div');
        div.className = 'video-item';
        div.dataset.videoId = id;
        div.dataset.userId = video.userId || '';
        
        // التأكد من وجود البيانات
        const userAvatar = video.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default';
        const username = video.username || 'مستخدم';
        const title = video.title || '';
        const description = video.description || '';
        
        // استخراج الهاشتاغات
        const hashtags = (description.match(/#[^\s]+/g) || []).map(t => `<span class="hashtag">${t}</span>`).join('');
        
        div.innerHTML = `
            <video src="${video.url}" loop playsinline></video>
            <div class="video-overlay">
                <div style="display:flex;align-items:center;gap:10px">
                    <img src="${userAvatar}" style="width:40px;height:40px;border-radius:50%;border:2px solid #00f2ff;cursor:pointer" onclick="VoidUser.viewProfile('${video.userId}')">
                    <div>
                        <strong style="cursor:pointer" onclick="VoidUser.viewProfile('${video.userId}')">@${username}</strong>
                        ${VoidAuth.currentUser && video.userId !== VoidAuth.currentUser.uid ? 
                            `<button onclick="VoidUser.follow('${video.userId}')" style="background:#00f2ff;border:none;padding:4px 12px;border-radius:20px;margin-right:8px;cursor:pointer">متابعة</button>` : ''}
                    </div>
                </div>
                ${title ? `<p style="margin-top:8px;font-weight:bold">${title}</p>` : ''}
                ${description ? `<p style="font-size:14px;opacity:0.9">${description}</p>` : ''}
                ${hashtags ? `<div style="margin-top:8px">${hashtags}</div>` : ''}
            </div>
        `;
        
        feed.appendChild(div);
    },

    initObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target.querySelector('video');
                const videoId = entry.target.dataset.videoId;
                
                if (entry.isIntersecting) {
                    if (video) {
                        video.play().catch(e => console.log('تشغيل تلقائي ممنوع'));
                    }
                    this.currentVideoId = videoId;
                    this.currentVideoUserId = entry.target.dataset.userId;
                    
                    const actions = document.getElementById('videoActions');
                    if (actions) actions.style.display = 'flex';
                    
                    this.updateActions(videoId);
                    
                    // زيادة المشاهدات
                    db.ref(`videos/${videoId}/views`).transaction(v => (v || 0) + 1);
                } else {
                    if (video) video.pause();
                }
            });
        }, { threshold: 0.7 });
        
        document.querySelectorAll('.video-item').forEach(el => observer.observe(el));
    },

    async updateActions(videoId) {
        if (!videoId) return;
        
        try {
            const snap = await db.ref(`videos/${videoId}`).once('value');
            const video = snap.val();
            if (!video) return;
            
            const likes = video.likes || {};
            const likeCount = Object.keys(likes).length;
            const commentCount = video.comments || 0;
            
            document.getElementById('likeCount').textContent = VoidApp.formatNumber(likeCount);
            document.getElementById('commentCount').textContent = VoidApp.formatNumber(commentCount);
            
            const hasLiked = likes[VoidAuth.currentUser?.uid];
            const likeIcon = document.getElementById('likeIcon');
            if (likeIcon) likeIcon.style.color = hasLiked ? '#ff007f' : '#fff';
        } catch (error) {
            console.error('خطأ في تحديث الإجراءات:', error);
        }
    },

    async toggleLike() {
        if (!VoidAuth.currentUser) {
            location.href = 'auth.html';
            return;
        }
        if (!this.currentVideoId) return;
        
        const ref = db.ref(`videos/${this.currentVideoId}/likes/${VoidAuth.currentUser.uid}`);
        const snap = await ref.once('value');
        
        if (snap.exists()) {
            await ref.remove();
        } else {
            await ref.set(true);
            
            // إرسال إشعار
            if (this.currentVideoUserId && this.currentVideoUserId !== VoidAuth.currentUser.uid) {
                await db.ref(`notifications/${this.currentVideoUserId}`).push({
                    type: 'like',
                    from: VoidAuth.currentUser.uid,
                    videoId: this.currentVideoId,
                    read: false,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
            }
        }
        
        this.updateActions(this.currentVideoId);
    },

    openComments() {
        if (!this.currentVideoId) return;
        VoidApp.openPanel('commentsPanel');
        this.loadComments();
    },

    async loadComments() {
        const container = document.getElementById('commentsList');
        container.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
        
        try {
            const snap = await db.ref(`comments/${this.currentVideoId}`).once('value');
            const comments = snap.val();
            
            container.innerHTML = '';
            
            if (!comments) {
                container.innerHTML = '<p style="text-align:center;color:#888;padding:20px">لا توجد تعليقات</p>';
                return;
            }
            
            const commentsArray = Object.entries(comments).reverse();
            
            for (const [id, comment] of commentsArray) {
                const div = document.createElement('div');
                div.style.cssText = 'background:rgba(255,255,255,0.05);padding:12px;border-radius:12px;margin-bottom:10px';
                div.innerHTML = `
                    <div style="display:flex;gap:10px">
                        <img src="${comment.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'}" style="width:32px;height:32px;border-radius:50%">
                        <div style="flex:1">
                            <strong style="color:#00f2ff;cursor:pointer" onclick="VoidUser.viewProfile('${comment.userId}')">@${comment.username || 'مستخدم'}</strong>
                            <p style="margin-top:5px">${comment.text || ''}</p>
                            <small style="opacity:0.6">${VoidApp.timeAgo(comment.timestamp)}</small>
                        </div>
                    </div>
                `;
                container.appendChild(div);
            }
        } catch (error) {
            container.innerHTML = '<p style="text-align:center;color:#888;padding:20px">خطأ في تحميل التعليقات</p>';
        }
    },

    async sendComment() {
        if (!VoidAuth.currentUser) {
            location.href = 'auth.html';
            return;
        }
        
        const input = document.getElementById('commentInput');
        const text = input.value.trim();
        if (!text) return;
        
        try {
            const userSnap = await db.ref(`users/${VoidAuth.currentUser.uid}`).once('value');
            const user = userSnap.val();
            
            await db.ref(`comments/${this.currentVideoId}`).push({
                userId: VoidAuth.currentUser.uid,
                username: user.username || 'مستخدم',
                userAvatar: user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
                text: text,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            
            await db.ref(`videos/${this.currentVideoId}/comments`).transaction(c => (c || 0) + 1);
            
            input.value = '';
            this.loadComments();
            this.updateActions(this.currentVideoId);
        } catch (error) {
            console.error('خطأ في إرسال التعليق:', error);
        }
    },

    shareVideo() {
        if (!this.currentVideoId) return;
        const url = window.location.href;
        
        if (navigator.share) {
            navigator.share({ title: 'VOID LION', url });
        } else {
            navigator.clipboard?.writeText(url);
            VoidApp.setLog('📋 تم نسخ الرابط');
        }
        
        db.ref(`videos/${this.currentVideoId}/shares`).transaction(s => (s || 0) + 1);
    }
};

// ==================== نظام البروفايل - معدل ====================
const VoidProfile = {
    async load() {
        if (!VoidAuth.currentUser) return;
        
        try {
            const userSnap = await db.ref(`users/${VoidAuth.currentUser.uid}`).once('value');
            const user = userSnap.val();
            
            if (!user) {
                console.error('المستخدم غير موجود');
                return;
            }
            
            // تحديث الواجهة
            document.getElementById('profileCover').style.backgroundImage = `url(${user.cover || 'https://images.unsplash.com/photo-1515630278258-407f66498911?w=1200'})`;
            document.getElementById('profileAvatar').src = user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default';
            document.getElementById('profileName').textContent = `@${user.username || 'مستخدم'}`;
            document.getElementById('profileBio').textContent = user.bio || '🦁 مستكشف في VOID LION';
            
            if (user.website) {
                document.getElementById('profileLink').href = user.website;
                document.getElementById('linkText').textContent = user.website.replace(/^https?:\/\//, '');
            }
            
            if (user.verified) {
                document.getElementById('verifiedBadge').style.display = 'inline';
            }
            
            const followers = user.followers || {};
            const following = user.following || {};
            
            document.getElementById('profileFollowers').textContent = Object.keys(followers).length;
            document.getElementById('profileFollowing').textContent = Object.keys(following).length;
            
            // تحميل فيديوهات المستخدم
            const videoSnap = await db.ref('videos').orderByChild('userId').equalTo(VoidAuth.currentUser.uid).once('value');
            const videos = videoSnap.val() || {};
            document.getElementById('profileVideos').textContent = Object.keys(videos).length;
            
            // عرض شبكة الفيديوهات
            const grid = document.getElementById('profileVideosGrid');
            grid.innerHTML = '';
            
            const videosArray = Object.entries(videos).reverse();
            
            for (const [id, video] of videosArray) {
                const div = document.createElement('div');
                div.style.cssText = 'aspect-ratio:9/16;cursor:pointer;position:relative';
                div.onclick = () => VoidApp.switchPage('home');
                div.innerHTML = `
                    <video src="${video.url}" style="width:100%;height:100%;object-fit:cover" muted></video>
                    <span style="position:absolute;bottom:5px;left:5px;color:#fff;font-size:11px;background:rgba(0,0,0,0.6);padding:2px 6px;border-radius:4px">
                        <i class="fas fa-play"></i> ${VoidApp.formatNumber(video.views || 0)}
                    </span>
                `;
                grid.appendChild(div);
            }
        } catch (error) {
            console.error('خطأ في تحميل البروفايل:', error);
        }
    },

    changeAvatar() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
            
            try {
                const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                await db.ref(`users/${VoidAuth.currentUser.uid}/avatar`).set(data.secure_url);
                this.load();
                VoidApp.setLog('✅ تم تحديث الصورة');
            } catch (error) {
                console.error('خطأ في رفع الصورة:', error);
            }
        };
        input.click();
    },

    changeCover() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
            
            try {
                const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                await db.ref(`users/${VoidAuth.currentUser.uid}/cover`).set(data.secure_url);
                this.load();
                VoidApp.setLog('✅ تم تحديث الغلاف');
            } catch (error) {
                console.error('خطأ في رفع الغلاف:', error);
            }
        };
        input.click();
    },

    openEditModal() {
        document.getElementById('editProfileModal').style.display = 'flex';
    },

    async saveEdit() {
        const name = document.getElementById('editName').value.trim();
        const bio = document.getElementById('editBio').value.trim();
        const website = document.getElementById('editWebsite').value.trim();
        
        if (name) await db.ref(`users/${VoidAuth.currentUser.uid}/username`).set(name);
        if (bio) await db.ref(`users/${VoidAuth.currentUser.uid}/bio`).set(bio);
        await db.ref(`users/${VoidAuth.currentUser.uid}/website`).set(website || null);
        
        VoidApp.closeModal('editProfileModal');
        this.load();
        VoidApp.setLog('✅ تم تحديث الملف');
    }
};

// ==================== نظام المستخدمين - معدل ====================
const VoidUser = {
    viewingUserId: null,
    
    async viewProfile(uid) {
        if (!uid) return;
        
        this.viewingUserId = uid;
        
        try {
            const userSnap = await db.ref(`users/${uid}`).once('value');
            const user = userSnap.val();
            
            if (!user) {
                console.error('المستخدم غير موجود');
                return;
            }
            
            document.getElementById('viewUserName').textContent = `@${user.username || 'مستخدم'}`;
            document.getElementById('viewUserAvatar').src = user.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default';
            document.getElementById('viewUserBio').textContent = user.bio || '';
            
            const followers = user.followers || {};
            const following = user.following || {};
            
            document.getElementById('viewUserFollowers').textContent = Object.keys(followers).length;
            document.getElementById('viewUserFollowing').textContent = Object.keys(following).length;
            
            document.getElementById('userProfileModal').style.display = 'flex';
        } catch (error) {
            console.error('خطأ في عرض الملف:', error);
        }
    },
    
    async follow(uid) {
        if (!VoidAuth.currentUser) {
            location.href = 'auth.html';
            return;
        }
        if (uid === VoidAuth.currentUser.uid) return;
        
        const ref = db.ref(`users/${uid}/followers/${VoidAuth.currentUser.uid}`);
        const snap = await ref.once('value');
        
        if (snap.exists()) {
            await ref.remove();
            await db.ref(`users/${VoidAuth.currentUser.uid}/following/${uid}`).remove();
        } else {
            await ref.set(true);
            await db.ref(`users/${VoidAuth.currentUser.uid}/following/${uid}`).set(true);
            
            await db.ref(`notifications/${uid}`).push({
                type: 'follow',
                from: VoidAuth.currentUser.uid,
                read: false,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        }
    },
    
    followCurrent() {
        this.follow(this.viewingUserId);
        VoidApp.closeModal('userProfileModal');
    }
};

// ==================== تهيئة التطبيق ====================
document.addEventListener('DOMContentLoaded', () => {
    VoidApp.init();
    
    window.VoidApp = VoidApp;
    window.VoidVideo = VoidVideo;
    window.VoidUpload = VoidUpload;
    window.VoidProfile = VoidProfile;
    window.VoidUser = VoidUser;
    window.VoidExplore = VoidExplore;
    window.VoidChat = VoidChat;
    window.VoidNotifications = VoidNotifications;
    window.VoidReport = VoidReport;
    window.VoidAdmin = VoidAdmin;
});
