import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<EnvironmentVariables, true>);
  const port = configService.get('PORT', { infer: true });
  await app.listen(port);
}
void bootstrap();
