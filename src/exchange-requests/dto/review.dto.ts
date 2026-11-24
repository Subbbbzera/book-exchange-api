import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    example: 5,
    minimum: 1,
    maximum: 5,
    description: 'Rating from 1 to 5 after completed book exchange',
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    example: 'Great book condition and fast meetup!',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  comment?: string;
}

@Exclude()
export class ReviewUserDto {
  @Expose()
  @ApiProperty({ example: 'c4b3b2a1-1234-5678-9abc-def012345678' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'Alice Smith' })
  name: string;

  constructor(partial: Partial<ReviewUserDto>) {
    Object.assign(this, partial);
  }
}

export interface ReviewWithRelations {
  id: string;
  exchangeHistoryId: string;
  authorId: string;
  targetUserId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  author: { id: string; name: string };
  targetUser: { id: string; name: string };
}

@Exclude()
export class ReviewResponseDto {
  @Expose()
  @ApiProperty({ example: 'r1a2b3c4-5678-90ab-cdef-1234567890ab' })
  id: string;

  @Expose()
  @ApiProperty()
  exchangeHistoryId: string;

  @Expose()
  @ApiProperty()
  authorId: string;

  @Expose()
  @ApiProperty()
  targetUserId: string;

  @Expose()
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  rating: number;

  @Expose()
  @ApiPropertyOptional({
    example: 'Great book condition and fast meetup!',
    nullable: true,
  })
  comment: string | null;

  @Expose()
  @Type(() => ReviewUserDto)
  @ApiProperty({ type: () => ReviewUserDto })
  author: ReviewUserDto;

  @Expose()
  @Type(() => ReviewUserDto)
  @ApiProperty({ type: () => ReviewUserDto })
  targetUser: ReviewUserDto;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  constructor(entity: ReviewWithRelations) {
    this.id = entity.id;
    this.exchangeHistoryId = entity.exchangeHistoryId;
    this.authorId = entity.authorId;
    this.targetUserId = entity.targetUserId;
    this.rating = entity.rating;
    this.comment = entity.comment;
    this.createdAt = entity.createdAt;
    this.author = new ReviewUserDto(entity.author);
    this.targetUser = new ReviewUserDto(entity.targetUser);
  }
}
