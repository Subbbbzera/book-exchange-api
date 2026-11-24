import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookStatus, ExchangeRequestStatus, Prisma } from '@prisma/client';
import { BooksService } from '../books/books.service';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { MailService } from '../mail/mail.module';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExchangeRequestDto } from './dto/create-exchange-request.dto';
import {
  ExchangeHistoryResponseDto,
  ExchangeHistoryWithRelations,
} from './dto/exchange-history-response.dto';
import {
  ExchangeRequestResponseDto,
  ExchangeRequestWithRelations,
} from './dto/exchange-request-response.dto';
import { ExchangeRequestsQueryDto } from './dto/exchange-requests-query.dto';
import {
  CreateReviewDto,
  ReviewResponseDto,
  ReviewWithRelations,
} from './dto/review.dto';
import { UpdateExchangeRequestDto } from './dto/update-exchange-request.dto';

const EXCHANGE_REQUEST_INCLUDE = {
  sender: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  requestedBook: true,
  selectedOfferedBook: true,
  offeredBooks: {
    include: {
      book: true,
    },
  },
} satisfies Prisma.ExchangeRequestInclude;

const EXCHANGE_HISTORY_INCLUDE = {
  sender: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  requestedBook: true,
  offeredBook: true,
} satisfies Prisma.ExchangeHistoryInclude;

