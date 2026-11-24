import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookCondition } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class UpdateBookDto {
  @ApiPropertyOptional({ example: 'Clean Architecture (2nd Edition)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 'Robert C. Martin' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  author?: string;

  @ApiPropertyOptional({ example: 'Software Engineering' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  genre?: string;

  @ApiPropertyOptional({ enum: BookCondition, example: BookCondition.NEW })
  @IsOptional()
  @IsEnum(BookCondition)
  condition?: BookCondition;

  @ApiPropertyOptional({ example: 'https://example.com/clean-arch-2.jpg' })
  @IsOptional()
  @IsUrl()
  photo?: string;
}
