import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { BooksService } from './books.service';
import { BookDetailResponseDto } from './dto/book-detail-response.dto';
import { BookResponseDto } from './dto/book-response.dto';
import { CatalogQueryDto } from './dto/catalog-query.dto';

@ApiTags('Catalog (/books)')
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  @ApiOperation({
    summary:
      'Get public catalog of AVAILABLE books (search, filters, alphabetical sort, pagination)',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async getCatalog(
    @Query() query: CatalogQueryDto,
  ): Promise<PaginatedResponseDto<BookResponseDto>> {
    return this.booksService.getCatalog(query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get AVAILABLE book details by ID with owner name (without email or phone)',
  })
  @ApiOkResponse({ type: BookDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Book not found or not available' })
  async getCatalogBookById(
    @Param('id', ParseUUIDPipe) bookId: string,
  ): Promise<BookDetailResponseDto> {
    return this.booksService.getCatalogBookById(bookId);
  }
}
