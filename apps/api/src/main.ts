import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Atrás do Nginx: respeita X-Forwarded-For para IP real (auditoria e rate limit)
  app.set('trust proxy', 1);

  app.use(helmet());

  const appDomain = process.env.APP_DOMAIN ?? 'localhost';
  app.enableCors({
    origin: [
      new RegExp(`^https?://([a-z0-9-]+\\.)?${appDomain.replace(/\./g, '\\.')}(:\\d+)?$`),
      'http://localhost:3000',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Guardião Fiscal — API')
      .setDescription('Camada de controle, auditoria e prevenção fiscal para escritórios de contabilidade')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`API Guardião Fiscal ouvindo na porta ${port}`);
}

void bootstrap();
