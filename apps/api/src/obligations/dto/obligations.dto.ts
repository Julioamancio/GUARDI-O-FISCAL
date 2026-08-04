import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const DEPARTMENTS = ['FISCAL', 'CONTABIL', 'PESSOAL', 'FINANCEIRO', 'SOCIETARIO', 'OUTRO'] as const;
export const SPHERES = ['FEDERAL', 'ESTADUAL', 'MUNICIPAL', 'TRABALHISTA', 'PREVIDENCIARIA', 'OUTRA'] as const;
export const PERIODICITIES = ['MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'] as const;
export const PRIORITIES = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'] as const;

export class DueRuleDto {
  @ApiPropertyOptional({ description: 'Dia fixo (1-31), "LAST_DAY" ou "LAST_BUSINESS_DAY"' })
  @IsOptional()
  day?: number | 'LAST_DAY' | 'LAST_BUSINESS_DAY';

  @ApiPropertyOptional({ description: 'N-ésimo dia útil do mês (alternativa a day)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  businessDay?: number;

  @ApiProperty({ description: 'Meses após a competência (DAS: 1)' })
  @IsInt()
  @Min(0)
  @Max(12)
  monthOffset!: number;

  @ApiProperty({ enum: ['NONE', 'ANTICIPATE', 'POSTPONE'] })
  @IsIn(['NONE', 'ANTICIPATE', 'POSTPONE'])
  adjustment!: 'NONE' | 'ANTICIPATE' | 'POSTPONE';
}

export class CreateObligationDto {
  @ApiProperty({ description: 'Empresas que receberão a obrigação', type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  companyIds!: string[];

  @ApiPropertyOptional({ description: 'Template do catálogo (herda regra/checklist se campos omitidos)' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ enum: DEPARTMENTS })
  @IsOptional()
  @IsIn(DEPARTMENTS as unknown as string[])
  department?: (typeof DEPARTMENTS)[number];

  @ApiPropertyOptional({ enum: SPHERES })
  @IsOptional()
  @IsIn(SPHERES as unknown as string[])
  sphere?: (typeof SPHERES)[number];

  @ApiPropertyOptional({ enum: PERIODICITIES })
  @IsOptional()
  @IsIn(PERIODICITIES as unknown as string[])
  periodicity?: (typeof PERIODICITIES)[number];

  @ApiPropertyOptional({ description: 'Mês-base para trimestral/semestral/anual (1-12)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  anchorMonth?: number;

  @ApiPropertyOptional({ type: DueRuleDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DueRuleDto)
  dueRule?: DueRuleDto;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES as unknown as string[])
  priority?: (typeof PRIORITIES)[number];

  @ApiPropertyOptional({ description: 'Responsável padrão pelas tarefas geradas' })
  @IsOptional()
  @IsUUID()
  responsibleId?: string;
}

export class UpdateObligationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ type: DueRuleDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DueRuleDto)
  dueRule?: DueRuleDto;

  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES as unknown as string[])
  priority?: (typeof PRIORITIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleId?: string | null;

  @ApiPropertyOptional({ description: 'Desativar interrompe a geração de tarefas' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateHolidayDto {
  @ApiProperty({ example: '2026-11-30' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 'Aniversário do município' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: ['ESTADUAL', 'MUNICIPAL'] })
  @IsIn(['ESTADUAL', 'MUNICIPAL'])
  scope!: 'ESTADUAL' | 'MUNICIPAL';

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  uf?: string;

  @ApiPropertyOptional({ example: 'São Paulo' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  municipio?: string;
}
