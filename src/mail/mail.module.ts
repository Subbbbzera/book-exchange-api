import { Global, Injectable, Logger, Module } from '@nestjs/common';

export interface ExchangeRequestEmailPayload {
  ownerEmail: string;
  ownerName: string;
  senderName: string;
  senderEmail: string;
  requestedBookName: string;
  message: string;
  offeredBooks: { name: string; author: string; condition: string }[];
}

export interface PasswordResetEmailPayload {
  email: string;
  name: string;
  resetToken: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendExchangeRequestNotification(
    payload: ExchangeRequestEmailPayload,
  ): Promise<void> {
    const booksList = payload.offeredBooks
      .map((b) => `- "${b.name}" by ${b.author} (${b.condition})`)
      .join('\n');

    this.logger.log(
      `\n[EMAIL SENT -> To: ${payload.ownerEmail} (${payload.ownerName})]\n` +
        `Subject: New Book Exchange Request for "${payload.requestedBookName}"\n` +
        `From: ${payload.senderName} <${payload.senderEmail}>\n` +
        `Message: ${payload.message}\n` +
        `Offered Books:\n${booksList}\n`,
    );
  }

  async sendPasswordResetEmail(
    payload: PasswordResetEmailPayload,
  ): Promise<void> {
    this.logger.log(
      `\n[EMAIL SENT -> To: ${payload.email} (${payload.name})]\n` +
        `Subject: Password Reset Request\n` +
        `Use the following token to reset your password (valid for 15 minutes): ${payload.resetToken}\n`,
    );
  }
}

@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
