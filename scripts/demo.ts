import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaClient } from '@prisma/client';

const DELAY_MS = Number(process.env.DEMO_DELAY_MS ?? '600');

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callApi(
  baseUrl: string,
  stepTitle: string,
  method: string,
  path: string,
  options: {
    token?: string;
    body?: Record<string, unknown>;
    expectedStatus: number;
  },
): Promise<Record<string, unknown>> {
  console.log(
    `\n${C.bold}${C.cyan}▶ ${stepTitle}${C.reset}\n  ${C.yellow}${method} ${path}${C.reset}`,
  );

  if (options.body) {
    console.log(
      `  ${C.gray}Request Body: ${JSON.stringify(options.body)}${C.reset}`,
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = (await res.json()) as Record<string, unknown>;

  const statusColor =
    res.status === options.expectedStatus ? C.green : '\x1b[31m';
  console.log(
    `  ${statusColor}${C.bold}✔ Status: ${res.status} (Expected: ${options.expectedStatus})${C.reset}`,
  );
  console.log(
    `  ${C.magenta}Response:${C.reset} ${JSON.stringify(data, null, 2)}`,
  );

  if (res.status !== options.expectedStatus) {
    throw new Error(
      `Expected status ${options.expectedStatus}, but got ${res.status}`,
    );
  }

  await sleep(DELAY_MS);
  return data;
}

async function checkExistingServer(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/books`);
    return res.ok;
  } catch {
    return false;
  }
}

async function runDemo(): Promise<void> {
  console.log(
    `${C.bold}${C.green}====================================================================${C.reset}`,
  );
  console.log(
    `${C.bold}${C.green}   BOOK EXCHANGE API — AUTOMATED INTERACTIVE DEMO WALKTHROUGH       ${C.reset}`,
  );
  console.log(
    `${C.bold}${C.green}====================================================================${C.reset}`,
  );

  let baseUrl = process.env.API_URL ?? 'http://127.0.0.1:3000';
  let embeddedApp: Awaited<ReturnType<typeof NestFactory.create>> | null = null;

  const isServerRunning = await checkExistingServer(baseUrl);

  if (!isServerRunning) {
    console.log(
      `  ${C.gray}Starting embedded NestJS server for demo...${C.reset}`,
    );
    embeddedApp = await NestFactory.create(AppModule, {
      logger: ['error'],
    });
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Book Exchange API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(embeddedApp, swaggerConfig);
    SwaggerModule.setup('docs', embeddedApp, document);
    await embeddedApp.listen(0, '127.0.0.1');
    baseUrl = await embeddedApp.getUrl();
  }

  // Clean all non-admin demo records before starting so demo is 100% repeatable
  const prisma = embeddedApp
    ? embeddedApp.get(PrismaService)
    : new PrismaClient();

  try {
    await prisma.review.deleteMany();
    await prisma.exchangeHistory.deleteMany();
    await prisma.exchangeRequestBook.deleteMany();
    await prisma.exchangeRequest.deleteMany();
    await prisma.book.deleteMany();
    await prisma.user.deleteMany({
      where: {
        email: {
          not: 'admin@bookexchange.local',
        },
      },
    });

    // 1. AUTH
    await callApi(
      baseUrl,
      '1.1 Register User 1 (Alice)',
      'POST',
      '/auth/register',
      {
        body: {
          name: 'Alice Smith',
          email: 'alice@example.com',
          phone: '+380501112233',
          password: 'StrongPass123!',
        },
        expectedStatus: 201,
      },
    );

    const aliceLogin = await callApi(
      baseUrl,
      '1.2 Login User 1 (Alice)',
      'POST',
      '/auth/login',
      {
        body: { email: 'alice@example.com', password: 'StrongPass123!' },
        expectedStatus: 200,
      },
    );
    const aliceToken = aliceLogin.accessToken as string;

    await callApi(
      baseUrl,
      '1.3 Check Current User (GET /auth/me)',
      'GET',
      '/auth/me',
      {
        token: aliceToken,
        expectedStatus: 200,
      },
    );

    const bobReg = await callApi(
      baseUrl,
      '1.4 Register User 2 (Bob)',
      'POST',
      '/auth/register',
      {
        body: {
          name: 'Bob Martin',
          email: 'bob@example.com',
          phone: '+380502223344',
          password: 'StrongPass123!',
        },
        expectedStatus: 201,
      },
    );
    const bobId = bobReg.id as string;

    const bobLogin = await callApi(
      baseUrl,
      '1.5 Login User 2 (Bob)',
      'POST',
      '/auth/login',
      {
        body: { email: 'bob@example.com', password: 'StrongPass123!' },
        expectedStatus: 200,
      },
    );
    const bobToken = bobLogin.accessToken as string;

    const adminLogin = await callApi(
      baseUrl,
      '1.6 Login Seeded Admin',
      'POST',
      '/auth/login',
      {
        body: {
          email: 'admin@bookexchange.local',
          password: 'AdminPassword123!',
        },
        expectedStatus: 200,
      },
    );
    const adminToken = adminLogin.accessToken as string;

    // 2. PROFILE (/me)
    await callApi(baseUrl, '2.1 Get Alice Profile (GET /me)', 'GET', '/me', {
      token: aliceToken,
      expectedStatus: 200,
    });

    await callApi(
      baseUrl,
      '2.2 Update Alice Profile (PATCH /me)',
      'PATCH',
      '/me',
      {
        token: aliceToken,
        body: {
          name: 'Alice Smith (Updated)',
          phone: '+380501119999',
          avatar: 'https://example.com/alice-avatar.png',
        },
        expectedStatus: 200,
      },
    );

    // 3. MY BOOKS (/me/books)
    const aliceBook1 = await callApi(
      baseUrl,
      '3.1 Alice adds Book #1 (POST /me/books)',
      'POST',
      '/me/books',
      {
        token: aliceToken,
        body: {
          name: 'Clean Architecture',
          author: 'Robert C. Martin',
          genre: 'Programming',
          condition: 'NEW',
          photo: 'https://example.com/clean-architecture.jpg',
        },
        expectedStatus: 201,
      },
    );
    const aliceBook1Id = aliceBook1.id as string;

    const aliceBook2 = await callApi(
      baseUrl,
      '3.2 Alice adds Book #2 (POST /me/books)',
      'POST',
      '/me/books',
      {
        token: aliceToken,
        body: {
          name: 'Temporary Book',
          author: 'Unknown',
          genre: 'Fiction',
          condition: 'WORN',
          photo: 'https://example.com/temp.jpg',
        },
        expectedStatus: 201,
      },
    );
    const aliceBook2Id = aliceBook2.id as string;

    await callApi(
      baseUrl,
      '3.3 Alice lists her books (GET /me/books)',
      'GET',
      '/me/books?page=1&limit=10',
      {
        token: aliceToken,
        expectedStatus: 200,
      },
    );

    await callApi(
      baseUrl,
      '3.4 Alice updates Book #2 (PATCH /me/books/:id)',
      'PATCH',
      `/me/books/${aliceBook2Id}`,
      {
        token: aliceToken,
        body: { name: 'Updated Book Title', condition: 'GOOD' },
        expectedStatus: 200,
      },
    );

    await callApi(
      baseUrl,
      '3.5 Alice deletes Book #2 (DELETE /me/books/:id)',
      'DELETE',
      `/me/books/${aliceBook2Id}`,
      {
        token: aliceToken,
        expectedStatus: 200,
      },
    );

    const bobBook1 = await callApi(
      baseUrl,
      '3.6 Bob adds Book #1 (POST /me/books)',
      'POST',
      '/me/books',
      {
        token: bobToken,
        body: {
          name: 'Refactoring',
          author: 'Martin Fowler',
          genre: 'Programming',
          condition: 'GOOD',
          photo: 'https://example.com/refactoring.jpg',
        },
        expectedStatus: 201,
      },
    );
    const bobBook1Id = bobBook1.id as string;

    const bobBook2 = await callApi(
      baseUrl,
      '3.7 Bob adds Book #2 (POST /me/books)',
      'POST',
      '/me/books',
      {
        token: bobToken,
        body: {
          name: 'Domain-Driven Design',
          author: 'Eric Evans',
          genre: 'Programming',
          condition: 'NEW',
          photo: 'https://example.com/ddd.jpg',
        },
        expectedStatus: 201,
      },
    );
    const bobBook2Id = bobBook2.id as string;

    // 4. PUBLIC CATALOG (/books)
    await callApi(
      baseUrl,
      '4.1 Public Catalog: search, filters, alphabetical sorting, pagination (GET /books)',
      'GET',
      '/books?search=Martin&genre=Programming&sortOrder=asc&page=1&limit=10',
      {
        expectedStatus: 200,
      },
    );

    await callApi(
      baseUrl,
      '4.2 Book Details: shows owner name WITHOUT email and phone! (GET /books/:id)',
      'GET',
      `/books/${aliceBook1Id}`,
      {
        expectedStatus: 200,
      },
    );

    // 5. EXCHANGE REQUESTS & ACCEPTANCE
    await callApi(
      baseUrl,
      '5.1 [Rule Check 400] Alice tries to request her own book',
      'POST',
      `/books/${aliceBook1Id}/exchange-requests`,
      {
        token: aliceToken,
        body: {
          message: 'Requesting my own book',
          offeredBookIds: [aliceBook1Id],
        },
        expectedStatus: 400,
      },
    );

    const exchangeReq = await callApi(
      baseUrl,
      '5.2 Bob creates an Exchange Request for Alice book (contacts are hidden = null while PENDING)',
      'POST',
      `/books/${aliceBook1Id}/exchange-requests`,
      {
        token: bobToken,
        body: {
          message:
            'Hi Alice! Pick one of my two books for Clean Architecture.',
          offeredBookIds: [bobBook1Id, bobBook2Id],
        },
        expectedStatus: 201,
      },
    );
    const exchangeRequestId = exchangeReq.id as string;

    await callApi(
      baseUrl,
      '5.3 [Rule Check 409] Bob tries to create a duplicate PENDING request for the same book',
      'POST',
      `/books/${aliceBook1Id}/exchange-requests`,
      {
        token: bobToken,
        body: {
          message: 'Duplicate request',
          offeredBookIds: [bobBook1Id],
        },
        expectedStatus: 409,
      },
    );

    await callApi(
      baseUrl,
      '5.4 [Rule Check 409] Alice tries to delete her book while it has an active PENDING request',
      'DELETE',
      `/me/books/${aliceBook1Id}`,
      {
        token: aliceToken,
        expectedStatus: 409,
      },
    );

    await callApi(
      baseUrl,
      '5.5 Alice views her incoming PENDING exchange requests (GET /me/exchange-requests)',
      'GET',
      '/me/exchange-requests?direction=incoming&status=PENDING',
      {
        token: aliceToken,
        expectedStatus: 200,
      },
    );

    await callApi(
      baseUrl,
      '5.6 Alice ACCEPTS exchange request choosing Bob Book #2 -> Contacts (email & phone) are now visible!',
      'PATCH',
      `/exchange-requests/${exchangeRequestId}`,
      {
        token: aliceToken,
        body: {
          status: 'ACCEPTED',
          selectedOfferedBookId: bobBook2Id,
        },
        expectedStatus: 200,
      },
    );

    await callApi(
      baseUrl,
      '5.7 Public Catalog after exchange: exchanged books disappeared from /books!',
      'GET',
      '/books',
      {
        expectedStatus: 200,
      },
    );

    const historyRes = await callApi(
      baseUrl,
      '5.8 Exchange History (GET /me/exchanges)',
      'GET',
      '/me/exchanges',
      {
        token: aliceToken,
        expectedStatus: 200,
      },
    );
    const exchangeHistoryId = (
      historyRes.items as { id: string }[]
    )[0].id;

    await callApi(
      baseUrl,
      '5.9 Bob leaves a 5-star review after exchange (POST /exchanges/:id/reviews)',
      'POST',
      `/exchanges/${exchangeHistoryId}/reviews`,
      {
        token: bobToken,
        body: {
          rating: 5,
          comment: 'Great book condition and fast exchange!',
        },
        expectedStatus: 201,
      },
    );

    await callApi(
      baseUrl,
      '5.10 Alice views her received reviews (GET /me/reviews)',
      'GET',
      '/me/reviews',
      {
        token: aliceToken,
        expectedStatus: 200,
      },
    );

    await callApi(
      baseUrl,
      '5.11 Password Recovery via Email (POST /auth/forgot-password)',
      'POST',
      '/auth/forgot-password',
      {
        body: { email: 'alice@example.com' },
        expectedStatus: 200,
      },
    );

    // 6. ADMIN (/admin)
    await callApi(
      baseUrl,
      '6.1 [Rule Check 403] Regular USER (Alice) cannot access /admin/users',
      'GET',
      '/admin/users',
      {
        token: aliceToken,
        expectedStatus: 403,
      },
    );

    await callApi(
      baseUrl,
      '6.2 ADMIN lists users with search & pagination (GET /admin/users)',
      'GET',
      '/admin/users?page=1&limit=10&search=example.com',
      {
        token: adminToken,
        expectedStatus: 200,
      },
    );

    const charlie = await callApi(
      baseUrl,
      '6.3 ADMIN creates a new user (POST /admin/users)',
      'POST',
      '/admin/users',
      {
        token: adminToken,
        body: {
          name: 'Charlie CreatedByAdmin',
          email: 'charlie@example.com',
          phone: '+380507778899',
          password: 'StrongPass123!',
          role: 'USER',
        },
        expectedStatus: 201,
      },
    );
    const charlieId = charlie.id as string;

    await callApi(
      baseUrl,
      '6.4 ADMIN blocks user Bob (PATCH /admin/users/:id)',
      'PATCH',
      `/admin/users/${bobId}`,
      {
        token: adminToken,
        body: { isBlocked: true },
        expectedStatus: 200,
      },
    );

    await callApi(
      baseUrl,
      '6.5 [Rule Check 403] Blocked user Bob cannot pass JwtAuthGuard',
      'GET',
      '/auth/me',
      {
        token: bobToken,
        expectedStatus: 403,
      },
    );

    await callApi(
      baseUrl,
      '6.6 ADMIN deletes any book (DELETE /admin/books/:id)',
      'DELETE',
      `/admin/books/${bobBook1Id}`,
      {
        token: adminToken,
        expectedStatus: 200,
      },
    );

    await callApi(
      baseUrl,
      '6.7 ADMIN deletes user Charlie (DELETE /admin/users/:id)',
      'DELETE',
      `/admin/users/${charlieId}`,
      {
        token: adminToken,
        expectedStatus: 200,
      },
    );

    console.log(
      `\n${C.bold}${C.green}====================================================================${C.reset}`,
    );
    console.log(
      `${C.bold}${C.green}   ✔ ALL 27 DEMO STEPS COMPLETED SUCCESSFULLY!                      ${C.reset}`,
    );
    console.log(
      `${C.bold}${C.green}====================================================================${C.reset}\n`,
    );
  } finally {
    if (embeddedApp) {
      await embeddedApp.close();
    } else {
      await prisma.$disconnect();
    }
  }
}

void runDemo();
