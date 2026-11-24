import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExchangeRequestStatus, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BookResponseDto } from '../books/dto/book-response.dto';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers(
    query: AdminUsersQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = users.map((user) => new UserResponseDto(user));
    return new PaginatedResponseDto(items, total, page, limit);
  }

  async createUser(dto: AdminCreateUserDto): Promise<UserResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const created = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        password: hashedPassword,
        role: dto.role ?? Role.USER,
        isBlocked: dto.isBlocked ?? false,
        avatar: dto.avatar,
      },
    });

    return new UserResponseDto(created);
  }

  async updateUser(
    userId: string,
    dto: AdminUpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existing) {
        throw new ConflictException('User with this email already exists');
      }
    }

    const hashedPassword = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : undefined;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        password: hashedPassword,
        role: dto.role,
        isBlocked: dto.isBlocked,
        avatar: dto.avatar,
      },
    });

    return new UserResponseDto(updated);
  }

  async deleteUser(userId: string): Promise<UserResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Remove exchange history referencing user's books before cascade deletion of user and their books
      await tx.exchangeHistory.deleteMany({
        where: {
          OR: [
            { senderId: userId },
            { ownerId: userId },
            { requestedBook: { ownerId: userId } },
            { offeredBook: { ownerId: userId } },
          ],
        },
      });

      await tx.user.delete({
        where: { id: userId },
      });

      return new UserResponseDto(user);
    });
  }

  async deleteAnyBook(bookId: string): Promise<BookResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${bookId} FOR UPDATE`;

      const book = await tx.book.findUnique({
        where: { id: bookId },
      });

      if (!book) {
        throw new NotFoundException('Book not found');
      }

      // Cancel any PENDING exchange requests involving this book before admin removes it
      await tx.exchangeRequest.updateMany({
        where: {
          status: ExchangeRequestStatus.PENDING,
          OR: [
            { requestedBookId: bookId },
            { offeredBooks: { some: { bookId } } },
          ],
        },
        data: {
          status: ExchangeRequestStatus.CANCELLED,
        },
      });

      // Remove exchange history referencing this book so RESTRICT constraint does not block admin deletion
      await tx.exchangeHistory.deleteMany({
        where: {
          OR: [{ requestedBookId: bookId }, { offeredBookId: bookId }],
        },
      });

      await tx.book.delete({
        where: { id: bookId },
      });

      return new BookResponseDto(book);
    });
  }
}
