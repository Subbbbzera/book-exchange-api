import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateExchangeRequestDto {
  @ApiProperty({
    example: 'Hi! Would love to trade one of my programming books for yours.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    type: [String],
    example: ['b1a2c3d4-5678-90ab-cdef-1234567890ab'],
    description: 'Array of your AVAILABLE book IDs offered for exchange',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  offeredBookIds: string[];
}
