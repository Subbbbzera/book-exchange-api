import { Module } from '@nestjs/common';
import { BooksModule } from '../books/books.module';
import { ExchangeRequestsController } from './exchange-requests.controller';
import { ExchangeRequestsService } from './exchange-requests.service';

@Module({
  imports: [BooksModule],
  controllers: [ExchangeRequestsController],
  providers: [ExchangeRequestsService],
  exports: [ExchangeRequestsService],
})
export class ExchangeRequestsModule {}
