import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Book,
  BookStatus,
  ExchangeRequestStatus,
  Prisma,
} from '@prisma/client';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { BookDetailResponseDto } from './dto/book-detail-response.dto';
import { BookResponseDto } from './dto/book-response.dto';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

type PrismaTx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Single centralized place to verify that a book exists and belongs to the given user.
   */
  async findOwnedBookOrThrow(
    bookId: string,
    userId: string,
    tx: PrismaTx = this.prisma,
  ): Promise<Book> {
    const book = await tx.book.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    if (book.ownerId !== userId) {
      throw new ForbiddenException('You are not the owner of this book');
    }

    return book;
  }

  /**
   * Centralized ownership verification for multiple books at once (e.g. offered books in an exchange request).
   */
  async verifyOwnedBooksOrThrow(
    bookIds: string[],
    userId: string,
    tx: PrismaTx = this.prisma,
  ): Promise<Book[]> {
    const books = await tx.book.findMany({
      where: { id: { in: bookIds } },
    });

    if (books.length !== bookIds.length) {
      throw new NotFoundException('One or more books were not found');
    }

    for (const book of books) {
      if (book.ownerId !== userId) {
        throw new ForbiddenException('You can only use your own books');
      }
    }

    return books;
  }

  async getMyBooks(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<BookResponseDto>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [books, total] = await Promise.all([
      this.prisma.book.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.book.count({ where: { ownerId: userId } }),
    ]);

    const items = books.map((book) => new BookResponseDto(book));
    return new PaginatedResponseDto(items, total, page, limit);
  }

  async createMyBook(
    userId: string,
    dto: CreateBookDto,
  ): Promise<BookResponseDto> {
    const book = await this.prisma.book.create({
      data: {
        name: dto.name,
        author: dto.author,
        genre: dto.genre,
        condition: dto.condition,
        photo: dto.photo,
        ownerId: userId,
      },
    });

    return new BookResponseDto(book);
  }

  async updateMyBook(
    userId: string,
    bookId: string,
    dto: UpdateBookDto,
  ): Promise<BookResponseDto> {
    const book = await this.findOwnedBookOrThrow(bookId, userId);

    if (book.status !== BookStatus.AVAILABLE) {
      throw new ConflictException(
        'Cannot edit a book that has already been exchanged',
      );
    }

    const updated = await this.prisma.book.update({
      where: { id: bookId },
      data: {
        name: dto.name,
        author: dto.author,
        genre: dto.genre,
        condition: dto.condition,
        photo: dto.photo,
      },
    });

    return new BookResponseDto(updated);
  }

  async deleteMyBook(userId: string, bookId: string): Promise<BookResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      // Lock the book row with FOR UPDATE so no concurrent exchange request can be created for it while deleting
      await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${bookId} FOR UPDATE`;

      const book = await this.findOwnedBookOrThrow(bookId, userId, tx);

      const activeRequestsCount = await tx.exchangeRequest.count({
        where: {
          status: ExchangeRequestStatus.PENDING,
          OR: [
            { requestedBookId: bookId },
            { offeredBooks: { some: { bookId } } },
          ],
        },
      });

      if (activeRequestsCount > 0) {
        throw new ConflictException(
          'Cannot delete a book with an active exchange request',
        );
      }

      const historyCount = await tx.exchangeHistory.count({
        where: {
          OR: [{ requestedBookId: bookId }, { offeredBookId: bookId }],
        },
      });

      if (historyCount > 0) {
        throw new ConflictException(
          'Cannot delete a book that has already been exchanged',
        );
      }

      await tx.book.delete({
        where: { id: bookId },
      });

      return new BookResponseDto(book);
    });
  }

  async getCatalog(
    query: CatalogQueryDto,
  ): Promise<PaginatedResponseDto<BookResponseDto>> {
    const { page, limit, search, genre, condition, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BookWhereInput = {
      status: BookStatus.AVAILABLE,
      ...(genre ? { genre: { equals: genre, mode: 'insensitive' } } : {}),
      ...(condition ? { condition } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { author: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [books, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        orderBy: [{ name: sortOrder }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.book.count({ where }),
    ]);

    const items = books.map((book) => new BookResponseDto(book));
    return new PaginatedResponseDto(items, total, page, limit);
  }

  async getCatalogBookById(bookId: string): Promise<BookDetailResponseDto> {
    const book = await this.prisma.book.findFirst({
      where: {
        id: bookId,
        status: BookStatus.AVAILABLE,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    return new BookDetailResponseDto(book);
  }
}
