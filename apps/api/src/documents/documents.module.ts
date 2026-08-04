import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentRequestsService } from './document-requests.service';
import { PortalService } from './portal.service';
import {
  DocumentRequestsController,
  DocumentsController,
  PortalController,
} from './documents.controller';

@Module({
  controllers: [DocumentRequestsController, DocumentsController, PortalController],
  providers: [DocumentsService, DocumentRequestsService, PortalService],
})
export class DocumentsModule {}
