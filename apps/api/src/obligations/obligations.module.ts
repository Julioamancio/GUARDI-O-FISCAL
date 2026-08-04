import { Module } from '@nestjs/common';
import { ObligationsService } from './obligations.service';
import { RecurrenceService } from './recurrence.service';
import { ObligationsController } from './obligations.controller';

@Module({
  controllers: [ObligationsController],
  providers: [ObligationsService, RecurrenceService],
  exports: [RecurrenceService],
})
export class ObligationsModule {}
