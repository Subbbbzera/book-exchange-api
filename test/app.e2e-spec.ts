import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BookCondition,
  BookStatus,
  ExchangeRequestStatus,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Book Exchange API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    // Clean all tables in proper dependency order before each test
    await prisma.exchangeHistory.deleteMany();
    await prisma.exchangeRequestBook.deleteMany();
    await prisma.exchangeRequest.deleteMany();
    await prisma.book.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.exchangeHistory.deleteMany();
    await prisma.exchangeRequestBook.deleteMany();
    await prisma.exchangeRequest.deleteMany();
    await prisma.book.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  async function registerAndLogin(
    name: string,
    email: string,
    phone: string,
    password = 'Password123!',
  ): Promise<{ token: string; userId: string }> {
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name, email, phone, password })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    return {
      token: loginRes.body.accessToken as string,
      userId: regRes.body.id as string,
    };
  }

  it('1. Registration and login work properly, password is never exposed, and /auth/me returns user', async () => {
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Alice',
        email: 'alice@test.com',
        phone: '+380501112233',
        password: 'Password123!',
      })
      .expect(201);

    expect(regRes.body.email).toBe('alice@test.com');
    expect(regRes.body.role).toBe(Role.USER);
    expect(regRes.body.password).toBeUndefined();

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'alice@test.com',
        password: 'Password123!',
      })
      .expect(200);

    expect(typeof loginRes.body.accessToken).toBe('string');
    expect(loginRes.body.user.password).toBeUndefined();

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken as string}`)
      .expect(200);

    expect(meRes.body.id).toBe(regRes.body.id);
    expect(meRes.body.password).toBeUndefined();
  });

  it('2. USER cannot call /admin/* endpoints (403), while ADMIN can; blocked user cannot login or pass guard', async () => {
    const { token: userToken, userId } = await registerAndLogin(
      'Regular User',
      'user@test.com',
      '+380501111111',
    );

    await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    // Create ADMIN directly in DB and login
    const adminPasswordHash = await bcrypt.hash('AdminPass123!', 10);
    await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@test.com',
        phone: '+380500000000',
        password: adminPasswordHash,
        role: Role.ADMIN,
      },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'AdminPass123!' })
      .expect(200);

    const adminToken = adminLogin.body.accessToken as string;

    const usersList = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(usersList.body.items.length).toBe(2);

    // Admin blocks Regular User
    await request(app.getHttpServer())
      .patch(`/admin/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isBlocked: true })
      .expect(200);

    // Blocked user cannot pass JwtAuthGuard with existing token
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    // Blocked user cannot login
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@test.com', password: 'Password123!' })
      .expect(403);
  });

  it('3. GET /books/:id hides owner email and phone, and only returns owner id and name', async () => {
    const { token } = await registerAndLogin(
      'Book Owner',
      'owner@test.com',
      '+380502223344',
    );

    const bookRes = await request(app.getHttpServer())
      .post('/me/books')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Refactoring',
        author: 'Martin Fowler',
        genre: 'Programming',
        condition: BookCondition.NEW,
        photo: 'https://example.com/refactoring.jpg',
      })
      .expect(201);

    const detailRes = await request(app.getHttpServer())
      .get(`/books/${bookRes.body.id as string}`)
      .expect(200);

    expect(detailRes.body.name).toBe('Refactoring');
    expect(detailRes.body.owner).toEqual({
      id: expect.any(String),
      name: 'Book Owner',
    });
    expect(detailRes.body.owner.email).toBeUndefined();
    expect(detailRes.body.owner.phone).toBeUndefined();
    expect(detailRes.body.owner.password).toBeUndefined();
  });

  it('4. Forbids creating an exchange request for own book', async () => {
    const { token } = await registerAndLogin(
      'Alice',
      'alice@test.com',
      '+380501112233',
    );

    const book1 = await request(app.getHttpServer())
      .post('/me/books')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Book 1',
        author: 'Author 1',
        genre: 'Sci-Fi',
        condition: BookCondition.GOOD,
        photo: 'https://example.com/b1.jpg',
      })
      .expect(201);

    const book2 = await request(app.getHttpServer())
      .post('/me/books')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Book 2',
        author: 'Author 2',
        genre: 'Sci-Fi',
        condition: BookCondition.GOOD,
        photo: 'https://example.com/b2.jpg',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/books/${book1.body.id as string}/exchange-requests`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'Trying to request my own book',
        offeredBookIds: [book2.body.id],
      })
      .expect(400);
  });

  it('5. Forbids duplicate active (PENDING) exchange request from the same user for the same book', async () => {
    const owner = await registerAndLogin(
      'Owner',
      'owner@test.com',
      '+380501111111',
    );
    const sender = await registerAndLogin(
      'Sender',
      'sender@test.com',
      '+380502222222',
    );

    const targetBook = await request(app.getHttpServer())
      .post('/me/books')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Target Book',
        author: 'Author A',
        genre: 'Fantasy',
        condition: BookCondition.NEW,
        photo: 'https://example.com/target.jpg',
      })
      .expect(201);

    const offeredBook = await request(app.getHttpServer())
      .post('/me/books')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        name: 'Offered Book',
        author: 'Author B',
        genre: 'Fantasy',
        condition: BookCondition.GOOD,
        photo: 'https://example.com/offered.jpg',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/books/${targetBook.body.id as string}/exchange-requests`)
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        message: 'First request',
        offeredBookIds: [offeredBook.body.id],
      })
      .expect(201);

    // Second PENDING request from same sender to same target book must fail with 409 Conflict
    await request(app.getHttpServer())
      .post(`/books/${targetBook.body.id as string}/exchange-requests`)
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        message: 'Duplicate request',
        offeredBookIds: [offeredBook.body.id],
      })
      .expect(409);
  });

  it('6. Forbids deleting a book that has an active (PENDING) exchange request', async () => {
    const owner = await registerAndLogin(
      'Owner',
      'owner@test.com',
      '+380501111111',
    );
    const sender = await registerAndLogin(
      'Sender',
      'sender@test.com',
      '+380502222222',
    );

    const ownerBook = await request(app.getHttpServer())
      .post('/me/books')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Owner Book',
        author: 'Author A',
        genre: 'Drama',
        condition: BookCondition.NEW,
        photo: 'https://example.com/ob.jpg',
      })
      .expect(201);

    const senderBook = await request(app.getHttpServer())
      .post('/me/books')
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        name: 'Sender Book',
        author: 'Author B',
        genre: 'Drama',
        condition: BookCondition.GOOD,
        photo: 'https://example.com/sb.jpg',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/books/${ownerBook.body.id as string}/exchange-requests`)
      .set('Authorization', `Bearer ${sender.token}`)
      .send({
        message: 'Please trade',
        offeredBookIds: [senderBook.body.id],
      })
      .expect(201);

    // Neither ownerBook nor senderBook can be deleted while the request is PENDING
    await request(app.getHttpServer())
      .delete(`/me/books/${ownerBook.body.id as string}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(409);

    await request(app.getHttpServer())
      .delete(`/me/books/${senderBook.body.id as string}`)
      .set('Authorization', `Bearer ${sender.token}`)
      .expect(409);
  });

  it('7. Successful exchange acceptance: contacts visible ONLY after acceptance, books become EXCHANGED, other requests CANCELLED, history created', async () => {
    const owner = await registerAndLogin(
      'Owner',
      'owner@test.com',
      '+380501111111',
    );
    const sender1 = await registerAndLogin(
      'Sender 1',
      'sender1@test.com',
      '+380502222222',
    );
    const sender2 = await registerAndLogin(
      'Sender 2',
      'sender2@test.com',
      '+380503333333',
    );

    const ownerBook = await request(app.getHttpServer())
      .post('/me/books')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Domain-Driven Design',
        author: 'Eric Evans',
        genre: 'Programming',
        condition: BookCondition.NEW,
        photo: 'https://example.com/ddd.jpg',
      })
      .expect(201);

    const s1BookA = await request(app.getHttpServer())
      .post('/me/books')
      .set('Authorization', `Bearer ${sender1.token}`)
      .send({
        name: 'Clean Code',
        author: 'Robert Martin',
        genre: 'Programming',
        condition: BookCondition.GOOD,
        photo: 'https://example.com/cc.jpg',
      })
      .expect(201);

    const s1BookB = await request(app.getHttpServer())
      .post('/me/books')
      .set('Authorization', `Bearer ${sender1.token}`)
      .send({
        name: 'The Pragmatic Programmer',
        author: 'Andy Hunt',
        genre: 'Programming',
        condition: BookCondition.NEW,
        photo: 'https://example.com/pp.jpg',
      })
      .expect(201);

    const s2Book = await request(app.getHttpServer())
      .post('/me/books')
      .set('Authorization', `Bearer ${sender2.token}`)
      .send({
        name: 'Design Patterns',
        author: 'GoF',
        genre: 'Programming',
        condition: BookCondition.WORN,
        photo: 'https://example.com/dp.jpg',
      })
      .expect(201);

    // Sender 1 creates a request offering 2 books
    const req1 = await request(app.getHttpServer())
      .post(`/books/${ownerBook.body.id as string}/exchange-requests`)
      .set('Authorization', `Bearer ${sender1.token}`)
      .send({
        message: 'Choose one of my two books!',
        offeredBookIds: [s1BookA.body.id, s1BookB.body.id],
      })
      .expect(201);

    // Verify contacts are hidden while status is PENDING
    expect(req1.body.status).toBe(ExchangeRequestStatus.PENDING);
    expect(req1.body.owner.email).toBeNull();
    expect(req1.body.owner.phone).toBeNull();
    expect(req1.body.sender.email).toBeNull();
    expect(req1.body.sender.phone).toBeNull();

    // Sender 2 also creates a competing request for the same ownerBook
    const req2 = await request(app.getHttpServer())
      .post(`/books/${ownerBook.body.id as string}/exchange-requests`)
      .set('Authorization', `Bearer ${sender2.token}`)
      .send({
        message: 'Competing offer from Sender 2',
        offeredBookIds: [s2Book.body.id],
      })
      .expect(201);

    // Owner accepts req1 and selects s1BookB
    const acceptRes = await request(app.getHttpServer())
      .patch(`/exchange-requests/${req1.body.id as string}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        status: ExchangeRequestStatus.ACCEPTED,
        selectedOfferedBookId: s1BookB.body.id,
      })
      .expect(200);

    // Verify status is ACCEPTED and contacts are now visible to both parties
    expect(acceptRes.body.status).toBe(ExchangeRequestStatus.ACCEPTED);
    expect(acceptRes.body.owner.email).toBe('owner@test.com');
    expect(acceptRes.body.owner.phone).toBe('+380501111111');
    expect(acceptRes.body.sender.email).toBe('sender1@test.com');
    expect(acceptRes.body.sender.phone).toBe('+380502222222');

    // Verify requestedBook and selectedOfferedBook (s1BookB) are EXCHANGED, while unselected s1BookA stays AVAILABLE
    const booksInDb = await prisma.book.findMany({
      where: {
        id: { in: [ownerBook.body.id, s1BookB.body.id, s1BookA.body.id] },
      },
    });
    const statusMap = new Map(booksInDb.map((b) => [b.id, b.status]));
    expect(statusMap.get(ownerBook.body.id as string)).toBe(
      BookStatus.EXCHANGED,
    );
    expect(statusMap.get(s1BookB.body.id as string)).toBe(BookStatus.EXCHANGED);
    expect(statusMap.get(s1BookA.body.id as string)).toBe(BookStatus.AVAILABLE);

    // Verify exchanged books disappeared from public catalog (/books)
    const catalogRes = await request(app.getHttpServer())
      .get('/books')
      .expect(200);
    const catalogIds = (catalogRes.body.items as { id: string }[]).map(
      (b) => b.id,
    );
    expect(catalogIds).not.toContain(ownerBook.body.id);
    expect(catalogIds).not.toContain(s1BookB.body.id);
    expect(catalogIds).toContain(s1BookA.body.id);

    // Verify competing req2 was automatically CANCELLED
    const req2InDb = await prisma.exchangeRequest.findUniqueOrThrow({
      where: { id: req2.body.id as string },
    });
    expect(req2InDb.status).toBe(ExchangeRequestStatus.CANCELLED);

    // Verify exchange history is created and visible via GET /me/exchanges
    const historyRes = await request(app.getHttpServer())
      .get('/me/exchanges')
      .set('Authorization', `Bearer ${sender1.token}`)
      .expect(200);

    expect(historyRes.body.items.length).toBe(1);
    expect(historyRes.body.items[0].exchangeRequestId).toBe(req1.body.id);
    expect(historyRes.body.items[0].requestedBookId).toBe(ownerBook.body.id);
    expect(historyRes.body.items[0].offeredBookId).toBe(s1BookB.body.id);
    expect(historyRes.body.items[0].owner.email).toBe('owner@test.com');
  });

  it('8. Race condition test: parallel acceptance of two requests for the same book results in exactly one 200 OK and one 409 Conflict', async () => {
    const owner = await registerAndLogin(
      'Owner',
      'owner@test.com',
      '+380501111111',
    );
    const sender1 = await registerAndLogin(
      'Sender 1',
      'sender1@test.com',
      '+380502222222',
    );
    const sender2 = await registerAndLogin(
      'Sender 2',
      'sender2@test.com',
      '+380503333333',
    );

    const ownerBook = await request(app.getHttpServer())
      .post('/me/books')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Hot Book',
        author: 'Famous Author',
        genre: 'Tech',
        condition: BookCondition.NEW,
        photo: 'https://example.com/hot.jpg',
      })
      .expect(201);

    const s1Book = await request(app.getHttpServer())
      .post('/me/books')
      .set('Authorization', `Bearer ${sender1.token}`)
      .send({
        name: 'S1 Book',
        author: 'A1',
        genre: 'Tech',
        condition: BookCondition.GOOD,
        photo: 'https://example.com/s1.jpg',
      })
      .expect(201);

    const s2Book = await request(app.getHttpServer())
      .post('/me/books')
      .set('Authorization', `Bearer ${sender2.token}`)
      .send({
        name: 'S2 Book',
        author: 'A2',
        genre: 'Tech',
        condition: BookCondition.GOOD,
        photo: 'https://example.com/s2.jpg',
      })
      .expect(201);

    const req1 = await request(app.getHttpServer())
      .post(`/books/${ownerBook.body.id as string}/exchange-requests`)
      .set('Authorization', `Bearer ${sender1.token}`)
      .send({
        message: 'Req 1',
        offeredBookIds: [s1Book.body.id],
      })
      .expect(201);

    const req2 = await request(app.getHttpServer())
      .post(`/books/${ownerBook.body.id as string}/exchange-requests`)
      .set('Authorization', `Bearer ${sender2.token}`)
      .send({
        message: 'Req 2',
        offeredBookIds: [s2Book.body.id],
      })
      .expect(201);

    // Fire two acceptance requests simultaneously in parallel
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/exchange-requests/${req1.body.id as string}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          status: ExchangeRequestStatus.ACCEPTED,
          selectedOfferedBookId: s1Book.body.id,
        }),
      request(app.getHttpServer())
        .patch(`/exchange-requests/${req2.body.id as string}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          status: ExchangeRequestStatus.ACCEPTED,
          selectedOfferedBookId: s2Book.body.id,
        }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    // Verify only 1 ExchangeHistory record exists in DB
    const historyCount = await prisma.exchangeHistory.count();
    expect(historyCount).toBe(1);
  });
});
