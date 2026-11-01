# v1.4 — Sıradaki gerçek test

Artık WinProducts eklentisinin ZIP dosyasını istemek gerekmiyor.
**Resmî Chrome Web Store'dan otomatik indirme eklendi:** `npm run extension:install`.

1. Google CRX indirme yolunu internet erişimli ortamda doğrula.
2. `npm run extension:smoke` ile gerçek Chromium'da extension ID ve service worker'ı doğrula.
3. Ücretsiz WinProducts hesap girişini güvenli oturum akışıyla doğrula; login/parola/kuki depoya yazılmaz.
4. Gerçek ürün mağaza sayfası yanında paneli aç ve X11 üzerinden gerçek 1600×900 SS üret.
5. Yalnızca doğrulanan panellerin kullanıldığı, otomatik tetiklenen günlük görsel akışını bağla.

**Kurulum kodunun eklenmesi, 3-5. adımların bitmesi anlamına gelmez.**
