const VoidApp = {
    currentVideoId: null, currentVideoUserId: null, viewingUserId: null,
    init() {
        document.querySelectorAll('.nav-item[data-page]').forEach(i => i.onclick = () => this.switchPage(i.dataset.page));
        setTimeout(() => { document.getElementById('loadingScreen').style.display = 'none'; document.getElementById('app').style.display = 'block'; VoidVideo.loadFeed(); VoidNotifications.init(); }, 1000);
    },
    switchPage(p) {
        document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
        document.getElementById(`page-${p}`).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
        document.querySelector(`.nav-item[data-page="${p}"]`)?.classList.add('active');
        if(p==='home') VoidVideo.loadFeed();
        else if(p==='explore') VoidExplore.load();
        else if(p==='profile') VoidProfile.load();
        else if(p==='admin') VoidAdmin.load();
    },
    openPanel(id) { document.getElementById(id).classList.add('open'); if(id==='messagesPanel') VoidChat.loadConversations(); if(id==='notificationsPanel') VoidNotifications.load(); },
    closePanel(id) { document.getElementById(id).classList.remove('open'); },
    closeModal(id) { document.getElementById(id).style.display = 'none'; },
    formatNumber(n) { if(!n) return '0'; return n>=1000000 ? (n/1000000).toFixed(1)+'M' : n>=1000 ? (n/1000).toFixed(1)+'K' : n.toString(); },
    timeAgo(ts) { const s = Math.floor((Date.now()-ts)/1000); if(s<60) return 'الآن'; if(s<3600) return `منذ ${Math.floor(s/60)} د`; if(s<86400) return `منذ ${Math.floor(s/3600)} س`; return `منذ ${Math.floor(s/86400)} ي`; }
};

const VoidVideo = {
    async loadFeed() {
        const f = document.getElementById('videoFeed'); f.innerHTML = '<div style="text-align:center;padding-top:50%"><div class="spinner"></div></div>';
        const s = await db.ref('videos').orderByChild('timestamp').limitToLast(20).once('value');
        const v = s.val(); f.innerHTML = '';
        if(!v) { f.innerHTML = '<p style="text-align:center;padding-top:50%;color:#888">لا توجد فيديوهات</p>'; return; }
        Object.entries(v).reverse().forEach(([id, d]) => this.renderVideo(id, d));
        this.initObserver();
    },
    renderVideo(id, d) {
        const div = document.createElement('div'); div.className = 'video-item'; div.dataset.videoId = id; div.dataset.userId = d.userId;
        div.innerHTML = `<video src="${d.url}" loop playsinline></video>
            <div class="video-overlay">
                <div style="display:flex;align-items:center;gap:10px">
                    <img src="${d.userAvatar}" style="width:40px;height:40px;border-radius:50%;border:2px solid #00f2ff" onclick="VoidUser.viewProfile('${d.userId}')">
                    <div><strong onclick="VoidUser.viewProfile('${d.userId}')">@${d.username}</strong>
                    ${VoidAuth.currentUser && d.userId!==VoidAuth.currentUser.uid ? `<button onclick="VoidUser.follow('${d.userId}')" style="background:#00f2ff;border:none;padding:4px 12px;border-radius:20px;margin-right:8px;cursor:pointer">متابعة</button>`:''}</div>
                </div>
                <p style="margin-top:8px;font-weight:bold">${d.title||''}</p><p style="font-size:14px">${d.description||''}</p>
                <div style="margin-top:8px">${(d.description?.match(/#[^\s]+/g)||[]).map(t=>`<span class="hashtag">${t}</span>`).join('')}</div>
            </div>`;
        f.appendChild(div);
    },
    initObserver() {
        const o = new IntersectionObserver((e) => { e.forEach(x => { const v = x.target.querySelector('video'); if(x.isIntersecting){ v.play(); this.currentVideoId = x.target.dataset.videoId; this.currentVideoUserId = x.target.dataset.userId; document.getElementById('videoActions').style.display = 'flex'; this.updateActions(this.currentVideoId); db.ref(`videos/${this.currentVideoId}/views`).transaction(v=>v+1); } else v.pause(); }); }, {threshold:0.7});
        document.querySelectorAll('.video-item').forEach(el => o.observe(el));
    },
    async updateActions(id) { const v = (await db.ref(`videos/${id}`).once('value')).val(); document.getElementById('likeCount').textContent = VoidApp.formatNumber(Object.keys(v.likes||{}).length); document.getElementById('commentCount').textContent = VoidApp.formatNumber(v.comments||0); document.getElementById('likeIcon').style.color = v.likes?.[VoidAuth.currentUser?.uid] ? '#ff007f' : '#fff'; },
    async toggleLike() { if(!VoidAuth.currentUser) { location.href = 'auth.html'; return; } const r = db.ref(`videos/${this.currentVideoId}/likes/${VoidAuth.currentUser.uid}`); (await r.once('value')).exists() ? await r.remove() : await r.set(true); this.updateActions(this.currentVideoId); },
    openComments() { VoidApp.openPanel('commentsPanel'); this.loadComments(); },
    async loadComments() { const c = document.getElementById('commentsList'); c.innerHTML = '<div class="spinner"></div>'; const s = await db.ref(`comments/${this.currentVideoId}`).once('value'); const cm = s.val(); c.innerHTML = !cm ? '<p style="color:#888">لا توجد تعليقات</p>' : Object.entries(cm).reverse().map(([id, x]) => `<div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:12px;margin-bottom:10px"><strong style="color:#00f2ff" onclick="VoidUser.viewProfile('${x.userId}')">@${x.username}</strong><p>${x.text}</p><small>${VoidApp.timeAgo(x.timestamp)}</small></div>`).join(''); },
    async sendComment() { if(!VoidAuth.currentUser) { location.href = 'auth.html'; return; } const t = document.getElementById('commentInput').value.trim(); if(!t) return; const u = (await db.ref(`users/${VoidAuth.currentUser.uid}`).once('value')).val(); await db.ref(`comments/${this.currentVideoId}`).push({ userId: VoidAuth.currentUser.uid, username: u.username, userAvatar: u.avatar, text: t, timestamp: firebase.database.ServerValue.TIMESTAMP }); await db.ref(`videos/${this.currentVideoId}/comments`).transaction(c => (c||0)+1); document.getElementById('commentInput').value = ''; this.loadComments(); },
    shareVideo() { if(navigator.share) navigator.share({url:location.href}); else navigator.clipboard?.writeText(location.href); }
};

