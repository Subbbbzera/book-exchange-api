import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { MeBooksController } from './me-books.controller';

@Module({
  controllers: [MeBooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}
