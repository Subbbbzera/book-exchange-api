import { ApiProperty } from '@nestjs/swagger';
import { Book } from '@prisma/client';
import { Exclude, Expose, Type } from 'class-transformer';
import { BookResponseDto } from '../../books/dto/book-response.dto';
import { ExchangePartyDto } from './exchange-request-response.dto';

export interface ExchangeHistoryWithRelations {
  id: string;
  exchangeRequestId: string;
  requestedBookId: string;
  offeredBookId: string;
  senderId: string;
  ownerId: string;
  exchangedAt: Date;
  requestedBook: Book;
  offeredBook: Book;
  sender: { id: string; name: string; email: string; phone: string };
  owner: { id: string; name: string; email: string; phone: string };
}

@Exclude()
export class ExchangeHistoryResponseDto {
  @Expose()
  @ApiProperty({ example: 'h1a2b3c4-5678-90ab-cdef-1234567890ab' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'e1f2a3b4-5678-90ab-cdef-1234567890ab' })
  exchangeRequestId: string;

  @Expose()
  @ApiProperty()
  requestedBookId: string;

  @Expose()
  @ApiProperty()
  offeredBookId: string;

  @Expose()
  @ApiProperty()
  senderId: string;

  @Expose()
  @ApiProperty()
  ownerId: string;

  @Expose()
  @Type(() => BookResponseDto)
  @ApiProperty({ type: () => BookResponseDto })
  requestedBook: BookResponseDto;

  @Expose()
  @Type(() => BookResponseDto)
  @ApiProperty({ type: () => BookResponseDto })
  offeredBook: BookResponseDto;

  @Expose()
  @Type(() => ExchangePartyDto)
  @ApiProperty({ type: () => ExchangePartyDto })
  sender: ExchangePartyDto;

  @Expose()
  @Type(() => ExchangePartyDto)
  @ApiProperty({ type: () => ExchangePartyDto })
  owner: ExchangePartyDto;

  @Expose()
  @ApiProperty()
  exchangedAt: Date;

  constructor(entity: ExchangeHistoryWithRelations) {
    this.id = entity.id;
    this.exchangeRequestId = entity.exchangeRequestId;
    this.requestedBookId = entity.requestedBookId;
    this.offeredBookId = entity.offeredBookId;
    this.senderId = entity.senderId;
    this.ownerId = entity.ownerId;
    this.exchangedAt = entity.exchangedAt;
    this.requestedBook = new BookResponseDto(entity.requestedBook);
    this.offeredBook = new BookResponseDto(entity.offeredBook);
    // In ExchangeHistory, the exchange is already ACCEPTED, so both parties see each other's contacts
    this.sender = new ExchangePartyDto(entity.sender, true);
    this.owner = new ExchangePartyDto(entity.owner, true);
  }
}
