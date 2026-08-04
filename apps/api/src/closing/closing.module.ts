import { Module } from '@nestjs/common';
import { ClosingService } from './closing.service';
import { ClosingController } from './closing.controller';

@Module({
  controllers: [ClosingController],
  providers: [ClosingService],
})
export class ClosingModule {}
