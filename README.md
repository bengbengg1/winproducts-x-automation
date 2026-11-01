## GitHub PUBLIC depo için kurulum notu (v1.4.1)

Bu proje `bengbengg1/winproducts-x-automation` deposu için hazırlanmıştır. Görünürlük **Public** kalabilir. Depoya kullanıcı parolaları, X/WinProducts oturum dosyaları, API anahtarları veya tarayıcı profilleri **yüklemeyin**. Kimlik bilgileri daha sonra yalnızca GitHub Actions Secrets alanında tutulmalıdır.

- Zamanlanan çalıştırmalar güvenlik nedeniyle başlangıçta **beklemede**: `AUTOMATION_ARMED=true` adlı GitHub Actions **variable** eklenmeden otomatik iş başlamaz.
- Gerçek gönderim için bundan ayrı olarak `PUBLISH_ENABLED=true` değişkeni ve X kimlikleri gereklidir. Şu anda bunları ayarlamayın.
- **Actions → WinProducts Chrome Eklentisi - Resmi Surum Testi → Run workflow** yalnızca eklentiyi yüklemeyi dener; hesap girişi veya X paylaşımı yapmaz.
- Gerçek sağ panel ekran görüntüsü ve kalıcı güvenli oturum henüz doğrulanmadı. Bu nedenle **tamamen otomatik üretim ve canlı paylaşım hazır olarak düşünülmemelidir**.

---

## v1.4 — Resmî WinProducts Chrome eklentisini otomatik indirme

WinProducts ücretsiz Chrome uzantısını arkadaşından dosya istemeden, orijinal Google Chrome Web Store güncelleme sunucusundan indiren kurucu eklendi:

```bash
npm run extension:install
```

Kurulum konumu: `.extensions/winproducts/` (Git/ZIP dışında). Eklenti ID: `maplianemjpbfdhnmfpjhbjnmimbncla`.

Kurulumdan sonra grafik masaüstü/Xvfb ve Playwright bulunan ortamda `npm run extension:smoke` ile **yükleme testi** çalışır. Bu, giriş yapılmış WinProducts panelini veya tweet ekran görüntüsünü doğrulamaz. GitHub Actions için **manuel** `.github/workflows/winproducts-extension-smoke.yml` testi hazırdır. İnternet/Google dağıtım erişimi sağlanmazsa kurulum başarısız olur. Üçüncü taraf CRX kullanılmaz.

Detaylar: [EKLENTI_KURULUMU.md](EKLENTI_KURULUMU.md).

---

# WinProducts Türkiye — X İçerik Otomasyonu (v1.2)

**Durum:** GitHub ve X hesabı bağlanmadı; gerçek Chrome eklentisinden ilk canlı ekran görüntüsü henüz çekilmedi. Kodun çevrimdışı birim testleri geçti. İlk canlı tweet KAPALI. Bu paket, WinProducts'un ücretli/özel API'sini **gerektirmez**.

## Ne yapar?

- **Türkçe günde 2 gönderi:** 12:30'da WinProducts bağlantılı, 19:30'da URL'siz; **her tweette yalnızca 1 gerçek 1600×900 PNG**.
- Kategori dağılımını yaklaşık %35 Shopify mağazaları, %25 ürün, %25 reklam analizi, %15 e-ticaret taktiği olarak hedefleyen 30 günlük editoryal plan.
- Başlangıçta kullanıcı tarafından seçilen mağazaların herkese açık ürün linklerinden bir aday havuzu oluşturabilir. İncelenen adaylar içinden günün konusunu 30 günlük aynı mağazayı tekrar etmeme ve kaynak/tazelik puanıyla seçer.
- WinProducts'un **Chrome Web Store'dan yüklü ücretsiz eklentisini** bilgisayarda tespit etmeyi dener; Playwright özel otomasyon profiliyle gerçek Shopify sayfasını ve eklentiyi aynı ekranda açar.
- Oturum açıksa ve panel görünüyorsa gerçek **tarayıcı ekran görüntüsünü** kaydeder. Eklenti kimliği gerçek Web Store uzantısı `maplianemjpbfdhnmfpjhbjnmimbncla` olarak kontrol edilir. İlk kurulumda eklentiye giriş ve paneli açma **elle yapılır**; tanınan CSS seçiciler sonradan otomatiğe çevrilebilir.
- Görsel operatörce incelenip onaylanmadan tweet hazırlamaz. Görselden metrik uydurmaz; belirtilen gerçek panel HTML'inde açıkça görülen sayıları okuyabilirse **tahmini** olarak niteler.
- Mükerrer yayın, geç kalmış yayın ve belirsiz ağ sonucu korumaları; X resmî API kodu ve ilerideki GitHub Actions dosyası mevcut.

## Ön koşullar

