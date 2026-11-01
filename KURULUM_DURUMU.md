# WinProducts X — GitHub öncesi durum / 31.10.2026 / v1.4

## Kod olarak tamamlananlar

- [x] Türkçe 30 günlük / 60 tweet editoryal havuzu; günde 1 URL'li, 1 URL'siz ve tek görsel kuralı
- [x] API gerektirmeyen, kullanıcı seçtiği kamuya açık Shopify mağazaları üzerinden ürün adayı çıkarma aracı
- [x] Gerçek WinProducts Web Store eklentisini (ID: maplianemjpbfdhnmfpjhbjnmimbncla) masaüstü Chrome'da tespit etme kodu
- [x] Playwright kalıcı Chromium profili + X11 tam masaüstü (`scrot`) çekimi ve kullanıcı onay akışı; gerçek eklenti henüz denenmedi
- [x] Panel DOM metninden tahmini ziyaret/satış göstergelerini güvenli şekilde okuma (uygun panel seçicisi varsa)
- [x] Günün ürününü kaynak, güncellik, puan ve tekrar kontrolüne göre seçme
- [x] Görüntü yoksa yayın yapmama; görsel için SHA256/PNG/boyut denetimi
- [x] X resmi API ile tek görselli yayınlama kodu (canlı sınanmadı)
- [x] **24/24 yerel birim ve simüle edilmiş arayüz testi başarılı**

## Henüz doğrulanmamış gerçek dış sistemler

- [ ] Gerçek WinProducts eklentisi bu çalışma ortamında yüklü değil, üyelik oturumu yok; **gerçek eklentili ekran görüntüsü otomatik çekilmedi**
- [ ] Eklentinin üretim sürümüne özel seçiciler öğrenilmedi; otomatik başsız çekim henüz aktif değil
- [ ] Kullanıcının kendi araştırma havuzu/site bağlantısı bağlanmadı; ilk adaylar kullanıcı URL'lerinden gelecek
- [ ] GitHub Actions'a geçici bilgisayardan kalıcı eklenti oturumu aktaran bir çözüm yok; GitHub entegrasyonu bilerek yapılmadı
- [ ] X Developer API/OAuth anahtarları ve gerçek tek görselli tweet yayını canlı test edilmedi

`npm run preflight` eksik yerel şartları raporlar. Sahte ekran görüntüleri X'e yayınlanmaz.

- [x] Önceki hata düzeltildi: Playwright `page.screenshot` Chrome side paneli almadığından tam masaüstü görüntüsü uygulanmıştır.
- [ ] GitHub runner üzerinde WinProducts gerçek yan panelinin otomatik açılması doğrulanmadı.

## v1.4 güncellemesi (01.11.2026)

- [x] Gerçek Chrome Web Store ID bulundu: `maplianemjpbfdhnmfpjhbjnmimbncla`.
- [x] Resmî Google indirme servisi için otomatik CRX3 kurucu kodlandı.
- [x] CRX3'ün public key → Chrome Store ID tutarlılığı, zip traversal ve yerel kurulum senaryoları için 5 çevrimdışı test başarılı.
- [x] Orijinal uzantıyı Chromium'da yüklemeyi test edecek GitHub Actions manuel smoke-workflow eklendi.
- [ ] Bu çalışma ortamının dış ağ erişimi kapalı: **Google'dan gerçek CRX indirme henüz canlı doğrulanmadı**.
- [ ] Gerçek hesapla yan panel açıp gerçek SS almak hâlâ test edilmedi.
- [ ] GitHub deposunda çalışma yapılmadı; X yayınlama etkin değil.
