import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Book, ExchangeRequestStatus } from '@prisma/client';
import { Exclude, Expose, Type } from 'class-transformer';
import { BookResponseDto } from '../../books/dto/book-response.dto';

@Exclude()
export class ExchangePartyDto {
  @Expose()
  @ApiProperty({ example: 'c4b3b2a1-1234-5678-9abc-def012345678' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'John Doe' })
  name: string;

  @Expose()
  @ApiPropertyOptional({
    example: 'john@example.com',
    nullable: true,
    description: 'Visible only after the exchange request is ACCEPTED',
  })
  email: string | null;

  @Expose()
  @ApiPropertyOptional({
    example: '+380501234567',
    nullable: true,
    description: 'Visible only after the exchange request is ACCEPTED',
  })
  phone: string | null;

  constructor(
    user: { id: string; name: string; email?: string; phone?: string },
    includeContacts: boolean,
  ) {
    this.id = user.id;
    this.name = user.name;
    this.email = includeContacts ? (user.email ?? null) : null;
    this.phone = includeContacts ? (user.phone ?? null) : null;
  }
}

export interface ExchangeRequestWithRelations {
  id: string;
  message: string;
  status: ExchangeRequestStatus;
  senderId: string;
  ownerId: string;
  requestedBookId: string;
  selectedOfferedBookId: string | null;
  createdAt: Date;
  updatedAt: Date;
  sender: { id: string; name: string; email: string; phone: string };
  owner: { id: string; name: string; email: string; phone: string };
  requestedBook: Book;
  selectedOfferedBook: Book | null;
  offeredBooks: { book: Book }[];
}

@Exclude()
export class ExchangeRequestResponseDto {
  @Expose()
  @ApiProperty({ example: 'e1f2a3b4-5678-90ab-cdef-1234567890ab' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'Would love to exchange!' })
  message: string;

  @Expose()
  @ApiProperty({
    enum: ExchangeRequestStatus,
    example: ExchangeRequestStatus.PENDING,
  })
  status: ExchangeRequestStatus;

  @Expose()
  @ApiProperty()
  senderId: string;

  @Expose()
  @ApiProperty()
  ownerId: string;

  @Expose()
  @ApiProperty()
  requestedBookId: string;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  selectedOfferedBookId: string | null;

  @Expose()
  @Type(() => ExchangePartyDto)
  @ApiProperty({ type: () => ExchangePartyDto })
  sender: ExchangePartyDto;

  @Expose()
  @Type(() => ExchangePartyDto)
  @ApiProperty({ type: () => ExchangePartyDto })
  owner: ExchangePartyDto;

  @Expose()
  @Type(() => BookResponseDto)
  @ApiProperty({ type: () => BookResponseDto })
  requestedBook: BookResponseDto;

  @Expose()
  @Type(() => BookResponseDto)
  @ApiPropertyOptional({ type: () => BookResponseDto, nullable: true })
  selectedOfferedBook: BookResponseDto | null;

  @Expose()
  @Type(() => BookResponseDto)
  @ApiProperty({ type: () => [BookResponseDto] })
  offeredBooks: BookResponseDto[];

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;

  constructor(entity: ExchangeRequestWithRelations) {
    const showContacts = entity.status === ExchangeRequestStatus.ACCEPTED;

    this.id = entity.id;
    this.message = entity.message;
    this.status = entity.status;
    this.senderId = entity.senderId;
    this.ownerId = entity.ownerId;
    this.requestedBookId = entity.requestedBookId;
    this.selectedOfferedBookId = entity.selectedOfferedBookId;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
    this.sender = new ExchangePartyDto(entity.sender, showContacts);
    this.owner = new ExchangePartyDto(entity.owner, showContacts);
    this.requestedBook = new ExchangeResponseBookHelper(
      entity.requestedBook,
    ).toDto();
    this.selectedOfferedBook = entity.selectedOfferedBook
      ? new BookResponseDto(entity.selectedOfferedBook)
      : null;
    this.offeredBooks = entity.offeredBooks.map(
      (item) => new BookResponseDto(item.book),
    );
  }
}

class ExchangeResponseBookHelper {
  constructor(private readonly book: Book) {}
  toDto(): BookResponseDto {
    return new BookResponseDto(this.book);
  }
}