const VoidUpload = {
    videoFile: null,
    openModal() { if(!VoidAuth.currentUser){location.href='auth.html';return;} document.getElementById('uploadModal').style.display='flex'; document.getElementById('videoFileInput').onchange = e => this.handleFile(e.target.files[0]); },
    closeModal() { document.getElementById('uploadModal').style.display='none'; },
    async handleFile(file) { if(!file) return; document.getElementById('uploadArea').style.display='none'; document.getElementById('uploadProgressBox').style.display='block'; const fd = new FormData(); fd.append('file', file); fd.append('upload_preset','so_34k'); const x = new XMLHttpRequest(); x.upload.onprogress = e => { const p = Math.round(e.loaded/e.total*100); document.getElementById('progressPercent').textContent = p+'%'; document.getElementById('progressFill').style.width = p+'%'; }; x.onload = async () => { const r = JSON.parse(x.responseText); this.videoFile = r; document.getElementById('uploadProgressBox').style.display='none'; document.getElementById('videoInfoBox').style.display='block'; document.getElementById('videoPreview').src = r.secure_url; }; x.open('POST', `https://api.cloudinary.com/v1_1/duzoqh3jp/video/upload`); x.send(fd); },
    async publish() { const t = document.getElementById('videoTitle').value.trim(); if(!t) return alert('أدخل عنواناً'); const d = document.getElementById('videoDescription').value.trim(); const u = (await db.ref(`users/${VoidAuth.currentUser.uid}`).once('value')).val(); await db.ref('videos').push({ url: this.videoFile.secure_url, title: t, description: d, userId: VoidAuth.currentUser.uid, username: u.username, userAvatar: u.avatar, likes: {}, comments:0, shares:0, views:0, timestamp: firebase.database.ServerValue.TIMESTAMP }); this.closeModal(); VoidVideo.loadFeed(); }
};

