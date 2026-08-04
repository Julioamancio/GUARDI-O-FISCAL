import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { DEPARTMENTS, PRIORITIES } from '../../obligations/dto/obligations.dto';

/** Status que o usuário pode definir manualmente (VENCIDA é exclusiva do sistema). */
export const USER_SETTABLE_STATUSES = [
  'NAO_INICIADA',
  'AGUARDANDO_DOCUMENTOS',
  'EM_ANDAMENTO',
  'EM_CONFERENCIA',
  'AGUARDANDO_APROVACAO',
  'CONCLUIDA',
  'BLOQUEADA',
  'CANCELADA',
] as const;

export class CreateTaskDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ enum: DEPARTMENTS })
  @IsOptional()
  @IsIn(DEPARTMENTS as unknown as string[])
  department?: (typeof DEPARTMENTS)[number];

  @ApiProperty({ example: '2026-08', description: 'Competência no formato YYYY-MM' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Competência deve ser YYYY-MM' })
  competence!: string;

  @ApiProperty({ example: '2026-08-20' })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES as unknown as string[])
  priority?: (typeof PRIORITIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Itens do checklist' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  checklist?: string[];
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ enum: USER_SETTABLE_STATUSES })
  @IsOptional()
  @IsIn(USER_SETTABLE_STATUSES as unknown as string[])
  status?: (typeof USER_SETTABLE_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES as unknown as string[])
  priority?: (typeof PRIORITIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleId?: string;

  @ApiPropertyOptional({
    description: 'Checklist completo: [{ item, done }] — substitui o atual',
    type: 'array',
    items: { type: 'object', properties: { item: { type: 'string' }, done: { type: 'boolean' } } },
  })
  @IsOptional()
  @IsArray()
  checklist?: Array<{ item: string; done: boolean }>;
}

export class CreateCommentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;
}
