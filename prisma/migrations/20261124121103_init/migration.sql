-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BookCondition" AS ENUM ('NEW', 'GOOD', 'WORN');

-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('AVAILABLE', 'EXCHANGED');

-- CreateEnum
CREATE TYPE "ExchangeRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "condition" "BookCondition" NOT NULL,
    "photo" TEXT NOT NULL,
    "status" "BookStatus" NOT NULL DEFAULT 'AVAILABLE',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRequest" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ExchangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "senderId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "requestedBookId" TEXT NOT NULL,
    "selectedOfferedBookId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRequestBook" (
    "exchangeRequestId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,

    CONSTRAINT "ExchangeRequestBook_pkey" PRIMARY KEY ("exchangeRequestId","bookId")
);

-- CreateTable
CREATE TABLE "ExchangeHistory" (
    "id" TEXT NOT NULL,
    "exchangeRequestId" TEXT NOT NULL,
    "requestedBookId" TEXT NOT NULL,
    "offeredBookId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "exchangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Book_ownerId_idx" ON "Book"("ownerId");

-- CreateIndex
CREATE INDEX "Book_status_genre_condition_idx" ON "Book"("status", "genre", "condition");

-- CreateIndex
CREATE INDEX "Book_name_idx" ON "Book"("name");

-- CreateIndex
CREATE INDEX "Book_author_idx" ON "Book"("author");

-- CreateIndex
CREATE INDEX "ExchangeRequest_senderId_status_idx" ON "ExchangeRequest"("senderId", "status");

-- CreateIndex
CREATE INDEX "ExchangeRequest_ownerId_status_idx" ON "ExchangeRequest"("ownerId", "status");

-- CreateIndex
CREATE INDEX "ExchangeRequest_requestedBookId_status_idx" ON "ExchangeRequest"("requestedBookId", "status");

-- CreateIndex
CREATE INDEX "ExchangeRequestBook_bookId_idx" ON "ExchangeRequestBook"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeHistory_exchangeRequestId_key" ON "ExchangeHistory"("exchangeRequestId");

-- CreateIndex
CREATE INDEX "ExchangeHistory_senderId_idx" ON "ExchangeHistory"("senderId");

-- CreateIndex
CREATE INDEX "ExchangeHistory_ownerId_idx" ON "ExchangeHistory"("ownerId");

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRequest" ADD CONSTRAINT "ExchangeRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRequest" ADD CONSTRAINT "ExchangeRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRequest" ADD CONSTRAINT "ExchangeRequest_requestedBookId_fkey" FOREIGN KEY ("requestedBookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRequest" ADD CONSTRAINT "ExchangeRequest_selectedOfferedBookId_fkey" FOREIGN KEY ("selectedOfferedBookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRequestBook" ADD CONSTRAINT "ExchangeRequestBook_exchangeRequestId_fkey" FOREIGN KEY ("exchangeRequestId") REFERENCES "ExchangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRequestBook" ADD CONSTRAINT "ExchangeRequestBook_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeHistory" ADD CONSTRAINT "ExchangeHistory_exchangeRequestId_fkey" FOREIGN KEY ("exchangeRequestId") REFERENCES "ExchangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeHistory" ADD CONSTRAINT "ExchangeHistory_requestedBookId_fkey" FOREIGN KEY ("requestedBookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeHistory" ADD CONSTRAINT "ExchangeHistory_offeredBookId_fkey" FOREIGN KEY ("offeredBookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeHistory" ADD CONSTRAINT "ExchangeHistory_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeHistory" ADD CONSTRAINT "ExchangeHistory_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique index: a sender can have at most one PENDING exchange request per requestedBookId
CREATE UNIQUE INDEX "ExchangeRequest_senderId_requestedBookId_pending_key"
ON "ExchangeRequest"("senderId", "requestedBookId")
WHERE "status" = 'PENDING';

