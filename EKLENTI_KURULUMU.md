# WinProducts Chrome Web Store eklentisini otomatik kurma — v1.4

Resmî Chrome Web Store adresi:
https://chromewebstore.google.com/detail/maplianemjpbfdhnmfpjhbjnmimbncla

Resmî uzantı ID'si: `maplianemjpbfdhnmfpjhbjnmimbncla`.

## Yeni özellik: Eklentiyi arkadaşından ZIP istemeden kur

```bash
npm run extension:install
```

Bu komut **Google'ın kendi Chrome Web Store güncelleme sunucusundan** orijinal uzantıyı indirir; CRX3 biçimini ve paketteki public key'in Web Store uzantı kimliğiyle eşleştiğini kontrol eder (ayrıca kriptografik imza doğrulaması yapmaz). Dosyalar yalnızca `.extensions/winproducts/` klasörüne açılır. Kullanıcının Chrome profili, şifresi veya çerezleri kopyalanmaz. `.extensions/` Git deposuna ve paylaşılan ZIP'e **eklenmez**.

> Komut Google'ın resmî indirme sunucusuna internet erişimi ister. Google paket servisini kapatır/engeller veya uzantının dağıtım koşulları değişirse komut hata verir. Üçüncü taraf aynalardan değiştirilmiş CRX indirilmez.

## İlk teknik kontrol

1. `npm install` ve `npx playwright install chromium`.
2. Grafik oturumunun (masaüstü / Linux Xvfb) bulunduğu ortamda `npm run extension:smoke`.
3. Bu test **yalnızca** orijinal eklentinin kendi ID'siyle Chromium'da yüklendiğini doğrular. Bir Shopify mağazası veya WinProducts oturumu otomatik açılmış sayılmaz.

GitHub için **manuel tetiklenen**, hiçbir X gönderisi paylaşmayan `.github/workflows/winproducts-extension-smoke.yml` eklendi. GitHub deposu oluşturulduktan sonra Actions sekmesinden çalıştırılabilir.

## Gerçek tweet görselinin alınması hâlâ ne gerektiriyor?

- WinProducts eklentisinin **ücretsiz hesap girişinin** yeni geçici Chromium oturumunda çalışmasının test edilmesi.
- Eklentinin **yüzen buton / yan panel açma** davranışının gerçek sürümde görülüp güvenilir biçimde otomatikleştirilmesi. Chrome yan paneli normal `page.screenshot()` içinde çıkmaz; masaüstü ekranı yakalanmalıdır.
- Gerçek ürün URL'si, gerçek panel görünürlüğü, iki ayrı çekim ve görsellerin izin/onay kontrolü.
- GitHub runner'ı her işlemde temiz başladığı için girişin güvenli/uygun şekilde tekrar kurulabilmesi.

**Bu işlerin hiçbiri yalnızca uzantının indirildiği gerekçesiyle çalışıyor sayılmaz.** Hesap şifresi veya canlı oturum verisi ZIP/GitHub deposuna konmamalıdır. Canlı X paylaşımı varsayılan olarak kapalıdır.

## Yerel test

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Testler sahte CRX3 arşivleriyle, çevrimdışı ve gerçek Web Store sürümünü indirmeden çalışır. Gerçek tarayıcıyla doğrulama ayrıca yapılmalıdır.
