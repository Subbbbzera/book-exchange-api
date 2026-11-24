import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { EnvironmentVariables } from '../src/config/env.validation';
import { PrismaService } from '../src/prisma/prisma.service';

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const configService = app.get(ConfigService<EnvironmentVariables, true>);
    const prisma = app.get(PrismaService);

    const adminEmail = configService.get('ADMIN_EMAIL', { infer: true });
    const adminPassword = configService.get('ADMIN_PASSWORD', { infer: true });
    const adminName = configService.get('ADMIN_NAME', { infer: true });
    const adminPhone = configService.get('ADMIN_PHONE', { infer: true });

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: adminName,
        phone: adminPhone,
        password: hashedPassword,
        role: Role.ADMIN,
        isBlocked: false,
      },
      create: {
        email: adminEmail,
        name: adminName,
        phone: adminPhone,
        password: hashedPassword,
        role: Role.ADMIN,
        isBlocked: false,
      },
    });

    console.log(`Seed completed: Admin user (${adminEmail}) is ready.`);
  } finally {
    await app.close();
  }
}

void seed();
