# GitHub Actions CI/CD

Bu klasör GitHub Actions workflow dosyalarını içerir.

## CI Workflow

`.github/workflows/ci.yml` dosyası otomatik test pipeline'ını tanımlar.

### Ne Zaman Çalışır?
- Her `push` (main, develop branch'lerine)
- Her `pull_request` (main, develop branch'lerine açıldığında)

### Ne Yapar?
1. **Backend Testleri:**
   - Python 3.11 kurulumu
   - Bağımlılıkları yükle (`pip install -r requirements.txt`)
   - Testleri çalıştır (`pytest -v`)

2. **Frontend Testleri:**
   - Node.js 20 kurulumu
   - Bağımlılıkları yükle (`npm ci`)
   - Testleri çalıştır (`npm run test:ci`)
   - Build kontrolü (`npm run build`)

### CI Durumunu Görme
1. GitHub repo'ya git
2. "Actions" sekmesine tıkla
3. Workflow çalışmalarını gör
4. Her commit'in yanında ✅ veya ❌ işareti görünür

### Yerel Test
CI'da çalışmadan önce yerel olarak test et:
```bash
# Backend
cd backend
pytest -v

# Frontend
cd frontend
npm run test:ci
```

### Sorun Giderme
- CI başarısız olursa: Actions sekmesinde detaylı log'ları kontrol et
- Yerel testler geçiyor ama CI'da geçmiyorsa: Bağımlılık versiyonlarını kontrol et
- Cache sorunları: GitHub Actions cache'ini temizle (Settings > Actions > Clear cache)