Masaüstü **Windows/Mac/Linux**, Chrome'da ücretsiz [WinProducts eklentisi](https://chromewebstore.google.com/detail/maplianemjpbfdhnmfpjhbjnmimbncla), normal WinProducts üyeliği, Node.js 22 ve internet gerekir. Bu işlem **iPhone'da veya iPhone Chrome'da** Chrome eklentisi çalıştırılarak yapılamaz. X API anahtarlarına yalnızca gerçek paylaşım aşamasında ihtiyaç var.

## API'siz ilk gerçek ekran görüntüsü için yol

```bash
npm install
npx playwright install chromium
npm test
npm run extension:find
npm run preflight
```

1. **Ürün adayları:** `data/store-seeds.sample.json` dosyasını `data/store-seeds.json` olarak kopyalayıp kendi araştırdığın mağazaların URL'lerini ve `enabled:true` değerini gir. `npm run research:discover`, mağazaların **yalnızca herkese açık ana sayfasında bulunan** `/products/` bağlantılarından ürün aday kuyruğu çıkarır. **Hiçbir ücretli WinProducts API'si, giriş veya özel endpoint kullanılmaz.** Dinamik bağlantı çıkmazsa tek bir ürün URL'si elle eklenebilir:

   ```bash
   npm run research:add -- --url 'https://gercek-magaza.com/products/urun-slug' --store 'Mağaza Adı' --product 'Ürün Adı' --category stores --insight 'Kaynaklı kısa gözlem' --takeaway 'İkinci paylaşım çıkarımı'
   npm run research:list
   ```

2. **Gerçek eklenti ekranı:** Araştırma kuyruğunda listelenen `p-...` ürün kimliğini kullan:

   ```bash
   npm run capture:interactive -- --id p-URUN_KIMLIGI --date 2026-11-01
   ```

   Masaüstünde Playwright'ın Chromium penceresi açılır. Normal WinProducts hesabınla **özel otomasyon profilinde bir kez giriş yap**, ürün sayfasının sağında ücretsiz WinProducts panelini göster. **EVET** yanıtını yalnızca gerçek trafik/mağaza panelini gördüğünde gir. İkinci görselde istersen başka bir sekme aç; her tweet için yine yalnızca bir ekran görüntüsü kullanılır. İki PNG `assets/sources/2026-11-01/` altına kaydedilir. Aynı görüntüyü iki gönderide kullanmak teknik olarak mümkün olsa da farklı panel sekmelerini öneriyoruz.

3. **Gerçeklik kontrolü:** PNG'lerde solda ürün/mağaza ve sağda **gerçek eklenti paneli** olduğuna bak. Eklenti login duvarı görünüyorsa onaylama. Ürün kaydında `insight` ve `takeaway` boşsa kaynaklı kısa değerlendirmeler ekle:

   ```bash
   npm run research:annotate -- --id p-URUN_KIMLIGI --insight 'Gerçek bir gözlem' --takeaway 'Gerçek bir çıkarım'
   npm run research:approve -- --id p-URUN_KIMLIGI
   ```

4. **İlk günlük önizleme** (canlı tweet atılmaz):

   ```bash
   node src/prepare.js --preview --date 2026-11-01
   ```

   İki tek görselli gönderi `previews/2026-11-01/` klasöründe üretilir. Uygun adaya ait gerçek onaylı iki ekran görüntüsü yoksa hazırlık durur; sahte grafik üretmez.

5. **Otomatik panel açmayı öğretme:** İlk kurulumda ücretsiz eklentinin yeni sürümüne göre `WINPRODUCTS_OPEN_SELECTOR` (sayfada tıklanan **gerçek** WinProducts logo öğesi) ve `WINPRODUCTS_PANEL_READY_SELECTOR` (görünen **gerçek** panel) ayarlanabilir. Bu CSS öğelerini doğrulamadan başsız otomatik moda geçme. Resmî Web Store belgeleri bu seçicileri yayınlamıyor. `WINPRODUCTS_EXTENSION_DIR` normalde gerekmez; öncelikle `.extensions/winproducts` resmi kurulum önbelleği, yoksa masaüstü Chrome kurulumu otomatik aranır. Profil `.browser-profile/` altında kalır ve GitHub'a yüklenmez.

## Günün ürününü kim seçer?

`src/research.js`: gönderi kategorisine uygun, kaynaklı, en çok 14 gün önce doğrulanmış, daha önce 30 gün boyunca paylaşılmamış **onaylı** adaylar arasından; tazelik, mevcut trafik büyüme sinyali, kanıt sayısı ve varsa reklama ilişkin kanıtları puanlayarak seçim yapar. Aday yoksa paylaşmaz. Ürünleri kafadan icat etmez. **Sıfırdan sınırsız ürün keşfi yapılmış değildir**: başlangıç mağaza URL'leri ve eklenti ile doğrulama gerekir. Otomatik günlük çekim için çalışan masaüstü/kalıcı bilgisayar ve gerçek eklentide kontrol edilmiş seçiciler gerekir.

