import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export const REGIMES = ['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MEI', 'IMUNE_ISENTA', 'OUTRO'] as const;
export const COMPANY_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const RESPONSIBLE_AREAS = ['INTERNO', 'FISCAL', 'CONTABIL', 'PESSOAL', 'FINANCEIRO'] as const;

export class CreateCompanyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  razaoSocial!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nomeFantasia?: string;

  @ApiProperty({ example: '12.345.678/0001-90' })
  @IsString()
  @IsNotEmpty()
  cnpj!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  inscricaoEstadual?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  inscricaoMunicipal?: string;

  @ApiPropertyOptional({ example: '6920-6/01' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  cnaePrincipal?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cnaesSecundarios?: string[];

  @ApiPropertyOptional({ enum: REGIMES })
  @IsOptional()
  @IsIn(REGIMES as unknown as string[])
  regimeTributario?: (typeof REGIMES)[number];

  @ApiPropertyOptional({ example: 'ME' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  enquadramento?: string;

  @ApiPropertyOptional({ example: 'LTDA' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  tipoJuridico?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  uf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  municipio?: string;

  @ApiPropertyOptional({ example: '2018-05-10' })
  @IsOptional()
  @IsDateString()
  dataAbertura?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  funcionariosCount?: number;

  @ApiPropertyOptional({ enum: RISK_LEVELS })
  @IsOptional()
  @IsIn(RISK_LEVELS as unknown as string[])
  riskLevel?: (typeof RISK_LEVELS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {
  @ApiPropertyOptional({ enum: COMPANY_STATUSES })
  @IsOptional()
  @IsIn(COMPANY_STATUSES as unknown as string[])
  status?: (typeof COMPANY_STATUSES)[number];
}

export class CreateContactDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'Financeiro' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  role?: string;
}

export class SetResponsibleDto {
  @ApiProperty({ enum: RESPONSIBLE_AREAS })
  @IsIn(RESPONSIBLE_AREAS as unknown as string[])
  area!: (typeof RESPONSIBLE_AREAS)[number];

  @ApiProperty({ description: 'Usuário do escritório responsável pela área' })
  @IsUUID()
  userId!: string;
}
