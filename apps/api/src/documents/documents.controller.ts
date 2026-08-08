import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UPLOAD_MAX_BYTES } from '@guardiao/shared';
import { DocumentsService, UploadedFileLike } from './documents.service';
import { DocumentRequestsService } from './document-requests.service';
import { PortalService } from './portal.service';
import {
  CreateDocumentRequestDto,
  ReviewItemDto,
  UpdateDocumentRequestDto,
  UploadDocumentDto,
} from './dto/documents.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

const fileUpload = () => FileInterceptor('file', { limits: { fileSize: UPLOAD_MAX_BYTES } });

@ApiTags('document-requests')
@ApiBearerAuth()
@Controller('document-requests')
export class DocumentRequestsController {
  constructor(private readonly requestsService: DocumentRequestsService) {}

  @Post()
  @RequirePermissions('documents.request')
  @ApiOperation({ summary: 'Solicita documentos ao cliente (notifica por e-mail/portal)' })
  create(@Body() dto: CreateDocumentRequestDto) {
    return this.requestsService.create(dto);
  }

  @Get()
  @RequirePermissions('documents.read')
  list(@Query('companyId') companyId?: string, @Query('status') status?: string) {
    return this.requestsService.list(companyId, status);
  }

  @Get(':id')
  @RequirePermissions('documents.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.requestsService.get(id);
  }

  @Patch(':id')
  @RequirePermissions('documents.request')
  @ApiOperation({ summary: 'Cancela, muda prazo ou pausa lembretes' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDocumentRequestDto) {
    return this.requestsService.update(id, dto);
  }

  @Patch('items/:itemId/review')
  @RequirePermissions('documents.write')
  @ApiOperation({ summary: 'Confere item recebido: aprova ou rejeita com motivo' })
  review(@Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: ReviewItemDto) {
    return this.requestsService.reviewItem(itemId, dto);
  }
}

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @RequirePermissions('documents.write')
  @UseInterceptors(fileUpload())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload direto pelo escritório (novo documento ou nova versão)' })
  upload(@UploadedFile() file: UploadedFileLike, @Body() dto: UploadDocumentDto) {
    return this.documentsService.uploadByAccountant(dto, file);
  }

  @Get()
  @RequirePermissions('documents.read')
  list(
    @Query('companyId') companyId?: string,
    @Query('competence') competence?: string,
    @Query('category') category?: string,
  ) {
    return this.documentsService.list(companyId, competence, category);
  }

  @Get(':id/download')
  @RequirePermissions('documents.read')
  @ApiOperation({ summary: 'Link assinado temporário (5 min); inline=true para visualizar' })
  download(@Param('id', ParseUUIDPipe) id: string, @Query('inline') inline?: string) {
    return this.documentsService.downloadUrl(id, inline === 'true');
  }
}

@ApiTags('portal')
@ApiBearerAuth()
@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('overview')
  @RequirePermissions('documents.read')
  @ApiOperation({ summary: 'Portal do cliente: empresas vinculadas e pendências' })
  overview() {
    return this.portalService.overview();
  }

  @Get('requests')
  @RequirePermissions('documents.read')
  listRequests() {
    return this.portalService.listRequests();
  }

  @Post('items/:itemId/upload')
  @RequirePermissions('documents.write')
  @UseInterceptors(fileUpload())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Cliente envia arquivo para um item solicitado' })
  upload(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @UploadedFile() file: UploadedFileLike,
    @Body('category') category?: string,
  ) {
    return this.portalService.uploadToItem(itemId, file, category);
  }

  @Get('documents')
  @RequirePermissions('documents.read')
  listDocuments() {
    return this.portalService.listDocuments();
  }

  @Get('documents/:id/download')
  @RequirePermissions('documents.read')
  download(@Param('id', ParseUUIDPipe) id: string, @Query('inline') inline?: string) {
    return this.portalService.downloadUrl(id, inline === 'true');
  }
}
