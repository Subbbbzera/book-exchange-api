import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class AdminUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive search by user name, email, or phone',
    example: 'alice',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  search?: string;
}