const VoidProfile = {
    async load() { if(!VoidAuth.currentUser) return; const u = (await db.ref(`users/${VoidAuth.currentUser.uid}`).once('value')).val(); document.getElementById('profileCover').style.backgroundImage = `url(${u.cover})`; document.getElementById('profileAvatar').src = u.avatar; document.getElementById('profileName').textContent = `@${u.username}`; document.getElementById('profileBio').textContent = u.bio || ''; if(u.website){ document.getElementById('profileLink').href = u.website; document.getElementById('linkText').textContent = u.website.replace(/^https?:\/\//,''); } if(u.verified) document.getElementById('verifiedBadge').style.display = 'inline'; document.getElementById('profileFollowers').textContent = Object.keys(u.followers||{}).length; document.getElementById('profileFollowing').textContent = Object.keys(u.following||{}).length; const v = (await db.ref('videos').orderByChild('userId').equalTo(VoidAuth.currentUser.uid).once('value')).val() || {}; document.getElementById('profileVideos').textContent = Object.keys(v).length; },
    changeAvatar() { const i = document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange = async e => { const fd = new FormData(); fd.append('file', e.target.files[0]); fd.append('upload_preset','so_34k'); const r = await fetch('https://api.cloudinary.com/v1_1/duzoqh3jp/image/upload', {method:'POST', body:fd}); const d = await r.json(); await db.ref(`users/${VoidAuth.currentUser.uid}/avatar`).set(d.secure_url); this.load(); }; i.click(); },
    changeCover() { const i = document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange = async e => { const fd = new FormData(); fd.append('file', e.target.files[0]); fd.append('upload_preset','so_34k'); const r = await fetch('https://api.cloudinary.com/v1_1/duzoqh3jp/image/upload', {method:'POST', body:fd}); const d = await r.json(); await db.ref(`users/${VoidAuth.currentUser.uid}/cover`).set(d.secure_url); this.load(); }; i.click(); },
    openEditModal() { document.getElementById('editProfileModal').style.display='flex'; },
    async saveEdit() { const n = document.getElementById('editName').value, b = document.getElementById('editBio').value, w = document.getElementById('editWebsite').value; if(n) await db.ref(`users/${VoidAuth.currentUser.uid}/username`).set(n); if(b) await db.ref(`users/${VoidAuth.currentUser.uid}/bio`).set(b); if(w) await db.ref(`users/${VoidAuth.currentUser.uid}/website`).set(w); VoidApp.closeModal('editProfileModal'); this.load(); }
};

const VoidUser = {
    viewingUserId: null,
    async viewProfile(uid) { this.viewingUserId = uid; const u = (await db.ref(`users/${uid}`).once('value')).val(); document.getElementById('viewUserName').textContent = `@${u.username}`; document.getElementById('viewUserAvatar').src = u.avatar; document.getElementById('viewUserBio').textContent = u.bio || ''; document.getElementById('viewUserFollowers').textContent = Object.keys(u.followers||{}).length; document.getElementById('viewUserFollowing').textContent = Object.keys(u.following||{}).length; document.getElementById('userProfileModal').style.display = 'flex'; },
    async follow(uid) { if(!VoidAuth.currentUser){location.href='auth.html';return;} const r = db.ref(`users/${uid}/followers/${VoidAuth.currentUser.uid}`); (await r.once('value')).exists() ? await r.remove() : await r.set(true); await db.ref(`users/${VoidAuth.currentUser.uid}/following/${uid}`).set(true); },
    followCurrent() { this.follow(this.viewingUserId); VoidApp.closeModal('userProfileModal'); },
    openChat(uid) { VoidChat.openChat(uid); }
};

const VoidExplore = {
    async load() { const s = await db.ref('videos').limitToLast(12).once('value'); const v = s.val() || {}; document.getElementById('exploreGrid').innerHTML = Object.entries(v).reverse().map(([id, x]) => `<div style="aspect-ratio:9/16;cursor:pointer" onclick="VoidApp.switchPage('home')"><video src="${x.url}" style="width:100%;height:100%;object-fit:cover" muted></video></div>`).join(''); },
    voiceSearch() { const r = new webkitSpeechRecognition(); r.lang = 'ar-SA'; r.onresult = e => document.getElementById('searchInput').value = e.results[0][0].transcript; r.start(); }
};

const VoidChat = {
    currentChatUser: null, mediaRecorder: null, audioChunks: [],
    async loadConversations() { document.getElementById('conversationsList').innerHTML = '<p style="color:#888;padding:20px">المحادثات تظهر هنا</p>'; },
    async openChat(uid) { this.currentChatUser = uid; const u = (await db.ref(`users/${uid}`).once('value')).val(); document.getElementById('chatAvatar').src = u.avatar; document.getElementById('chatUsername').textContent = u.username; document.getElementById('chatWindow').style.display = 'flex'; this.loadMessages(); this.listenPresence(uid); },
    closeChat() { document.getElementById('chatWindow').style.display = 'none'; },
    async loadMessages() { const cid = [VoidAuth.currentUser.uid, this.currentChatUser].sort().join('_'); const s = await db.ref(`messages/${cid}`).once('value'); const m = s.val() || {}; const cont = document.getElementById('chatMessages'); cont.innerHTML = Object.values(m).map(x => `<div class="message-bubble ${x.sender===VoidAuth.currentUser.uid?'sent':'received'}">${x.type==='text'?x.text:x.type==='image'?`<img src="${x.url}" style="max-width:100%;border-radius:10px">`:`<audio controls src="${x.url}"></audio>`}<small style="display:block;margin-top:5px;opacity:0.6">${VoidApp.timeAgo(x.timestamp)}</small></div>`).join(''); },
    async sendMessage() { const t = document.getElementById('messageInput').value.trim(); if(!t) return; const cid = [VoidAuth.currentUser.uid, this.currentChatUser].sort().join('_'); await db.ref(`messages/${cid}`).push({ sender: VoidAuth.currentUser.uid, type: 'text', text: t, timestamp: firebase.database.ServerValue.TIMESTAMP }); document.getElementById('messageInput').value = ''; this.loadMessages(); },
    async attachImage() { const i = document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange = async e => { const fd = new FormData(); fd.append('file', e.target.files[0]); fd.append('upload_preset','so_34k'); const r = await fetch('https://api.cloudinary.com/v1_1/duzoqh3jp/image/upload', {method:'POST', body:fd}); const d = await r.json(); const cid = [VoidAuth.currentUser.uid, this.currentChatUser].sort().join('_'); await db.ref(`messages/${cid}`).push({ sender: VoidAuth.currentUser.uid, type: 'image', url: d.secure_url, timestamp: firebase.database.ServerValue.TIMESTAMP }); this.loadMessages(); }; i.click(); },
    async toggleRecording() { if(!this.mediaRecorder){ const s = await navigator.mediaDevices.getUserMedia({audio:true}); this.mediaRecorder = new MediaRecorder(s); this.audioChunks = []; this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data); this.mediaRecorder.onstop = () => this.uploadAudio(); this.mediaRecorder.start(); document.getElementById('recordingIndicator').style.display = 'flex'; } else { this.mediaRecorder.stop(); this.mediaRecorder = null; document.getElementById('recordingIndicator').style.display = 'none'; } },
    async uploadAudio() { const b = new Blob(this.audioChunks, {type:'audio/webm'}); const fd = new FormData(); fd.append('file', b); fd.append('upload_preset','so_34k'); const r = await fetch('https://api.cloudinary.com/v1_1/duzoqh3jp/upload', {method:'POST', body:fd}); const d = await r.json(); const cid = [VoidAuth.currentUser.uid, this.currentChatUser].sort().join('_'); await db.ref(`messages/${cid}`).push({ sender: VoidAuth.currentUser.uid, type: 'audio', url: d.secure_url, timestamp: firebase.database.ServerValue.TIMESTAMP }); this.loadMessages(); },
    listenPresence(uid) { db.ref(`users/${uid}/presence`).on('value', s => { const p = s.val(); document.getElementById('chatStatus').innerHTML = p === 'online' ? '<span class="online-dot"></span> متصل الآن' : `آخر ظهور ${new Date(p).toLocaleString('ar-SA')}`; }); db.ref(`users/${VoidAuth.currentUser.uid}/presence`).set('online'); db.ref(`users/${VoidAuth.currentUser.uid}/presence`).onDisconnect().set(Date.now()); },
    openChatWithCurrent() { this.openChat(VoidUser.viewingUserId); VoidApp.closeModal('userProfileModal'); }
};

const VoidNotifications = {
    init() { if(VoidAuth.currentUser) db.ref(`notifications/${VoidAuth.currentUser.uid}`).on('value', s => { const b = document.getElementById('notifBadge'), c = s.numChildren(); c ? (b.textContent=c,b.style.display='block') : b.style.display='none'; }); },
    load() { document.getElementById('notificationsList').innerHTML = '<p style="color:#888;padding:20px">الإشعارات تظهر هنا</p>'; }
};

const VoidReport = { open() { if(!VoidAuth.currentUser){location.href='auth.html';return;} db.ref('reports').push({ videoId: VoidVideo.currentVideoId, reporter: VoidAuth.currentUser.uid, reason: 'محتوى غير لائق', status: 'pending', timestamp: firebase.database.ServerValue.TIMESTAMP }); alert('✅ تم إرسال البلاغ'); } };

const VoidAdmin = {
    async load() { if(VoidAuth.currentUser?.email !== ADMIN_EMAIL) return; await this.loadStats(); await this.loadUsers(); this.setupTabs(); },
    async loadStats() { const u = (await db.ref('users').once('value')).numChildren(); const v = (await db.ref('videos').once('value')).numChildren(); const r = (await db.ref('reports').once('value')).numChildren(); const b = (await db.ref('users').orderByChild('role').equalTo('banned').once('value')).numChildren(); document.getElementById('adminUsers').textContent = u; document.getElementById('adminVideos').textContent = v; document.getElementById('adminReports').textContent = r; document.getElementById('adminBanned').textContent = b; },
    async loadUsers() { const s = await db.ref('users').once('value'); const u = s.val() || {}; document.getElementById('adminUsersList').innerHTML = Object.entries(u).map(([id, x]) => `<div class="admin-user-item"><div style="display:flex;align-items:center;gap:10px"><img src="${x.avatar}"><div><strong>@${x.username}</strong><div style="font-size:12px">${x.email}</div></div></div><div class="admin-actions">${!x.verified?`<button class="admin-btn btn-verify" onclick="VoidAdmin.verify('${id}')">توثيق</button>`:''} ${x.role!=='banned'?`<button class="admin-btn btn-ban" onclick="VoidAdmin.ban('${id}')">حظر</button>`:`<button class="admin-btn btn-unban" onclick="VoidAdmin.unban('${id}')">فك</button>`} <button class="admin-btn btn-delete" onclick="VoidAdmin.deleteUser('${id}')">حذف</button></div></div>`).join(''); },
    setupTabs() { document.querySelectorAll('.tab-btn').forEach(t => t.onclick = () => { document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active')); t.classList.add('active'); const tab = t.dataset.tab; document.getElementById('adminUsersList').style.display = tab==='users'?'block':'none'; document.getElementById('adminReportsList').style.display = tab==='reports'?'block':'none'; document.getElementById('adminVideosList').style.display = tab==='videos'?'block':'none'; if(tab==='reports') this.loadReports(); if(tab==='videos') this.loadVideos(); }); },
    async loadReports() { const s = await db.ref('reports').once('value'); const r = s.val() || {}; document.getElementById('adminReportsList').innerHTML = Object.entries(r).map(([id, x]) => `<div style="background:rgba(255,255,255,0.05);padding:15px;border-radius:15px;margin-bottom:10px"><p>الفيديو: ${x.videoId}</p><p>السبب: ${x.reason}</p><button class="admin-btn btn-delete" onclick="VoidAdmin.deleteVideo('${x.videoId}')">حذف الفيديو</button></div>`).join(''); },
    async loadVideos() { const s = await db.ref('videos').limitToLast(20).once('value'); const v = s.val() || {}; document.getElementById('adminVideosList').innerHTML = Object.entries(v).reverse().map(([id, x]) => `<div style="background:rgba(255,255,255,0.05);padding:15px;border-radius:15px;margin-bottom:10px"><p><strong>@${x.username}</strong> - ${x.title||''}</p><button class="admin-btn btn-delete" onclick="VoidAdmin.deleteVideo('${id}')">حذف</button></div>`).join(''); },
    async verify(uid) { await db.ref(`users/${uid}/verified`).set(true); this.loadUsers(); },
    async ban(uid) { await db.ref(`users/${uid}/role`).set('banned'); this.loadUsers(); this.loadStats(); },
    async unban(uid) { await db.ref(`users/${uid}/role`).set('user'); this.loadUsers(); this.loadStats(); },
    async deleteUser(uid) { if(confirm('حذف المستخدم؟')){ await db.ref(`users/${uid}`).remove(); this.loadUsers(); this.loadStats(); } },
    async deleteVideo(vid) { if(confirm('حذف الفيديو؟')){ await db.ref(`videos/${vid}`).remove(); this.loadVideos(); this.loadStats(); } }
};

document.addEventListener('DOMContentLoaded', () => { VoidApp.init(); window.VoidApp = VoidApp; window.VoidVideo = VoidVideo; window.VoidUpload = VoidUpload; window.VoidProfile = VoidProfile; window.VoidUser = VoidUser; window.VoidExplore = VoidExplore; window.VoidChat = VoidChat; window.VoidNotifications = VoidNotifications; window.VoidReport = VoidReport; window.VoidAdmin = VoidAdmin; });
