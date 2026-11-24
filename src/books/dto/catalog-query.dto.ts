import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookCondition } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CatalogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive search by book name or author',
    example: 'Martin',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by genre',
    example: 'Programming',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  genre?: string;

  @ApiPropertyOptional({
    description: 'Filter by book condition',
    enum: BookCondition,
  })
  @IsOptional()
  @IsEnum(BookCondition)
  condition?: BookCondition;

  @ApiPropertyOptional({
    description: 'Alphabetical sort order by book name',
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'asc';
}
