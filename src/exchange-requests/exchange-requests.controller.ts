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
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreateExchangeRequestDto } from './dto/create-exchange-request.dto';
import { ExchangeRequestResponseDto } from './dto/exchange-request-response.dto';
import { ExchangeRequestsQueryDto } from './dto/exchange-requests-query.dto';
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
}
