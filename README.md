# Depo Stok Takip Sistemi

Bu depo, Excel dosyalarını kullanarak stok yönetimi yapabileceğiniz profesyonel görünümlü bir web arayüzü içerir. Sistem;

- Depoya giren ürünleri Excel üzerinden içeri aktarır,
- Transfer ve satış işlemlerinde stoktan düşüm yapar,
- Güncel stok durumu, kritik seviyeler ve katalog bilgilerini ayrı panellerde sunar,
- Anlık metrik kartlarıyla toplam SKU, stok miktarı ve işlem adetlerini takip eder,
- İstendiğinde stok listesini tekrar Excel olarak indirmenize imkân tanır.

## Nasıl Çalışır?

1. `stock-tracker/index.html` dosyasını çift tıklayarak tarayıcınızda açın.
2. Dashboard’daki **Excel İşlemleri** kartlarından yapmak istediğiniz operasyonu (depo girişi, transfer/çıkış veya satış) seçin.
3. Her kartta yer alan **Excel Yükle** butonuyla bilgisayarınızdaki `.xlsx`/`.xls` dosyasını seçin.
4. Dosya satır satır analiz edilir; stok kodu eşleşiyorsa miktar depo girişinde artırılır, transfer ve satışta düşülür.
5. Her işlem sonrası **İşlem Günlüğü** panelinde kaç satır işlendiği, atlanan satırlar ve uyarılar detaylı biçimde görüntülenir.
6. **Güncel Stok Durumu** tablosu kritik stok takibiyle birlikte otomatik yenilenir; sağ üstteki **Güncel Stoku İndir** butonuyla Excel dışa aktarımı yapabilirsiniz.
7. **Ürün Kataloğu** panelinden stokta olan veya Excel ile eklenmiş tüm ürün tanımlarını filtreleyebilirsiniz.

> **İpucu:** Dosyada aynı stok kodundan birden fazla satır varsa hepsi üst üste eklenir. Kodu boş olan satırlar otomatik olarak atlanır.

## Excel Şablonu

Excel dosyanızda en azından aşağıdaki başlıklardan bir kombinasyonu bulunmalıdır:

| Zorunlu | Önerilen Başlıklar |
| ------- | ------------------ |
| ✅      | `Stok Kodu`, `Ürün Adı`, `Miktar` |
| Opsiyonel | `Kategori`, `Birim`, `SKU`, `Ürün Kod`, `Lokasyon`, `Minimum Stok`, `Açıklama` |

- Stok kodu sütunu boşsa satır işlenmez.
- `Miktar` değeri sayıya dönüştürülemezse satır atlanır ve özet bölümünde uyarı gösterilir.
- Satış veya transfer işlemlerinde miktar mevcut stoktan büyükse ürün miktarı sıfıra sabitlenir ve uyarı verilir.

## İpuçları

- Aynı stok kodu ilk kez yüklendiğinde ürün adı/birimi Excel’den alınır; kategori, lokasyon ve açıklama gibi bilgiler ürün kataloğuna kaydedilir.
- Dashboard’daki metrikler (Toplam SKU, stok miktarı, işlem adetleri ve uyarılar) her yükleme sonrası otomatik güncellenir.
- Tablo verileri tarayıcı belleğinde tutulur. Sayfayı yenilerseniz sıfırlanır; düzenli dışa aktarmayı unutmayın.
- **Excel Şablonu** butonu üzerinden örnek bir çalışma dosyası indirebilirsiniz.

## Başlangıç

Kurulum gerektirmez; dosyayı açmanız yeterlidir. Dilerseniz basit bir http sunucusunda (ör. `npx serve stock-tracker`) barındırabilirsiniz.

> **Not:** Excel dosyalarınızda `Stok Kodu`, `Ürün Adı`, `Birim` (opsiyonel) ve `Miktar` sütunlarının bulunmasına dikkat edin.

## Teknolojiler

- Vanilla HTML, CSS ve JavaScript
- Excel dosya okuma/yazma işlemleri için [SheetJS](https://sheetjs.com/) (CDN üzerinden)

## Geliştirme

Kod düzenlemeleri `stock-tracker` klasöründe yer almaktadır. İhtiyaçlarınıza göre bileşenleri genişletebilir veya mevcut fonksiyonları farklı sistemlerle entegre edebilirsiniz.
