import { ApiProperty } from '@nestjs/swagger';
import { BookCondition } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateBookDto {
  @ApiProperty({ example: 'Clean Architecture' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Robert C. Martin' })
  @IsString()
  @IsNotEmpty()
  author: string;

  @ApiProperty({ example: 'Programming' })
  @IsString()
  @IsNotEmpty()
  genre: string;

  @ApiProperty({ enum: BookCondition, example: BookCondition.GOOD })
  @IsEnum(BookCondition)
  condition: BookCondition;

  @ApiProperty({ example: 'https://example.com/clean-arch.jpg' })
  @IsUrl()
  @IsNotEmpty()
  photo: string;
}
