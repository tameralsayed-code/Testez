const CACHE_NAME = 'production-app-v1'; // عندما تحدث أكوادك مستقبلاً، قم بتغيير v1 إلى v2 ليتم تحديث التطبيق عند المستخدمين

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

// 3. الاعتراض (جلب الملفات بسرعة الصاروخ من الهاتف، وتحديثها في الخلفية)
self.addEventListener('fetch', event => {
  // لا نتدخل في اتصالات قاعدة بيانات فايربيس
  if (event.request.method !== 'GET' || event.request.url.includes('firebaseio.com')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // جلب التحديثات من الإنترنت في الخلفية
      const fetchPromise = fetch(event.request).then(networkResponse => {
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
        });
        return networkResponse;
      }).catch(() => {
          // تجاهل الخطأ في حالة انقطاع الإنترنت
      });

      // إرجاع الملف من الذاكرة فوراً إذا كان موجوداً، وإلا انتظر الإنترنت
      return cachedResponse || fetchPromise;
    })
  );
});