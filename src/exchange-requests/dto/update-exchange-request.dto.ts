import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExchangeRequestStatus } from '@prisma/client';
import { IsIn, IsNotEmpty, IsUUID, ValidateIf } from 'class-validator';

export class UpdateExchangeRequestDto {
  @ApiProperty({
    enum: [
      ExchangeRequestStatus.ACCEPTED,
      ExchangeRequestStatus.REJECTED,
      ExchangeRequestStatus.CANCELLED,
    ],
    example: ExchangeRequestStatus.ACCEPTED,
    description:
      'Target status: owner can set ACCEPTED or REJECTED; sender can set CANCELLED',
  })
  @IsIn([
    ExchangeRequestStatus.ACCEPTED,
    ExchangeRequestStatus.REJECTED,
    ExchangeRequestStatus.CANCELLED,
  ])
  status:
    | typeof ExchangeRequestStatus.ACCEPTED
    | typeof ExchangeRequestStatus.REJECTED
    | typeof ExchangeRequestStatus.CANCELLED;

  @ApiPropertyOptional({
    example: 'b1a2c3d4-5678-90ab-cdef-1234567890ab',
    description:
      'Required when status is ACCEPTED: the ID of the book chosen by the owner from offeredBooks',
  })
  @ValidateIf(
    (o: UpdateExchangeRequestDto) =>
      o.status === ExchangeRequestStatus.ACCEPTED,
  )
  @IsNotEmpty()
  @IsUUID('4')
  selectedOfferedBookId?: string;
}
