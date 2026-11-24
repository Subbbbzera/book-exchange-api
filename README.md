# Book Exchange API

REST API сервісу обміну книгами, де користувачі додають власні книги, шукають книги інших у публічному каталозі та обмінюються ними через запити на обмін.

## Стек технологій

- **Framework:** NestJS 10 + TypeScript (`strict: true`, без `any`)
- **ORM & Database:** Prisma 5 + PostgreSQL 16
- **Auth & Security:** `@nestjs/jwt`, Passport JWT, `bcrypt`, `RolesGuard` + `@Roles()`
- **Validation & Serialization:** `class-validator`, `class-transformer` (`@Exclude` / `@Expose`), `@nestjs/config`
- **Documentation:** Swagger (`@nestjs/swagger`) на `/docs`
- **Testing:** Jest + Supertest (E2E-тести на реальній тестовій БД PostgreSQL)

---

## Швидкий старт

### 1. Встановлення залежностей

```bash
npm install
```

### 2. Налаштування змінних середовища (`.env`)

Скопіюйте `.env.example` у `.env`:

```bash
cp .env.example .env
```

Обов'язкові змінні середовища (валідуються при старті застосунку через `@nestjs/config` + `class-validator`; без будь-якої з них застосунок не запуститься):

| Змінна | Опис | Приклад |
| --- | --- | --- |
| `NODE_ENV` | Середовище виконання (`development`, `production`, `test`) | `development` |
| `PORT` | Порт HTTP-сервера | `3000` |
| `DATABASE_URL` | Рядок підключення до PostgreSQL | `postgresql://postgres:postgrespassword@localhost:5435/book_exchange?schema=public` |
| `JWT_SECRET` | Секретний ключ для підпису JWT (мін. 16 символів) | `replace-with-strong-secret-at-least-16-chars` |
| `JWT_EXPIRES_IN` | Час життя JWT токена | `1d` |
| `ADMIN_EMAIL` | Email адміністратора для seed-скрипта | `admin@bookexchange.local` |
| `ADMIN_PASSWORD` | Пароль адміністратора для seed-скрипта (мін. 8 символів) | `ReplaceWithStrongAdminPassword123!` |
| `ADMIN_NAME` | Ім'я адміністратора | `System Admin` |
| `ADMIN_PHONE` | Телефон адміністратора | `+380500000000` |

### 3. Запуск PostgreSQL через Docker Compose

```bash
docker compose up -d
```

Це запустить два контейнери:
- `book_exchange_postgres` (порт `5435`) — основна БД `book_exchange`
- `book_exchange_postgres_test` (порт `5434`) — тестова БД `book_exchange_test` для E2E-тестів

### 4. Застосування міграцій та Seed адміністратора

```bash
npm run prisma:migrate
npm run prisma:seed
```

### 5. Запуск сервера та Swagger UI

```bash
npm run start:dev
```

- Сервер: `http://localhost:3000`
- Інтерактивна документація **Swagger UI**: `http://localhost:3000/docs`

---

## Тестування та перевірка якості коду

```bash
# Застосувати міграції до тестової БД та запустити E2E-тести
npx prisma migrate deploy
npm run test:e2e

# Перевірка лінтером та збірка
npm run lint
npm run build
```

---

## Список ендпоінтів API

### 1. Auth (`/auth`)
- `POST /auth/register` — реєстрація нового користувача (`name`, `email`, `phone`, `password`; роль за замовчуванням `USER`).
- `POST /auth/login` — логін, повертає `{ accessToken, user }`. Заблокований користувач отримує `403 Forbidden`.
- `GET /auth/me` — поточний авторизований користувач (Bearer JWT).
- `POST /auth/forgot-password` — запит на відновлення пароля через email (генерує токен на 15 хвилин, зберігає його SHA-256 хеш у БД та надсилає лист через `MailService`).
- `POST /auth/reset-password` — скидання пароля за допомогою токена з email (`token`, `newPassword`).