@Injectable()
export class ExchangeRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly booksService: BooksService,
    private readonly mailService: MailService,
  ) {}

  async createExchangeRequest(
    senderId: string,
    requestedBookId: string,
    dto: CreateExchangeRequestDto,
  ): Promise<ExchangeRequestResponseDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      // Lock all involved book rows in deterministic order to prevent races with concurrent delete or exchange acceptance
      const allBookIds = [
        ...new Set([requestedBookId, ...dto.offeredBookIds]),
      ].sort();

      for (const id of allBookIds) {
        await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} FOR UPDATE`;
      }

      const requestedBook = await tx.book.findUnique({
        where: { id: requestedBookId },
      });

      if (!requestedBook) {
        throw new NotFoundException('Requested book not found');
      }

      if (requestedBook.ownerId === senderId) {
        throw new BadRequestException(
          'You cannot request your own book for exchange',
        );
      }

      if (requestedBook.status !== BookStatus.AVAILABLE) {
        throw new ConflictException(
          'Requested book is no longer available for exchange',
        );
      }

      // Use the single centralized ownership check in BooksService
      const offeredBooks = await this.booksService.verifyOwnedBooksOrThrow(
        dto.offeredBookIds,
        senderId,
        tx,
      );

      for (const book of offeredBooks) {
        if (book.status !== BookStatus.AVAILABLE) {
          throw new ConflictException(
            `Offered book "${book.name}" is not available for exchange`,
          );
        }
      }

      const existingPending = await tx.exchangeRequest.findFirst({
        where: {
          senderId,
          requestedBookId,
          status: ExchangeRequestStatus.PENDING,
        },
      });

      if (existingPending) {
        throw new ConflictException(
          'You already have an active exchange request for this book',
        );
      }

      return tx.exchangeRequest.create({
        data: {
          message: dto.message,
          senderId,
          ownerId: requestedBook.ownerId,
          requestedBookId,
          status: ExchangeRequestStatus.PENDING,
          offeredBooks: {
            create: dto.offeredBookIds.map((bookId) => ({ bookId })),
          },
        },
        include: EXCHANGE_REQUEST_INCLUDE,
      });
    });

    // Send email notification to the book owner outside the DB transaction (with sender name, sender email, and list of offered books)
    await this.mailService.sendExchangeRequestNotification({
      ownerEmail: created.owner.email,
      ownerName: created.owner.name,
      senderName: created.sender.name,
      senderEmail: created.sender.email,
      requestedBookName: created.requestedBook.name,
      message: created.message,
      offeredBooks: created.offeredBooks.map((ob) => ({
        name: ob.book.name,
        author: ob.book.author,
        condition: ob.book.condition,
      })),
    });

    return new ExchangeRequestResponseDto(
      created as ExchangeRequestWithRelations,
    );
  }

  async getMyExchangeRequests(
    userId: string,
    query: ExchangeRequestsQueryDto,
  ): Promise<PaginatedResponseDto<ExchangeRequestResponseDto>> {
    const { page, limit, status, direction } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ExchangeRequestWhereInput = {
      ...(status ? { status } : {}),
      ...(direction === 'incoming'
        ? { ownerId: userId }
        : direction === 'outgoing'
          ? { senderId: userId }
          : { OR: [{ ownerId: userId }, { senderId: userId }] }),
    };

    const [requests, total] = await Promise.all([
      this.prisma.exchangeRequest.findMany({
        where,
        include: EXCHANGE_REQUEST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.exchangeRequest.count({ where }),
    ]);

    const items = requests.map(
      (req) =>
        new ExchangeRequestResponseDto(req as ExchangeRequestWithRelations),
    );

    return new PaginatedResponseDto(items, total, page, limit);
  }

  async updateExchangeRequestStatus(
    userId: string,
    requestId: string,
    dto: UpdateExchangeRequestDto,
  ): Promise<ExchangeRequestResponseDto> {
    if (dto.status === ExchangeRequestStatus.ACCEPTED) {
      return this.acceptExchangeRequest(userId, requestId, dto);
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.exchangeRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new NotFoundException('Exchange request not found');
      }

      if (dto.status === ExchangeRequestStatus.REJECTED) {
        if (request.ownerId !== userId) {
          throw new ForbiddenException(
            'Only the book owner can reject this exchange request',
          );
        }
      } else if (dto.status === ExchangeRequestStatus.CANCELLED) {
        if (request.senderId !== userId) {
          throw new ForbiddenException(
            'Only the sender can cancel this exchange request',
          );
        }
      }

      if (request.status !== ExchangeRequestStatus.PENDING) {
        throw new ConflictException(
          `Cannot transition exchange request from ${request.status} to ${dto.status}`,
        );
      }

      const updatedCount = await tx.exchangeRequest.updateMany({
        where: {
          id: requestId,
          status: ExchangeRequestStatus.PENDING,
        },
        data: {
          status: dto.status,
        },
      });

      if (updatedCount.count !== 1) {
        throw new ConflictException(
          'Exchange request status was already changed concurrently',
        );
      }

      const updated = await tx.exchangeRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: EXCHANGE_REQUEST_INCLUDE,
      });

      return new ExchangeRequestResponseDto(
        updated as ExchangeRequestWithRelations,
      );
    });
  }

  private async acceptExchangeRequest(
    userId: string,
    requestId: string,
    dto: UpdateExchangeRequestDto,
  ): Promise<ExchangeRequestResponseDto> {
    if (!dto.selectedOfferedBookId) {
      throw new BadRequestException(
        'selectedOfferedBookId is required when accepting an exchange request',
      );
    }

    const selectedOfferedBookId = dto.selectedOfferedBookId;

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.exchangeRequest.findUnique({
        where: { id: requestId },
        include: {
          offeredBooks: true,
        },
      });

      if (!request) {
        throw new NotFoundException('Exchange request not found');
      }

      if (request.ownerId !== userId) {
        throw new ForbiddenException(
          'Only the book owner can accept this exchange request',
        );
      }

      if (request.status !== ExchangeRequestStatus.PENDING) {
        throw new ConflictException(
          `Cannot transition exchange request from ${request.status} to ACCEPTED`,
        );
      }

      const isBookOffered = request.offeredBooks.some(
        (ob) => ob.bookId === selectedOfferedBookId,
      );

      if (!isBookOffered) {
        throw new BadRequestException(
          'Selected book is not among the books offered in this request',
        );
      }

      // 1. Conditional update (CAS) on the requested book FIRST: only update if status is still AVAILABLE.
      // Because both competing requests target the same requestedBookId, updating the book first
      // acquires the row-level write lock in a single consistent order (Book -> ExchangeRequest),
      // completely preventing PostgreSQL deadlocks (40P01) while guaranteeing only one request sees count = 1.
      const requestedBookUpdate = await tx.book.updateMany({
        where: {
          id: request.requestedBookId,
          status: BookStatus.AVAILABLE,
        },
        data: {
          status: BookStatus.EXCHANGED,
        },
      });

      if (requestedBookUpdate.count !== 1) {
        throw new ConflictException(
          'Requested book has already been exchanged in another request',
        );
      }

      // 2. Conditional update (CAS) on the selected offered book: only update if status is still AVAILABLE.
      const offeredBookUpdate = await tx.book.updateMany({
        where: {
          id: selectedOfferedBookId,
          status: BookStatus.AVAILABLE,
        },
        data: {
          status: BookStatus.EXCHANGED,
        },
      });

      if (offeredBookUpdate.count !== 1) {
        throw new ConflictException(
          'Selected offered book is no longer available for exchange',
        );
      }

      // 3. Conditional update of the ExchangeRequest itself (PENDING -> ACCEPTED)
      const requestUpdate = await tx.exchangeRequest.updateMany({
        where: {
          id: requestId,
          status: ExchangeRequestStatus.PENDING,
        },
        data: {
          status: ExchangeRequestStatus.ACCEPTED,
          selectedOfferedBookId,
        },
      });

      if (requestUpdate.count !== 1) {
        throw new ConflictException(
          'Exchange request is no longer in PENDING state',
        );
      }

      const exchangedBookIds = [request.requestedBookId, selectedOfferedBookId];

      // 4. Cancel all other PENDING requests that involve either of the two exchanged books
      await tx.exchangeRequest.updateMany({
        where: {
          id: { not: requestId },
          status: ExchangeRequestStatus.PENDING,
          OR: [
            { requestedBookId: { in: exchangedBookIds } },
            {
              offeredBooks: {
                some: {
                  bookId: { in: exchangedBookIds },
                },
              },
            },
          ],
        },
        data: {
          status: ExchangeRequestStatus.CANCELLED,
        },
      });

      // 5. Create record in ExchangeHistory
      await tx.exchangeHistory.create({
        data: {
          exchangeRequestId: requestId,
          requestedBookId: request.requestedBookId,
          offeredBookId: selectedOfferedBookId,
          senderId: request.senderId,
          ownerId: request.ownerId,
        },
      });

      const updated = await tx.exchangeRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: EXCHANGE_REQUEST_INCLUDE,
      });

      return new ExchangeRequestResponseDto(
        updated as ExchangeRequestWithRelations,
      );
    });
  }

  async getMyExchanges(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<ExchangeHistoryResponseDto>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ExchangeHistoryWhereInput = {
      OR: [{ senderId: userId }, { ownerId: userId }],
    };

    const [historyRecords, total] = await Promise.all([
      this.prisma.exchangeHistory.findMany({
        where,
        include: EXCHANGE_HISTORY_INCLUDE,
        orderBy: { exchangedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.exchangeHistory.count({ where }),
    ]);

    const items = historyRecords.map(
      (record) =>
        new ExchangeHistoryResponseDto(record as ExchangeHistoryWithRelations),
    );

    return new PaginatedResponseDto(items, total, page, limit);
  }

  async createReview(
    authorId: string,
    exchangeHistoryId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const history = await this.prisma.exchangeHistory.findUnique({
      where: { id: exchangeHistoryId },
    });

    if (!history) {
      throw new NotFoundException('Completed exchange record not found');
    }

    if (history.senderId !== authorId && history.ownerId !== authorId) {
      throw new ForbiddenException(
        'Only participants of this completed exchange can leave a review',
      );
    }

    const targetUserId =
      history.senderId === authorId ? history.ownerId : history.senderId;

    const existing = await this.prisma.review.findUnique({
      where: {
        exchangeHistoryId_authorId: {
          exchangeHistoryId,
          authorId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'You have already left a review for this exchange',
      );
    }

    const review = await this.prisma.review.create({
      data: {
        exchangeHistoryId,
        authorId,
        targetUserId,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: {
        author: { select: { id: true, name: true } },
        targetUser: { select: { id: true, name: true } },
      },
    });

    return new ReviewResponseDto(review as ReviewWithRelations);
  }

  async getMyReviews(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<ReviewResponseDto>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      targetUserId: userId,
    };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: {
          author: { select: { id: true, name: true } },
          targetUser: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    const items = reviews.map(
      (r) => new ReviewResponseDto(r as ReviewWithRelations),
    );
    return new PaginatedResponseDto(items, total, page, limit);
  }
}
