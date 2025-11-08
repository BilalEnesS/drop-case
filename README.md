# DropSpot – Full Stack Challenge (FastAPI + React)

**Başlangıç Zamanı:** 202511061423

## Seed ve Katsayılar

**Seed:** `4f1f6e19edf7`

**Katsayılar:**
- A = 11
- B = 16
- C = 5

**Priority Score Formülü:**
```
priority_score = base + (signup_latency_ms % 11) + (account_age_days % 16) - (rapid_actions % 5)
```

**Seed Hesaplama Detayları:**
- Remote URL: `https://github.com/BilalEnesS/drop-case.git`
- İlk commit epoch: `1762428071`
- Başlangıç zamanı: `202511061423`
- Raw input: `https://github.com/BilalEnesS/drop-case.git|1762428071|202511061423`
- SHA256 hash (ilk 12 karakter): `4f1f6e19edf7`

---

## 1. Proje Özeti ve Mimari Açıklama

### Proje Özeti

DropSpot, özel ürünlerin veya etkinliklerin sınırlı stokla yayımlandığı bir platformdur. Kullanıcılar bu platformda drop'lara kayıt olabilir, bekleme listesine katılabilir ve "claim window" zamanı geldiğinde sırayla hak kazanırlar.

**Ana Özellikler:**
- Kullanıcı kayıt ve giriş sistemi (JWT tabanlı)
- Drop listeleme ve detay görüntüleme
- Bekleme listesine katılma/ayrılma (idempotent)
- Priority score tabanlı claim sistemi
- Admin paneli (CRUD işlemleri, kullanıcı yönetimi)
- AI destekli drop açıklama önerisi (bonus)
- Redis cache ve rate limiting
- Docker Compose ile kolay deployment

**Teknoloji Stack:**
- **Backend:** FastAPI, SQLAlchemy (async), PostgreSQL, Redis, PyJWT, bcrypt
- **Frontend:** React, TypeScript, Tailwind CSS, Vite, React Router DOM
- **Test:** pytest, Vitest, React Testing Library
- **CI/CD:** GitHub Actions
- **Deployment:** Docker Compose

### Mimari Açıklama

#### Backend Mimari

Proje **katmanlı mimari (layered architecture)** prensiplerine göre yapılandırılmıştır:

```
backend/
├── app/
│   ├── main.py                 # FastAPI uygulama giriş noktası
│   ├── core/                   # Çekirdek modüller
│   │   ├── config.py          # Yapılandırma yönetimi
│   │   ├── security.py        # JWT ve password hashing
│   │   ├── cache.py           # Redis cache utilities
│   │   └── rate_limit.py      # Rate limiting
│   ├── db/                     # Veritabanı bağlantıları
│   │   ├── session.py         # SQLAlchemy async session
│   │   └── redis.py           # Redis connection
│   ├── models/                 # SQLAlchemy modelleri
│   │   ├── user.py
│   │   ├── drop.py
│   │   ├── waitlist.py
│   │   └── claim.py
│   ├── repositories/           # Veri erişim katmanı
│   │   ├── user_repo.py
│   │   ├── drop_repo.py
│   │   ├── waitlist_repo.py
│   │   └── claim_repo.py
│   ├── services/               # İş mantığı katmanı
│   │   ├── auth_service.py
│   │   ├── drop_service.py
│   │   ├── priority_service.py
│   │   └── ai_service.py
│   ├── routers/                # API endpoint'leri
│   │   ├── auth.py
│   │   ├── drop.py
│   │   ├── admin.py
│   │   ├── admin_users.py
│   │   └── health.py
│   └── schemas/                # Pydantic şemaları
│       ├── auth.py
│       ├── drop.py
│       └── admin.py
├── tests/                       # Test dosyaları
│   ├── test_services.py        # Unit testler
│   └── test_api_idempotency.py # Integration testler
└── requirements.txt
```

**Katmanlar:**
1. **Router Layer:** HTTP isteklerini alır, validation yapar, dependency injection sağlar
2. **Service Layer:** İş mantığını encapsulate eder, transaction yönetimi yapar
3. **Repository Layer:** Veritabanı işlemlerini soyutlar
4. **Model Layer:** Veritabanı şemasını tanımlar

