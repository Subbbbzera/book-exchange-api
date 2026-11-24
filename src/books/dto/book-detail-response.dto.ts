import { ApiProperty } from '@nestjs/swagger';
import { Book } from '@prisma/client';
import { Exclude, Expose, Type } from 'class-transformer';
import { BookResponseDto } from './book-response.dto';

@Exclude()
export class BookOwnerPublicDto {
  @Expose()
  @ApiProperty({ example: 'c4b3b2a1-1234-5678-9abc-def012345678' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'John Doe' })
  name: string;

  constructor(partial: Partial<BookOwnerPublicDto>) {
    Object.assign(this, partial);
  }
}

@Exclude()
export class BookDetailResponseDto extends BookResponseDto {
  @Expose()
  @Type(() => BookOwnerPublicDto)
  @ApiProperty({
    type: () => BookOwnerPublicDto,
    description: 'Owner public details (strictly WITHOUT email and phone)',
  })
  owner: BookOwnerPublicDto;

  constructor(book: Partial<Book> & { owner?: Partial<BookOwnerPublicDto> }) {
    super(book);
    if (book.owner) {
      this.owner = new BookOwnerPublicDto(book.owner);
    }
  }
}
