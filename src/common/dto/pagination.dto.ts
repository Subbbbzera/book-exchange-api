import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}

@Exclude()
export class PaginationMetaDto {
  @Expose()
  @ApiProperty({ example: 42 })
  total: number;

  @Expose()
  @ApiProperty({ example: 1 })
  page: number;

  @Expose()
  @ApiProperty({ example: 10 })
  limit: number;

  @Expose()
  @ApiProperty({ example: 5 })
  totalPages: number;

  constructor(total: number, page: number, limit: number) {
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit) || 1;
  }
}

@Exclude()
export class PaginatedResponseDto<T> {
  @Expose()
  items: T[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;

  constructor(items: T[], total: number, page: number, limit: number) {
    this.items = items;
    this.meta = new PaginationMetaDto(total, page, limit);
  }
}