#### Frontend Mimari

```
frontend/
├── src/
│   ├── App.tsx                 # Ana uygulama bileşeni, routing
│   ├── main.tsx                # Entry point
│   ├── api/
│   │   └── client.ts           # API client (Axios wrapper)
│   ├── pages/                  # Sayfa bileşenleri
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   ├── Home.tsx
│   │   ├── DropDetail.tsx
│   │   └── Admin.tsx
│   ├── components/             # Yeniden kullanılabilir bileşenler
│   │   └── ThemeToggle.tsx
│   └── test/                   # Test utilities
└── package.json
```

**Özellikler:**
- Component-based architecture
- Client-side routing (React Router DOM)
- API client abstraction
- Dark mode desteği
- Optimistic UI updates

---

## 2. Veri Modeli ve Endpoint Listesi

### Veri Modeli

#### User
```python
- id: int (primary key)
- email: str (unique, indexed)
- password_hash: str
- role: str (enum: "user" | "admin")
- rapid_actions: int (default: 0) # Priority score için
- created_at: datetime (timezone-aware)
```

#### Drop
```python
- id: int (primary key)
- title: str
- description: str | None
- starts_at: datetime # Drop'un görünür olacağı zaman
- claim_window_start: datetime # Claim penceresi başlangıcı
- claim_window_end: datetime # Claim penceresi bitişi
- stock: int # Mevcut stok miktarı
- is_active: bool (default: True)
```

#### Waitlist
```python
- id: int (primary key)
- user_id: int (foreign key -> User.id)
- drop_id: int (foreign key -> Drop.id)
- joined_at: datetime (timezone-aware)
- UNIQUE(user_id, drop_id) # Idempotency için
```

#### Claim
```python
- id: int (primary key)
- user_id: int (foreign key -> User.id)
- drop_id: int (foreign key -> Drop.id)
- code: str (unique) # Tek seferlik claim kodu
- status: str (enum: "issued" | "redeemed" | "expired")
- claimed_at: datetime
```

**İlişkiler:**
- User ↔ Waitlist (one-to-many)
- User ↔ Claim (one-to-many)
- Drop ↔ Waitlist (one-to-many)
- Drop ↔ Claim (one-to-many)

### Endpoint Listesi

#### Authentication Endpoints

##### POST /auth/signup
Kullanıcı kayıt işlemi.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "email": "user@example.com",
  "role": "user"
}
```

##### POST /auth/login
Kullanıcı giriş işlemi.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Cookie:** `access_token` HTTP-only cookie olarak da set edilir.

#### Drop Endpoints

##### GET /drops
Aktif drop listesini getirir. Sadece `starts_at <= now` olan drop'lar gösterilir.

**Headers:**
- `Authorization: Bearer <token>` (opsiyonel, authenticated kullanıcılar için `joined` ve `claimed` flag'leri döner)

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "title": "Limited Edition Drop",
    "description": "Exclusive product",
    "starts_at": "2025-11-08T10:00:00Z",
    "claim_window_start": "2025-11-08T12:00:00Z",
    "claim_window_end": "2025-11-08T18:00:00Z",
    "stock": 10,
    "is_active": true,
    "joined": false,
    "claimed": false
  }
]
```

**Cache:** Redis cache kullanılır (non-authenticated istekler için).

##### POST /drops/{drop_id}/join
Bekleme listesine katılma.

**Headers:**
- `Authorization: Bearer <token>` (zorunlu)

**Response:** `204 No Content`

**Rate Limit:** 10 requests / 5 minutes (user-based)

**Idempotency:** Aynı kullanıcı birden fazla kez join ederse hata vermez, mevcut kayıt korunur.

##### POST /drops/{drop_id}/leave
Bekleme listesinden ayrılma.

**Headers:**
- `Authorization: Bearer <token>` (zorunlu)

**Response:** `204 No Content`

**Rate Limit:** 10 requests / 5 minutes (user-based)

**Idempotency:** Kullanıcı zaten listede değilse hata vermez.

