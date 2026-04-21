const CACHE = 'void-lion-v1';
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./','./index.html','./auth.html','./css/style.css','./js/firebase.js','./js/auth.js','./js/app.js']))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
self.addEventListener('push', e => { const d = e.data?.json() || {title:'VOID LION',body:'إشعار جديد'}; e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:'./icon.png'})); });