Ücretsiz eklentinin resmî sayfasında Meta reklam araştırması şu an "Coming soon" olarak belirtiliyor. Reklam verilerini eklentide kesin var kabul etme; bunları ayrı izinli, doğrulanabilir kaynaklardan araştırana kadar reklam metrikli tweet oluşturma.

## Gizlilik, yayın ve GitHub

- **Hiçbir şifre, oturum çerezi veya Chrome profili git deposuna konmaz.** `.browser-profile/` ve `data/research-candidates.json` bilerek `.gitignore` içinde. Görseller onaylanmadan gerçek yayın yapılmaz.
- Canlı X paylaşımı ancak sonradan `PUBLISH_ENABLED=true`, geçerli X OAuth kullanıcı kimlikleri ve gerçek PNG verileriyle çalışır; şu an bunlar bağlı değil.
- GitHub Actions'ın geçici bilgisayarı **senin masaüstü Chrome eklentini veya oturumunu görmez**. Sadece ZIP'i GitHub'a koymak, otomatik ekran görüntüsü üretimini çözmez. Başarılı masaüstü testi sonrasında kalıcı çekim ortamı veya izinli güvenli oturum aktarımı tasarlanmalı; eklenti oturumunu depoda saklamamak gerekir.
- `ALLOW_ILLUSTRATIVE_PREVIEW=true` yalnızca eski şablon motorunun geliştirme önizlemesidir, **canlı gönderimde reddedilir**.

## Dosyalar

- `src/extension-path.js`: Masaüstü Chrome'daki gerçek WinProducts eklentisini bulur.
- `src/capture-extension.js`, `src/extension-capture.js`: Özel Chromium profilinde gerçek eklentili ekran yakalar.
- `src/discover-products.js`, `src/research-queue.js`, `src/research.js`: Ürün kuyruğu, keşif, onay ve seçim.
- `src/insights.js`: Gerçek panel DOM yazısından sınırlı veri çıkarımı (OCR veya sahte satış yok).
- `src/prepare.js`, `src/visuals.js`, `src/index.js`: Günlük 2 görsel ve tweet hazırlama; X yayın kodu.
- `tests/`: Yerel testler (gerçek eklenti login/API canlı testi değildir).

**Açık kaynak atıf:** Zamanlama yaklaşımı [burnworks/x-scheduled-posts](https://github.com/burnworks/x-scheduled-posts) projesinden esinlenmiştir. Kod, WinProducts ihtiyaçları için ayrı yazılmıştır.

## 1 Kasım 2026 — v1.3 yan panel düzeltmesi

**Önemli teknik düzeltme:** Eski sürümde `page.screenshot()` kullanılıyordu. Bu yöntem gerçek Chrome **yan panelini** (tarayıcının kendi arayüzünü) yakalayamaz. v1.3, ekranın tamamını X11 üzerinden `scrot` ile alır; yalnızca gerçek ekran görüntüsü, ekrandaki **gerçek WinProducts eklentisi** görünürken onaylanabilir. Çıkış 1600×900 PNG'dir.

- Bu mod **Linux + X11 + Xvfb + scrot + Chromium** gerektirir. macOS/Windows masaüstü yakalama aracı henüz eklenmedi. `npm run capture:interactive -- --id ...` komutu X11 ortamında çalışır ve kullanıcının `EVET` diyerek paneli görsel olarak doğrulamasını ister.
- Chromium **headed** açılır. Chrome'un `sidePanel.open()` API'si kullanıcı hareketi gerektirdiğinden ve WinProducts eklentisinin gerçek UI kontrol yapısı henüz bilinmediğinden otomatik panel açma **doğrulanmış değildir**. <https://developer.chrome.com/docs/extensions/reference/api/sidePanel>
- GitHub Actions bulut bilgisayarına eklentinin **izinli paketinin** kurulması, yetkili oturumun güvenli ve kalıcı yönetimi ve panelin gerçekten açılması ayrı doğrulama gerektirir. `src/capture-extension.js` **henüz** GitHub workflow'una bağlanmamıştır; testleri geçmek bulutun gerçek ekran görüntüsü oluşturabildiğini kanıtlamaz.
- `npm run research:approve -- --id URUN_ID --confirm-real-panel` kullanmadan önce **her iki görseli açıp gerçek eklenti panelini kontrol edin**. Onaylanmayan kayıtlar yayınlanamaz.
- v1.3 yerel `npm test`, X11 teknik duman testi ve hazırlanmış içerik testleri gerçek X paylaşımı veya WinProducts üyelik entegrasyonu yerine geçmez.
