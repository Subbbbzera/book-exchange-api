import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExchangeRequestStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ExchangeRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ExchangeRequestStatus,
    description: 'Filter by exchange request status',
  })
  @IsOptional()
  @IsEnum(ExchangeRequestStatus)
  status?: ExchangeRequestStatus;

  @ApiPropertyOptional({
    enum: ['incoming', 'outgoing'],
    description: 'Optional filter by direction (incoming or outgoing)',
  })
  @IsOptional()
  @IsIn(['incoming', 'outgoing'])
  direction?: 'incoming' | 'outgoing';
}