### 2. Профіль (`/me`)
- `GET /me` — профіль поточного користувача + `myBooksCount` (кількість моїх книг) + `pendingIncomingRequestsCount` (кількість вхідних запитів у статусі `PENDING`).
- `PATCH /me` — оновлення профілю (`name`, `email`, `phone`, `avatar`).

### 3. Мої книги (`/me/books`)
- `GET /me/books` — пагінований список власних книг (`page`, `limit`).
- `POST /me/books` — додавання книги (`name`, `author`, `genre`, `condition`: `NEW | GOOD | WORN`, `photo`).
- `PATCH /me/books/:id` — редагування власної книги.
- `DELETE /me/books/:id` — видалення власної книги в транзакції з `FOR UPDATE` (заборонено видаляти книгу з активним запитом на обмін або вже обміняну книгу — `409 Conflict`).

### 4. Публічний каталог (`/books`)
- `GET /books` — список лише доступних (`AVAILABLE`) книг. Підтримує:
  - `search` — пошук за `name` або `author` (case-insensitive)
  - `genre` — фільтр за жанром
  - `condition` — фільтр за станом (`NEW`, `GOOD`, `WORN`)
  - `sortOrder` — сортування за алфавітом (`asc` або `desc`)
  - `page`, `limit` (макс. `50`) — пагінація на бекенді
- `GET /books/:id` — деталі доступної книги та публічні дані власника (`id`, `name`) **БЕЗ `email` і `phone`**.

### 5. Запити на обмін та Історія обмінів
- `POST /books/:id/exchange-requests` — створити запит на обмін (`message`, `offeredBookIds`). Заборонено запитувати свою книгу (`400`), пропонувати чужі книги (`403`), пропонувати недоступні книги або дублювати активний запит (`409`).
- `GET /me/exchange-requests` — пагінований список вхідних та вихідних запитів із фільтрами `status` (`PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`) та `direction` (`incoming`, `outgoing`). Контакти (`email`, `phone`) приховані (`null`), доки статус не стане `ACCEPTED`.
- `PATCH /exchange-requests/:id` — зміна статусу запиту (дозволено лише з `PENDING`, інакше `409`):
  - Власник запитаної книги може передати `status: "ACCEPTED"` (разом із `selectedOfferedBookId`) або `status: "REJECTED"`.
  - Відправник запиту може передати `status: "CANCELLED"`.
- `GET /me/exchanges` — пагінована історія успішних обмінів поточного користувача.
- `POST /exchanges/:id/reviews` — залишити відгук та оцінку `1..5` (`rating`, `comment`) другому учаснику після завершеного обміну (кожен учасник може залишити максимум один відгук на один обмін).
- `GET /me/reviews` — пагінований список отриманих відгуків поточного користувача.

### 6. Адмін-розділ (`/admin`, роль `ADMIN`)
- `GET /admin/users` — список користувачів із пошуком (`search`) та пагінацією.
- `POST /admin/users` — створення користувача з можливістю задати роль та статус блокування.
- `PATCH /admin/users/:id` — редагування користувача, зміна ролі або блокування (`isBlocked: true / false`).
- `DELETE /admin/users/:id` — видалення користувача.
- `DELETE /admin/books/:id` — видалення будь-якої книги адміністратором.

---

## Архітектурні рішення, Консистентність даних та Припущення

