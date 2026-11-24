import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { MeBooksController } from './me-books.controller';

@Module({
  controllers: [MeBooksController, BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}
