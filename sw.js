// قم بتغيير هذا الرقم في كل مرة ترفع فيها تحديثاً جديداً على GitHub
const CACHE_NAME = 'ezz-steel-prod-v1';

// الملفات الأساسية التي سيتم تحميلها للعمل أوفلاين
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './main.js'
];

// 1. حدث التثبيت (Install)
self.addEventListener('install', event => {
    // تفعيل الخدمة الجديدة فوراً دون انتظار
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log('Opened cache');
            return cache.addAll(urlsToCache);
        })
    );
});

// 2. حدث التفعيل (Activate) - تنظيف النسخ القديمة
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // السيطرة على كل نوافذ التطبيق المفتوحة فوراً
    self.clients.claim();
});

// 3. حدث جلب البيانات (Fetch) - نظام "الشبكة أولاً ثم الكاش"
self.addEventListener('fetch', event => {
    // تجاهل طلبات قواعد البيانات (Firebase) وتطبيقات الطرف الثالث
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        fetch(event.request)
        .then(response => {
            // إذا كان هناك إنترنت، نقوم بحفظ نسخة جديدة في الكاش وتمرير البيانات
            if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
            }
            return response;
        })
        .catch(() => {
            // إذا لم يكن هناك إنترنت (أوفلاين)، نجلب الملفات من الكاش
            return caches.match(event.request);
        })
    );
});
