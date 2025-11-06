DropSpot – Full Stack Challenge (FastAPI + React)

Başlangıç Zamanı: <YYYYMMDDHHmm>

Özet
- Amaç: Sınırlı stoklu drop’larda bekleme listesi ve claim penceresi akışı.
- Stack: Backend FastAPI + SQLAlchemy + PostgreSQL (lokalde SQLite), Frontend React (TS) + Tailwind + Zustand + React Query, Cache/RateLimit için Redis.
- Teslim: 72 saat, GitHub repo ve PR tabanlı süreç.

Mimari
- backend/: FastAPI uygulaması, domain katmanları (routers, services, schemas, models), transaction ve idempotency yönetimi
- frontend/: React uygulaması (Next.js veya Vite), sayfalar: drop listesi, detay/claim, admin CRUD
- scripts/: seed üretim script’i

Veri Modeli (taslak)
- User: id, email, password_hash, role(user/admin), created_at
- Drop: id, title, description, starts_at, claim_window_start, claim_window_end, stock, is_active
- Waitlist: id, user_id, drop_id, joined_at (unique user_id+drop_id)
- Claim: id, user_id, drop_id, code(unique), status(issued|redeemed|expired), claimed_at

Endpoint’ler (taslak)
- POST /auth/signup
- POST /auth/login
- GET /drops
- POST /drops/:id/join
- POST /drops/:id/leave
- POST /drops/:id/claim
- POST /admin/drops
- PUT /admin/drops/:id
- DELETE /admin/drops/:id

Idempotency ve Transaction
- Join/leave/claim işlemleri unique constraint’ler ve tek transaction ile yönetilir.
- Aynı isteğin tekrarı sonucu değiştirmez; gerekli durumlarda mevcut durum döndürülür.
- Uygun hata kodları: 400/401/403/404/409/422.

Seed Üretimi ve priority_score
- Seed girdileri: remote_url | first_commit_epoch | start_time(YYYYMMDDHHmm)
- SHA256 → ilk 12 hex. A/B/C katsayıları seed’den türetilir.
- priority_score = base + (signup_latency_ms % A) + (account_age_days % B) - (rapid_actions % C)

Kurulum (kısa not)
- Backend: FastAPI, SQLAlchemy. DB için PostgreSQL veya lokalde SQLite. Ortam değişkenleri `.env`.
- Frontend: React + TS + Tailwind. API çağrıları için React Query, global state için Zustand.
- Redis: Cache ve rate limit.

Test ve CI
- Backend: unit (service), integration (API/idempotency)
- Frontend: 2 component testi veya e2e smoke
- CI: GitHub Actions ile install, lint, test

Ekran Görüntüleri
- Drop listesi, claim ekranı, admin panel (teslim öncesi eklenecek)

Teknik Tercihler ve Notlar
- Transaction’larda yarış koşulları için tutarlı kilitleme stratejisi.
- Idempotency için unique index ve upsert/desenleri.

Bonus
- Admin panelde AI ile açıklama önerisi (OpenAI API veya mock).


