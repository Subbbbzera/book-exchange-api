import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { CreateExchangeRequestDto } from './dto/create-exchange-request.dto';
import { ExchangeHistoryResponseDto } from './dto/exchange-history-response.dto';
import { ExchangeRequestResponseDto } from './dto/exchange-request-response.dto';
import { ExchangeRequestsQueryDto } from './dto/exchange-requests-query.dto';
import { CreateReviewDto, ReviewResponseDto } from './dto/review.dto';
import { UpdateExchangeRequestDto } from './dto/update-exchange-request.dto';
import { ExchangeRequestsService } from './exchange-requests.service';

@ApiTags('Exchange Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ExchangeRequestsController {
  constructor(
    private readonly exchangeRequestsService: ExchangeRequestsService,
  ) {}

  @Post('books/:id/exchange-requests')
  @ApiOperation({
    summary:
      'Create an exchange request for an available book offering your own available books',
  })
  @ApiCreatedResponse({ type: ExchangeRequestResponseDto })
  @ApiBadRequestResponse({
    description: 'Cannot request your own book or invalid payload',
  })
  @ApiForbiddenResponse({
    description: 'Cannot offer books that do not belong to you',
  })
  @ApiConflictResponse({
    description:
      'Duplicate active request or one of the books is not AVAILABLE',
  })
  async createExchangeRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) requestedBookId: string,
    @Body() dto: CreateExchangeRequestDto,
  ): Promise<ExchangeRequestResponseDto> {
    return this.exchangeRequestsService.createExchangeRequest(
      user.id,
      requestedBookId,
      dto,
    );
  }

  @Get('me/exchange-requests')
  @ApiOperation({
    summary:
      'Get incoming and outgoing exchange requests (filterable by status and direction)',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async getMyExchangeRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ExchangeRequestsQueryDto,
  ): Promise<PaginatedResponseDto<ExchangeRequestResponseDto>> {
    return this.exchangeRequestsService.getMyExchangeRequests(user.id, query);
  }

  @Patch('exchange-requests/:id')
  @ApiOperation({
    summary:
      'Accept or reject an incoming exchange request (owner), or cancel an outgoing one (sender)',
  })
  @ApiOkResponse({ type: ExchangeRequestResponseDto })
  @ApiBadRequestResponse({
    description: 'Missing or invalid selectedOfferedBookId on acceptance',
  })
  @ApiForbiddenResponse({
    description: 'Not authorized to perform this status change',
  })
  @ApiNotFoundResponse({ description: 'Exchange request not found' })
  @ApiConflictResponse({
    description:
      'Invalid status transition (only PENDING -> ACCEPTED/REJECTED/CANCELLED allowed) or book already exchanged',
  })
  async updateExchangeRequestStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() dto: UpdateExchangeRequestDto,
  ): Promise<ExchangeRequestResponseDto> {
    return this.exchangeRequestsService.updateExchangeRequestStatus(
      user.id,
      requestId,
      dto,
    );
  }

  @Get('me/exchanges')
  @ApiOperation({
    summary:
      'Get paginated history of completed book exchanges for current user',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async getMyExchanges(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<ExchangeHistoryResponseDto>> {
    return this.exchangeRequestsService.getMyExchanges(user.id, query);
  }

  @Post('exchanges/:id/reviews')
  @ApiOperation({
    summary: 'Leave a review and rating (1-5) after a completed exchange',
  })
  @ApiCreatedResponse({ type: ReviewResponseDto })
  @ApiForbiddenResponse({
    description: 'Not a participant of this exchange',
  })
  @ApiConflictResponse({
    description: 'Review already submitted for this exchange',
  })
  async createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) exchangeHistoryId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.exchangeRequestsService.createReview(
      user.id,
      exchangeHistoryId,
      dto,
    );
  }

  @Get('me/reviews')
  @ApiOperation({
    summary: 'Get paginated list of reviews received by current user',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  async getMyReviews(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<ReviewResponseDto>> {
    return this.exchangeRequestsService.getMyReviews(user.id, query);
  }
}
