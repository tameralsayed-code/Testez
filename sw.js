const CACHE_NAME = 'production-app-v8; // تم التحديث إلى v5 لفرض التحديث على الهواتف

// الملفات التي سيتم حفظها في الذاكرة المخفية للهاتف 
const ASSETS_TO_CACHE = [ 
    './', 
    './index.html', 
    './style.css', 
    './main.js', 
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://unpkg.com/vue@3/dist/vue.global.prod.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap'
];

// 1. التثبيت (تحميل الملفات لأول مرة) 
self.addEventListener('install', event => { 
    self.skipWaiting(); 
    event.waitUntil( 
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE); 
        }) 
    ); 
});

// 2. التفعيل (حذف الملفات القديمة إذا تم تغيير رقم الإصدار)
self.addEventListener('activate', event => { 
    event.waitUntil(
        caches.keys().then(cacheNames => { 
            return Promise.all( 
                cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)) 
            ); 
        }) 
    );
    self.clients.claim(); 
});

// 3. الاعتراض (استراتيجية: Network First للوصول للتحديثات فوراً)
self.addEventListener('fetch', event => { 
    // لا نتدخل في اتصالات قاعدة بيانات فايربيس أو الـ API
    if (event.request.method !== 'GET' || event.request.url.includes('firebaseio.com')) return;

    event.respondWith(
        // حاول إحضار النسخة الأحدث من الإنترنت أولاً
        fetch(event.request).then(networkResponse => {
            // إذا نجح الاتصال (يوجد إنترنت)، احفظ النسخة الجديدة في الكاش لتحديثه
            return caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
            });
        }).catch(() => {
            // إذا فشل الاتصال (لا يوجد إنترنت)، افتح التطبيق من الكاش القديم
            return caches.match(event.request);
        })
    ); 
});
