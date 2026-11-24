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
import { Role } from '@prisma/client';
import { BookResponseDto } from '../books/dto/book-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AdminService } from './admin.service';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';

@ApiTags('Admin (/admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({
    summary: 'Get paginated list of users with search (ADMIN only)',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  async getUsers(
    @Query() query: AdminUsersQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    return this.adminService.getUsers(query);
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a new user (ADMIN only)' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: 'Email already exists' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  async createUser(@Body() dto: AdminCreateUserDto): Promise<UserResponseDto> {
    return this.adminService.createUser(dto);
  }

  @Patch('users/:id')
  @ApiOperation({
    summary: 'Update or block/unblock a user by ID (ADMIN only)',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Email already exists' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  async updateUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: AdminUpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.adminService.updateUser(userId, dto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete a user by ID (ADMIN only)' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  async deleteUser(
    @Param('id', ParseUUIDPipe) userId: string,
  ): Promise<UserResponseDto> {
    return this.adminService.deleteUser(userId);
  }

  @Delete('books/:id')
  @ApiOperation({ summary: 'Delete any book by ID (ADMIN only)' })
  @ApiOkResponse({ type: BookResponseDto })
  @ApiNotFoundResponse({ description: 'Book not found' })
  @ApiForbiddenResponse({ description: 'Requires ADMIN role' })
  async deleteBook(
    @Param('id', ParseUUIDPipe) bookId: string,
  ): Promise<BookResponseDto> {
    return this.adminService.deleteAnyBook(bookId);
  }
}
