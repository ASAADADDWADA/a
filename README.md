# SKT Takip Sistemi

Android ve PC cihazlarında çalışan bu web uygulamasıyla ürünlerin son kullanma tarihlerini takip edin, barkod okuyun ve kayıtlarınızı bulutta saklayın.

## Özellikler

- **Kullanıcı Yönetimi:** E-posta/şifre ile giriş, kayıt olma ve e-posta üzerinden şifre sıfırlama.
- **Bulut Tabanlı Kayıt:** Her kullanıcıya özel Firestore koleksiyonunda ürünleri saklama.
- **Code 128 Barkod Tarama:** Kamerayı açarak barkod algılama; cihaz kamerası olmayan kullanıcılar manuel giriş yapabilir.
- **Kalan Gün Hesabı:** SKT seçildiğinde kalan gün otomatik hesaplanır ve tabloya durum rengi eklenir.
- **Excel Aktarımı:** Listelenen ürünleri tek tıklamayla `.xlsx` dosyası olarak indirin.

## Kurulum

1. [Firebase Console](https://console.firebase.google.com/) üzerinden bir proje oluşturun.
2. "Authentication" bölümünde **Email/Password** yöntemini etkinleştirin.
3. "Firestore Database" bölümünden bir veritabanı başlatın (Production veya Test modu).
4. Projenizin web uygulaması için Firebase yapılandırma bilgilerini alın.
5. Depodaki `firebase-config.example.js` dosyasını `firebase-config.js` olarak kopyalayın.
6. Yeni oluşturduğunuz `firebase-config.js` dosyasındaki `YOUR_...` alanlarını kendi Firebase web yapılandırma bilgilerinizle doldurun.
7. Gerekirse Firestore güvenlik kurallarınızı, yalnızca oturum açmış kullanıcının kendi koleksiyonuna erişmesine izin verecek şekilde güncelleyin.

## Çalıştırma

1. `index.html` dosyasını modern bir tarayıcıda açın.
2. Açılışta gelen ekrandan kullanıcı oluşturun veya mevcut hesabınızla giriş yapın.
3. Giriş yaptıktan sonra kamera ile barkod okuyabilir, manuel ürün ekleyebilir ve kayıtlarınızı görüntüleyebilirsiniz.
4. "Excel Olarak İndir" düğmesiyle tabloyu `.xlsx` formatında dışa aktarabilirsiniz.
5. Şifrenizi unuttuğunuzda "Şifremi unuttum" bağlantısından e-posta ile sıfırlama talebi gönderin.

> Not: `firebase-config.js` dosyası `.gitignore` içerisine eklenmiştir. Paylaşıma açık depolara yalnızca örnek dosyayı (`firebase-config.example.js`) yükleyin. Barkod isim eşleştirmeleri `app.js` içindeki `productCatalog` nesnesine eklenebilir.