##### POST /drops/{drop_id}/claim
Claim işlemi. Sadece claim window açıkken ve kullanıcı waitlist'teyse çalışır.

**Headers:**
- `Authorization: Bearer <token>` (zorunlu)

**Response:** `200 OK`
```json
{
  "code": "ABC123XYZ"
}
```

**Rate Limit:** 5 requests / 5 minutes (user-based)

**Idempotency:** Aynı kullanıcı birden fazla kez claim ederse aynı kod döner.

**Priority System:** Sadece priority score'a göre stok içinde olan kullanıcılar claim edebilir.

##### GET /drops/claimed
Kullanıcının claim ettiği drop'ları listeler.

**Headers:**
- `Authorization: Bearer <token>` (zorunlu)

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "title": "Limited Edition Drop",
    "claim_code": "ABC123XYZ"
  }
]
```

#### Admin Endpoints

##### GET /admin/drops
Tüm drop'ları listeler (admin only).

**Headers:**
- `Authorization: Bearer <token>` (admin role zorunlu)

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "title": "Limited Edition Drop",
    "description": "Exclusive product",
    "starts_at": "2025-11-08T10:00:00Z",
    "claim_window_start": "2025-11-08T12:00:00Z",
    "claim_window_end": "2025-11-08T18:00:00Z",
    "stock": 10,
    "is_active": true
  }
]
```

##### POST /admin/drops
Yeni drop oluşturur (admin only).

**Request:**
```json
{
  "title": "New Drop",
  "description": "Description",
  "starts_at": "2025-11-08T10:00:00Z",
  "claim_window_start": "2025-11-08T12:00:00Z",
  "claim_window_end": "2025-11-08T18:00:00Z",
  "stock": 10,
  "is_active": true
}
```

**Response:** `201 Created`

##### PUT /admin/drops/{drop_id}
Drop günceller (admin only).

**Request:**
```json
{
  "title": "Updated Drop",
  "stock": 20
}
```

**Response:** `200 OK`

##### DELETE /admin/drops/{drop_id}
Drop siler (admin only).

**Response:** `204 No Content`

##### GET /admin/drops/{drop_id}/waitlist
Drop'un waitlist'ini priority score ile birlikte listeler (admin only).

**Response:** `200 OK`
```json
[
  {
    "user_id": 1,
    "email": "user@example.com",
    "priority_score": 105,
    "rank": 0,
    "account_age_days": 5,
    "rapid_actions": 2,
    "can_claim": true
  }
]
```

##### POST /admin/drops/suggest-description
AI ile drop açıklaması önerir (admin only, bonus özellik).

**Request:**
```json
{
  "title": "Limited Edition Sneakers"
}
```

**Response:** `200 OK`
```json
{
  "description": "Premium quality sneakers with unique design..."
}
```

#### Admin User Management Endpoints (Bonus)

##### GET /admin/users
Tüm kullanıcıları listeler (admin only).

##### POST /admin/users
Yeni kullanıcı/admin oluşturur (admin only).

##### PUT /admin/users/{user_id}/role
Kullanıcı rolünü günceller (admin only).

##### DELETE /admin/users/{user_id}
Kullanıcı siler (admin only).

#### Health Check Endpoints

##### GET /health/live
Liveness probe.

##### GET /health/ready
Readiness probe (database ve Redis bağlantı kontrolü).

---

## 3. CRUD Modülü Açıklaması

Admin CRUD modülü, drop'ların tam yaşam döngüsünü yönetmek için tasarlanmıştır.

### Drop Yönetimi

**Özellikler:**
- ✅ Drop oluşturma (title, description, zamanlar, stok)
- ✅ Drop güncelleme (tüm alanlar güncellenebilir)
- ✅ Drop silme
- ✅ Drop listeleme (aktif ve inaktif)
- ✅ Waitlist görüntüleme (priority score ile)
- ✅ AI destekli açıklama önerisi

**Zaman Yönetimi:**
- `starts_at`: Drop'un kullanıcılara görünür olacağı zaman
- `claim_window_start`: Claim penceresinin açılacağı zaman
- `claim_window_end`: Claim penceresinin kapanacağı zaman

