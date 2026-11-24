import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookStatus, ExchangeRequestStatus, Prisma } from '@prisma/client';
import { BooksService } from '../books/books.service';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExchangeRequestDto } from './dto/create-exchange-request.dto';
import {
  ExchangeRequestResponseDto,
  ExchangeRequestWithRelations,
} from './dto/exchange-request-response.dto';
import { ExchangeRequestsQueryDto } from './dto/exchange-requests-query.dto';
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

@Injectable()
export class ExchangeRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly booksService: BooksService,
  ) {}

  async createExchangeRequest(
    senderId: string,
    requestedBookId: string,
    dto: CreateExchangeRequestDto,
  ): Promise<ExchangeRequestResponseDto> {
    return this.prisma.$transaction(async (tx) => {
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

      const created = await tx.exchangeRequest.create({
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

      return new ExchangeRequestResponseDto(
        created as ExchangeRequestWithRelations,
      );
    });
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

      // 1. Conditional update of the ExchangeRequest itself (PENDING -> ACCEPTED)
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

      // 2. Conditional update (CAS) on the requested book: only update if status is still AVAILABLE.
      // If two requests for the same book are accepted concurrently, Postgres row-level write lock
      // on updateMany ensures only one sees status = AVAILABLE (count = 1), while the second sees count = 0 -> 409 Conflict!
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

      // 3. Conditional update (CAS) on the selected offered book: only update if status is still AVAILABLE.
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
}
