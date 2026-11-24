import { ApiProperty } from '@nestjs/swagger';
import { Book, BookCondition, BookStatus } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class BookResponseDto {
  @Expose()
  @ApiProperty({ example: 'b1a2c3d4-5678-90ab-cdef-1234567890ab' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'Clean Architecture' })
  name: string;

  @Expose()
  @ApiProperty({ example: 'Robert C. Martin' })
  author: string;

  @Expose()
  @ApiProperty({ example: 'Programming' })
  genre: string;

  @Expose()
  @ApiProperty({ enum: BookCondition, example: BookCondition.GOOD })
  condition: BookCondition;

  @Expose()
  @ApiProperty({ example: 'https://example.com/clean-arch.jpg' })
  photo: string;

  @Expose()
  @ApiProperty({ enum: BookStatus, example: BookStatus.AVAILABLE })
  status: BookStatus;

  @Expose()
  @ApiProperty({ example: 'c4b3b2a1-1234-5678-9abc-def012345678' })
  ownerId: string;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<Book>) {
    Object.assign(this, partial);
  }
}
