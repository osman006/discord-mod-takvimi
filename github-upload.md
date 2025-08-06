# GitHub'a Proje Yükleme Rehberi

## 🔧 Git Kurulumu Sonrası Komutlar

Git'i kurduktan sonra PowerShell'i yeniden başlatın ve aşağıdaki komutları sırasıyla çalıştırın:

### 1. Git Yapılandırması
```powershell
git config --global user.name "Adınız Soyadınız"
git config --global user.email "email@example.com"
```

### 2. Git Repository Başlatma
```powershell
git init
```

### 3. .gitignore Kontrolü
.gitignore dosyası zaten mevcut, hassas dosyaları koruyacak.

### 4. Dosyaları Git'e Ekleme
```powershell
git add .
```

### 5. İlk Commit
```powershell
git commit -m "İlk commit: Discord Moderatör Takvim Botu"
```

### 6. Ana Branch Ayarlama
```powershell
git branch -M main
```

### 7. GitHub Repository Bağlama
GitHub'da oluşturduğunuz repository URL'ini kullanın:
```powershell
git remote add origin https://github.com/KULLANICI_ADINIZ/discord-mod-schedule-bot.git
```

### 8. GitHub'a Yükleme
```powershell
git push -u origin main
```

## 🔐 GitHub Token Gerekebilir

Eğer şifre isterse:
1. GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. "Generate new token (classic)" 
3. İzinleri seçin: repo, workflow
4. Token'ı kopyalayın ve şifre yerine kullanın

## 📁 Proje Yapısı

Repository'nizde şu dosyalar olacak:
```
discord-mod-schedule-bot/
├── src/
│   ├── commands/
│   ├── events/
│   ├── utils/
│   └── database/
├── package.json
├── README.md
├── config.example.env
├── .gitignore
└── github-upload.md
```

## ✅ Kontrol

Yükleme başarılı olduktan sonra:
- GitHub repository sayfanızı yenileyin
- Tüm dosyaların görünür olduğunu kontrol edin
- README.md dosyasının düzgün görüntülendiğini doğrulayın

## 🔄 Sonraki Güncellemeler İçin

Değişiklik yaptığınızda:
```powershell
git add .
git commit -m "Değişiklik açıklaması"
git push
``` 