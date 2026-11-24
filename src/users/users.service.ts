import { ConflictException, Injectable } from '@nestjs/common';
import { ExchangeRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(userId: string): Promise<ProfileResponseDto> {
    const [user, myBooksCount, pendingIncomingRequestsCount] =
      await Promise.all([
        this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
        this.prisma.book.count({ where: { ownerId: userId } }),
        this.prisma.exchangeRequest.count({
          where: {
            ownerId: userId,
            status: ExchangeRequestStatus.PENDING,
          },
        }),
      ]);

    return new ProfileResponseDto({
      ...user,
      myBooksCount,
      pendingIncomingRequestsCount,
    });
  }

  async updateMyProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existing && existing.id !== userId) {
        throw new ConflictException('User with this email already exists');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        avatar: dto.avatar,
      },
    });

    return new UserResponseDto(updatedUser);
  }
}
