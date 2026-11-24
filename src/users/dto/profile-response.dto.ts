import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { UserResponseDto } from './user-response.dto';

@Exclude()
export class ProfileResponseDto extends UserResponseDto {
  @Expose()
  @ApiProperty({ example: 4, description: 'Total count of my books' })
  myBooksCount: number;

  @Expose()
  @ApiProperty({
    example: 2,
    description: 'Count of incoming exchange requests with status PENDING',
  })
  pendingIncomingRequestsCount: number;

  constructor(partial: Partial<ProfileResponseDto>) {
    super(partial);
    Object.assign(this, partial);
  }
}