### 1. Захист від Race Condition при одночасному прийнятті двох запитів на обмін
- **Чому без захисту два запити пройдуть:** На стандартному рівні ізоляції PostgreSQL (`READ COMMITTED`) дві паралельні транзакції, які спочатку читають книгу через `SELECT`, одночасно побачать `status = 'AVAILABLE'`. Якщо після цього обидві виконають безумовний `UPDATE "Book" SET status = 'EXCHANGED' WHERE id = ...`, обидві транзакції успішно завершаться, переведуть обидва запити в `ACCEPTED` і створять два суперечливі записи в історії обмінів для однієї книги (помилка TOCTOU / Lost Update).
- **Як реалізовано захист:** Уся операція прийняття обміну виконується в `prisma.$transaction`, де першим кроком виконується **умовне оновлення (Compare-And-Swap)** через `tx.book.updateMany({ where: { id: requestedBookId, status: BookStatus.AVAILABLE }, data: { status: BookStatus.EXCHANGED } })`. PostgreSQL накладає ексклюзивне блокування рядка (`row-level write lock`) під час `UPDATE`: перша транзакція змінює статус на `EXCHANGED` і отримує `count: 1`, а друга транзакція після завершення першої бачить, що умова `status = 'AVAILABLE'` більше не виконується (`count: 0`), викидає `409 ConflictException` і повністю відкочується. Крім того, оновлення книг виконується перед оновленням запиту, що забезпечує єдиний порядок взяття блокувань і унеможливлює PostgreSQL deadlock (`40P01`).

### 2. Унікальний індекс у БД для активних запитів на обмін
- Вимога забороняє дублювати **активний (`PENDING`)** запит від того самого користувача на ту саму книгу, але якщо попередній запит було відхилено (`REJECTED`) чи скасовано (`CANCELLED`), новий запит створити можна.
- Тому в міграції створено **частковий унікальний індекс PostgreSQL (Partial Unique Index)**:
  ```sql
  CREATE UNIQUE INDEX "ExchangeRequest_senderId_requestedBookId_pending_key"
  ON "ExchangeRequest"("senderId", "requestedBookId")
  WHERE "status" = 'PENDING';
  ```

### 3. Припущення (Assumptions), зроблені там, де вимоги неоднозначні
1. **Видимість обміняних книг у `/me/books`:** У вимогах зазначено, що після прийняття обміну книги отримують статус `EXCHANGED` і зникають із публічного каталогу (`/books`). Ми припустили, що в особистому кабінеті власника (`GET /me/books`) книги зі статусом `EXCHANGED` залишаються видимими (з полем `"status": "EXCHANGED"`), щоб користувач бачив історію своїх книг, але їх не можна повторно запропонувати для обміну чи видалити.
2. **Публічність каталогу (`/books`):** Маршрути `GET /books` та `GET /books/:id` зроблені публічними (доступними без JWT-токена), щоб неавторизовані відвідувачі могли переглядати каталог книг перед реєстрацією, тоді як створення запиту на обмін (`POST /books/:id/exchange-requests`) вимагає авторизації.
3. **Видалення книги з активним запитом:** Користувачу заборонено видаляти власну книгу (`DELETE /me/books/:id`), якщо вона фігурує в активному (`PENDING`) запиті як запитана книга (`requestedBookId`) **або** як одна із запропонованих книг (`offeredBooks`), а також якщо книга вже брала участь у завершеному обміні (`ExchangeHistory`). Водночас адміністратор (`DELETE /admin/books/:id`) має повноваження примусово видалити будь-яку книгу (при цьому активні запити з цією книгою автоматично переводяться в `CANCELLED`).
4. **Контакти в `/me/exchange-requests` та Email-сповіщення власнику:** У вимогах зазначено, що при створенні запиту на обмін *"Власнику йде email з іменем і email відправника та списком його книг"*, і водночас *"Після прийняття: сторони бачать контакти одна одної (email, телефон)"*. Щоб обидві вимоги виконувались без порушення приватності в REST API:
   - Після успішного коміту транзакції створення запиту `MailService` надсилає власнику книги email-сповіщення з ім'ям, email-ом відправника та списком запропонованих книг.
   - У відповідях REST API (`ExchangeRequestResponseDto`) поля `email` та `phone` обох сторін (`sender` і `owner`) повертаються як `null` для всіх статусів (`PENDING`, `REJECTED`, `CANCELLED`) і відкриваються в API виключно після переходу запиту в статус `ACCEPTED`.