**Otomatik Deaktivasyon:**
- `claim_window_end` geçen drop'lar otomatik olarak `is_active = false` olur
- Bu işlem `GET /drops` ve `GET /admin/drops` endpoint'lerinde lazy olarak yapılır

### Kullanıcı Yönetimi (Bonus)

Admin paneli, Django admin benzeri bir kullanıcı yönetim sistemi sunar:

- ✅ Kullanıcı listeleme
- ✅ Yeni kullanıcı/admin oluşturma
- ✅ Kullanıcı rolü güncelleme
- ✅ Kullanıcı silme

**Rol Yönetimi:**
- `user`: Normal kullanıcı, drop'lara katılabilir
- `admin`: Yönetici, sadece platform yönetimi yapabilir (drop'lara katılamaz)

---

## 4. Idempotency Yaklaşımı ve Transaction Yapısı

### Idempotency Stratejisi

Tüm kritik işlemler **idempotent** olacak şekilde tasarlanmıştır:

#### 1. Join Waitlist
- **Mekanizma:** `UNIQUE(user_id, drop_id)` constraint
- **Davranış:** Aynı kullanıcı birden fazla kez join ederse hata vermez, mevcut kayıt korunur
- **Implementation:** `upsert_waitlist` fonksiyonu, önce kontrol eder, varsa günceller, yoksa ekler

#### 2. Leave Waitlist
- **Mekanizma:** Soft delete (kayıt silinir)
- **Davranış:** Kullanıcı zaten listede değilse hata vermez (404 döner ama idempotent)
- **Implementation:** `delete_waitlist` fonksiyonu, kayıt yoksa hata vermez

#### 3. Claim
- **Mekanizma:** Claim kaydı için `UNIQUE(user_id, drop_id)` kontrolü
- **Davranış:** Aynı kullanıcı birden fazla kez claim ederse aynı kod döner
- **Implementation:** Önce mevcut claim kaydı kontrol edilir, varsa mevcut kod döner

### Transaction Yönetimi

**Strateji:** Transaction yönetimi **router seviyesinde** yapılır. Service ve repository katmanları sadece `db.flush()` kullanır, commit yapmaz.


**Avantajları:**
- Transaction sınırları açık ve net
- Hata durumunda rollback garantisi
- Service katmanı transaction'dan bağımsız (test edilebilirlik)

### Race Condition Koruması

#### Claim İşlemi
Claim işleminde race condition'ları önlemek için:

1. **Priority Check:** Kullanıcının priority score'una göre sıralama yapılır
2. **Stock Check:** Mevcut stok kontrol edilir
3. **Atomic Decrement:** Stock atomik olarak azaltılır (`try_decrement_stock`)
4. **Claim Record:** Claim kaydı oluşturulur


### Hata Kodları

- **400 Bad Request:** Validation hatası
- **401 Unauthorized:** Authentication gerekiyor
- **403 Forbidden:** Yetki yok (örn: admin join/leave/claim yapamaz, priority too low)
- **404 Not Found:** Kaynak bulunamadı
- **409 Conflict:** Çakışma (örn: email zaten alınmış, claim window kapalı, stok yok)
- **422 Unprocessable Entity:** Pydantic validation hatası
- **429 Too Many Requests:** Rate limit aşıldı

---

## 5. Kurulum Adımları (Backend ve Frontend)

### Docker Compose ile (Önerilen)

**Gereksinimler:**
- Docker
- Docker Compose

**Adımlar:**

1. **Repository'yi klonlayın:**
   ```bash
   git clone https://github.com/BilalEnesS/drop-case.git
   cd drop-case
   ```

2. **.env dosyası oluşturun (opsiyonel):**
   ```bash
   # Root dizinde .env dosyası oluşturun
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=1234
   POSTGRES_DB=dropspot
   JWT_SECRET=your-secret-key-here
   ENV=development
   PRIORITY_SEED=4f1f6e19edf7
   PRIORITY_COEFF_A=11
   PRIORITY_COEFF_B=16
   PRIORITY_COEFF_C=5
   OPENAI_API_KEY=your-api-key (opsiyonel)
   ```

   **Not:** Eğer `.env` dosyası yoksa, `docker-compose.yml`'deki varsayılan değerler kullanılır.

3. **Tüm servisleri başlatın:**
   ```bash
   docker-compose up -d
   ```

4. **Log'ları görüntüleyin:**
   ```bash
   docker-compose logs -f
   ```

5. **Servisleri durdurun:**
   ```bash
   docker-compose down
   ```

**Servisler:**
- **PostgreSQL:** `localhost:5432`
- **Redis:** `localhost:6379`
- **Backend:** `http://localhost:8000`
- **Frontend:** `http://localhost:5173`

**Notlar:**
- PostgreSQL Docker container'da çalışır
- Backend container'dan PostgreSQL container'a direkt bağlanır
- Redis Docker container'da çalışır
- Tüm servisler aynı Docker network'ünde

### Manuel Kurulum (Local)

**Gereksinimler:**
- Python 3.11+
- Node.js 20+
- PostgreSQL (veya SQLite)
- Redis (opsiyonel, cache/rate limiting için)

#### Backend Kurulumu

1. **Backend dizinine gidin:**
   ```bash
   cd backend
   ```

2. **Virtual environment oluşturun (önerilen):**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # veya
   venv\Scripts\activate  # Windows
   ```

3. **Bağımlılıkları yükleyin:**
   ```bash
   pip install -r requirements.txt
   ```

4. **.env dosyası oluşturun:**
   ```bash
   DATABASE_URL=postgresql+asyncpg://postgres:1234@localhost:5432/dropspot
   # veya SQLite için:
   # DATABASE_URL=sqlite+aiosqlite:///./data.db
   REDIS_URL=redis://localhost:6379/0
   JWT_SECRET=your-secret-key-here
   ENV=development
   PRIORITY_SEED=4f1f6e19edf7
   PRIORITY_COEFF_A=11
   PRIORITY_COEFF_B=16
   PRIORITY_COEFF_C=5
   OPENAI_API_KEY=your-api-key (opsiyonel)
   ```

5. **Backend'i başlatın:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

#### Frontend Kurulumu

1. **Frontend dizinine gidin:**
   ```bash
   cd frontend
   ```

2. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

3. **Frontend'i başlatın:**
   ```bash
   npm run dev
   ```

**Notlar:**
- Backend `http://localhost:8000` adresinde çalışır
- Frontend `http://localhost:5173` adresinde çalışır
- Redis yoksa cache ve rate limiting devre dışı kalır (fail-open stratejisi)

### Admin Kullanıcı Oluşturma

**Docker ile:**
```bash
docker-compose exec backend python /app/create_admin.py
```

**Local:**
```bash
cd backend
python create_admin.py
```

Varsayılan admin bilgileri:
- Email: `admin@example.com`
- Password: `admin123`

---

## 6. Ekran Görüntüleri

### 1. Login Sayfası

![Login Page](images/login_page.png)

Kullanıcı giriş sayfası. Email ve password ile giriş yapılabilir. Dark mode toggle butonu mevcuttur. Başarılı giriş sonrası kullanıcı rolüne göre yönlendirme yapılır (user → Home, admin → Admin Panel).

### 2. Signup Sayfası

![Signup Page](images/signup_page.png)

Yeni kullanıcı kayıt sayfası. Email ve password ile kayıt olunabilir. Dark mode desteği mevcuttur. Başarılı kayıt sonrası kullanıcı login sayfasına yönlendirilir.

### 3. Kullanıcı Ana Sayfa (Drop Listesi)

![User Page](images/user_page.png)

Kullanıcı ana sayfası. Aktif drop'lar listelenir. Her drop için:
- Drop bilgileri (title, description, stok, zamanlar)
- Join/Leave butonları
- Claim butonu (sadece claim window açıkken ve kullanıcı waitlist'teyse aktif)
- Claim edilen drop'lar için claim code görüntüleme

Alt kısımda kullanıcının claim ettiği drop'lar ve claim code'ları gösterilir.

### 4. Drop Detay Sayfası

![User Drop Detail](images/user_drop_detail.png)

Drop detay sayfası. Drop'un tüm bilgileri görüntülenir:
- Title, description
- Başlangıç zamanı, claim window zamanları
- Stok bilgisi
- Join/Leave/Claim işlemleri
- Claim code (eğer claim edilmişse, kopyalanabilir)

### 5. Admin Panel - Drop Yönetimi

![Admin Page](images/admin_page_whitemod.png)

Admin paneli ana sayfası aydınlık modda görünümü. Drop yönetimi ve kullanıcı yönetimi sekmeleri mevcuttur. Drop yönetimi sekmesinde:
- Aktif ve inaktif drop'lar listelenir
- Yeni drop oluşturma formu
- Drop düzenleme ve silme işlemleri
- Her drop için waitlist görüntüleme butonu

### 6. Admin Panel - AI Açıklama Önerisi

![Admin Suggest](images/admin_suggest.png)

Admin panelinde drop oluştururken AI destekli açıklama önerisi. "✨ AI Suggest" butonuna tıklandığında OpenAI API kullanılarak drop title'ına göre açıklama önerisi üretilir.

### 7. Admin Panel - Kullanıcı Yönetimi

![Admin User Add](images/admin_user_add.png)

Admin paneli kullanıcı yönetimi sekmesi. Django admin benzeri bir arayüz:
- Tüm kullanıcılar listelenir
- Yeni kullanıcı/admin oluşturma formu
- Kullanıcı rolü güncelleme (user/admin)
- Kullanıcı silme işlemleri

### 8. Admin Panel - Waitlist Görüntüleme

![Waitlist Admin](images/waitlist_admin.png)

Admin panelinde drop'un waitlist'ini görüntüleme. Her kullanıcı için:
- Email
- Priority score
- Rank (sıralama)
- Account age (gün)
- Rapid actions sayısı
- Can claim (stok içinde mi?)

---

## 7. Teknik Tercihler ve Kişisel Katkılar

### Teknik Tercihler

#### Backend

1. **FastAPI:**
   - Modern, hızlı web framework
   - Otomatik API dokümantasyonu (Swagger UI)
   - Type hints desteği
   - Async/await desteği

2. **SQLAlchemy (Async):**
   - Async database operations
   - Type-safe queries
   - Relationship management
   - Migration support (Alembic)

3. **Service Layer Pattern:**
   - İş mantığını router'dan ayırma
   - Test edilebilirlik
   - Kod tekrarını azaltma
   - Transaction yönetimi

4. **Repository Pattern:**
   - Veritabanı erişimini soyutlama
   - Test edilebilirlik
   - Database bağımsızlığı

5. **Redis:**
   - Cache için kullanım (drop listesi)
   - Rate limiting için kullanım
   - Fail-open stratejisi (Redis yoksa uygulama çalışmaya devam eder)

#### Frontend

1. **React + TypeScript:**
   - Type-safe frontend development
   - Component-based architecture
   - Reusability

2. **Tailwind CSS:**
   - Utility-first CSS framework
   - Hızlı UI geliştirme
   - Dark mode desteği
   - Responsive design

3. **React Router DOM:**
   - Client-side routing
   - Protected routes
   - Role-based redirection

4. **Optimistic UI Updates:**
   - Kullanıcı deneyimini iyileştirme
   - Anlık geri bildirim
   - Hata durumunda rollback

### Kişisel Katkılar

1. **Service Layer Architecture:**
   - İş mantığını router'dan ayırarak modüler bir yapı oluşturdum
   - Transaction yönetimini router seviyesinde topladım
   - Test edilebilirliği artırdım

2. **Priority-Based Claiming System:**
   - Adil claim sistemi için priority score mekanizması geliştirdim
   - Account age, signup latency, rapid actions faktörlerini dahil ettim
   - Race condition'ları önlemek için atomic operations kullandım

3. **Fail-Open Redis Strategy:**
   - Redis bağlantısı başarısız olsa bile uygulama çalışmaya devam eder
   - Cache ve rate limiting opsiyonel hale geldi
   - Production'da daha güvenilir bir sistem

4. **Idempotency Guarantees:**
   - Tüm kritik işlemler idempotent
   - Unique constraints ve transaction yönetimi ile garantili
   - Edge case'ler için kapsamlı testler

5. **Admin User Management:**
   - Django admin benzeri kullanıcı yönetim sistemi
   - Role-based access control
   - Admin kullanıcıların drop'lara katılamaması garantisi

6. **Drop Visibility Control:**
   - Drop'lar sadece `starts_at` zamanından sonra görünür
   - Kullanıcılar gelecekteki drop'lara katılamaz
   - Admin panelinde tüm drop'lar görünür

7. **AI Integration:**
   - OpenAI API ile drop açıklama önerisi
   - Admin panelinde kolay kullanım
   - Fallback mekanizması (API yoksa generic açıklama)

8. **Comprehensive Testing:**
   - Unit testler (service layer)
   - Integration testler (API endpoints)
   - Component testler (frontend)
   - Idempotency testleri
   - Edge case testleri

9. **Docker Compose Setup:**
   - Tüm servisleri tek komutla çalıştırma
   - Development ve production için hazır
   - Container-to-container communication

10. **CI/CD Pipeline:**
    - GitHub Actions ile otomatik test çalıştırma
    - Her push ve pull request'te otomatik kontrol
    - Backend ve frontend testleri

---

## 8. Seed Üretim Yöntemi ve Proje İçindeki Kullanımı

### Seed Üretim Adımları

1. **Projeye başladığın anın tarih ve saatini al (YYYYMMDDHHmm formatında)**
   - Örnek: `202511061423`

2. **GitHub remote URL'ini al:**
   ```bash
   git config --get remote.origin.url
   ```

3. **İlk commit zaman damgasını al:**
   ```bash
   git log --reverse --format=%ct | head -n1
   ```

4. **Bu verileri birleştir:**
   ```
   <remote_url>|<first_commit_epoch>|<start_time>
   ```

5. **SHA256 hash al ve ilk 12 karakterini seed olarak kullan:**
   ```python
   import hashlib
   raw = f"{remote_url}|{first_commit_epoch}|{start_time}"
   seed = hashlib.sha256(raw.encode()).hexdigest()[:12]
   ```

### Script Kullanımı

```bash
python scripts/generate_seed.py
```

Script otomatik olarak:
- Remote URL'i alır
- İlk commit epoch'unu bulur
- Başlangıç zamanını README'den okur (veya parametre olarak alır)
- Seed ve katsayıları hesaplar
- Sonuçları gösterir

### Katsayı Hesaplama

```python
A = 7 + (int(seed[0:2], 16) % 5)  # Örnek: 11
B = 13 + (int(seed[2:4], 16) % 7)  # Örnek: 16
C = 3 + (int(seed[4:6], 16) % 3)   # Örnek: 5
```

### Priority Score Formülü

```python
priority_score = base + (signup_latency_ms % A) + (account_age_days % B) - (rapid_actions % C)
```

**Bileşenler:**
- `base`: 100 (sabit değer)
- `signup_latency_ms`: Kullanıcının drop başladıktan sonra ne kadar süre sonra kayıt olduğu (ms)
- `account_age_days`: Hesap yaşı (gün)
- `rapid_actions`: Hızlı join/leave işlemleri sayısı (rapid_actions counter)

### Proje İçindeki Kullanımı

**Konfigürasyon:**
- Seed değeri ve katsayılar `backend/app/core/config.py` dosyasında environment variable olarak saklanır
- `PRIORITY_SEED`, `PRIORITY_COEFF_A`, `PRIORITY_COEFF_B`, `PRIORITY_COEFF_C` değişkenleri kullanılır

**Hesaplama:**
- `PriorityService` sınıfı bu değerleri kullanarak priority score hesaplar
- Her kullanıcı için waitlist'e katıldığı drop'a göre priority score hesaplanır

**Claim İşlemi:**
- Claim işleminde waitlist priority score'a göre sıralanır
- Sadece stok içinde olan kullanıcılar claim edebilir
- Priority score düşük olan kullanıcılar "priority_too_low" hatası alır

**Örnek:**
```python
# PriorityService.calculate_priority_score()
base = 100
signup_latency_ms = 5000  # 5 saniye
account_age_days = 3
rapid_actions = 2

priority_score = 100 + (5000 % 11) + (3 % 16) - (2 % 5)
priority_score = 100 + 5 + 3 - 2 = 106
```

---

## 9. Bonus: AI Entegrasyonu

### AI Destekli Drop Açıklama Önerisi

Admin panelinde drop oluştururken veya düzenlerken, AI destekli açıklama önerisi alabilirsiniz.

**Özellikler:**
- OpenAI API kullanımı
- Drop title'ına göre açıklama üretimi
- Profesyonel, kısa ve öz açıklamalar
- Hashtag ve emoji içermez
- Fallback mekanizması (API yoksa generic açıklama)

**Kullanım:**
1. Admin panelinde drop oluşturma/düzenleme formunu açın
2. Drop title'ını girin
3. "✨ AI Suggest" butonuna tıklayın
4. AI tarafından önerilen açıklama otomatik olarak description alanına doldurulur

**API Endpoint:**
```
POST /admin/drops/suggest-description
```

**Request:**
```json
{
  "title": "Limited Edition Sneakers"
}
```

**Response:**
```json
{
  "description": "Premium quality sneakers with unique design and exceptional comfort. Limited edition release with exclusive features."
}
```

**Implementation:**
- `backend/app/services/ai_service.py`: AI service sınıfı
- OpenAI GPT-3.5-turbo modeli kullanılır
- System prompt ile açıklama formatı belirlenir
- Response temizlenir (hashtag, emoji, uzunluk kontrolü)

**Konfigürasyon:**
- `OPENAI_API_KEY` environment variable ile API key ayarlanır
- API key yoksa fallback açıklama döner
- Rate limiting ve error handling mevcuttur

**Örnek System Prompt:**
```
You are a product description writer. Generate a concise, engaging product description 
for a limited edition drop based on the title. 
- Keep it under 150 characters
- No hashtags or emojis
- Professional tone
- Highlight key features
```

---

## Test ve CI/CD

### Backend Testleri

**Test Dosyaları:**
- `tests/test_services.py`: Unit testler (DropService)
- `tests/test_api_idempotency.py`: Integration testler (API endpoints)

**Test Çalıştırma:**
```bash
# Tüm testler
pytest -v

# Sadece unit testler
pytest tests/test_services.py

# Sadece integration testler
pytest tests/test_api_idempotency.py

# Belirli bir test
pytest tests/test_services.py::test_drop_service_join_waitlist_idempotent
```

**Test Kapsamı:**
- ✅ Join/leave/claim idempotency testleri
- ✅ Claim window validation testleri
- ✅ Priority-based claiming testleri
- ✅ Error handling testleri
- ✅ Edge case testleri

**Test Veritabanı:**
- In-memory SQLite database kullanılır
- Her test için yeni database oluşturulur
- Test isolation garantisi

### Frontend Testleri

**Test Dosyaları:**
- `src/components/__tests__/Login.test.tsx`: Login component testi
- `src/pages/__tests__/Home.test.tsx`: Home page testi

**Test Çalıştırma:**
```bash
# Watch mode (development)
npm test

# CI mode (single run)
npm run test:ci
```

**Test Kapsamı:**
- ✅ Component rendering testleri
- ✅ User interaction testleri
- ✅ API integration testleri
- ✅ Error handling testleri

### CI/CD Pipeline

**GitHub Actions Workflow:**
- Workflow dosyası: `.github/workflows/ci.yml`
- Her push ve pull request'te otomatik çalışır
- Backend: Python 3.11, pytest
- Frontend: Node.js 20, Vitest

**CI Durumu:**
GitHub repo > Actions sekmesinden CI durumunu görebilirsiniz.

**CI Adımları:**
1. Backend testleri çalıştırılır
2. Frontend testleri çalıştırılır
3. Frontend build kontrol edilir

---
## Sonuç

DropSpot projesi, case gereksinimlerinin tamamını karşılayan, production-ready bir full-stack uygulamadır. Tüm zorunlu özellikler implement edilmiş, bonus özellikler eklenmiş ve kapsamlı testler yazılmıştır.

---

## İletişim

- Email: bilalenessoylemez@gmail.com

---