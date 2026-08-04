import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateDocumentRequestDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiProperty({ example: 'Documentos da competência 08/2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({ description: 'Mensagem exibida ao cliente e enviada por e-mail' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional({ example: '2026-08' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Competência deve ser YYYY-MM' })
  competence?: string;

  @ApiPropertyOptional({ example: '2026-08-15' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ type: [String], description: 'Documentos solicitados (um item por documento)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(160, { each: true })
  items!: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  remindersEnabled?: boolean;
}

export class UpdateDocumentRequestDto {
  @ApiPropertyOptional({ enum: ['CANCELADA'] })
  @IsOptional()
  @IsIn(['CANCELADA'])
  status?: 'CANCELADA';

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  remindersEnabled?: boolean;
}

export class ReviewItemDto {
  @ApiProperty({ enum: ['APROVADO', 'REJEITADO'] })
  @IsIn(['APROVADO', 'REJEITADO'])
  status!: 'APROVADO' | 'REJEITADO';

  @ApiPropertyOptional({ description: 'Obrigatório ao rejeitar: o cliente verá este motivo' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

export class UploadDocumentDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiPropertyOptional({ description: 'Para adicionar nova versão a um documento existente' })
  @IsOptional()
  @IsUUID()
  documentId?: string;

  @ApiPropertyOptional({ example: 'Extrato bancário agosto' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'extratos' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @ApiPropertyOptional({ example: '2026-08' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Competência deve ser YYYY-MM' })
  competence?: string;
}
