import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  PaginatedResponseDto,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { BooksService } from './books.service';
import { BookResponseDto } from './dto/book-response.dto';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

@ApiTags('My Books (/me/books)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/books')
export class MeBooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated list of my books' })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async getMyBooks(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<BookResponseDto>> {
    return this.booksService.getMyBooks(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Add a new book to my collection' })
  @ApiCreatedResponse({ type: BookResponseDto })
  async createMyBook(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookDto,
  ): Promise<BookResponseDto> {
    return this.booksService.createMyBook(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update my book details' })
  @ApiOkResponse({ type: BookResponseDto })
  @ApiNotFoundResponse({ description: 'Book not found' })
  @ApiForbiddenResponse({ description: 'Not the owner of this book' })
  async updateMyBook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) bookId: string,
    @Body() dto: UpdateBookDto,
  ): Promise<BookResponseDto> {
    return this.booksService.updateMyBook(user.id, bookId, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete my book (forbidden if book has active exchange requests)',
  })
  @ApiOkResponse({ type: BookResponseDto })
  @ApiNotFoundResponse({ description: 'Book not found' })
  @ApiForbiddenResponse({ description: 'Not the owner of this book' })
  @ApiConflictResponse({
    description: 'Book has an active exchange request or was already exchanged',
  })
  async deleteMyBook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) bookId: string,
  ): Promise<BookResponseDto> {
    return this.booksService.deleteMyBook(user.id, bookId);
  }
}
