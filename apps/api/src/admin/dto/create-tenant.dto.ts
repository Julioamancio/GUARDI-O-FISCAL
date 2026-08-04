import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_RULE } from '../../auth/dto/auth.dto';

export class TenantAdminDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ description: PASSWORD_MESSAGE })
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password!: string;
}

export class CreateTenantDto {
  @ApiProperty({ example: 'Contabilidade Exemplo LTDA' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  razaoSocial!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nomeFantasia?: string;

  @ApiProperty({ description: 'Subdomínio do escritório', example: 'escritorio1' })
  @IsString()
  @MinLength(3)
  @MaxLength(63)
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, {
    message: 'Slug deve conter apenas letras minúsculas, números e hífens',
  })
  slug!: string;

  @ApiPropertyOptional({ example: '12.345.678/0001-90' })
  @IsOptional()
  @Matches(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/, { message: 'CNPJ inválido' })
  cnpj?: string;

  @ApiProperty({ description: 'E-mail de contato do escritório' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ description: 'Slug do plano', example: 'escritorio-pequeno' })
  @IsString()
  @IsNotEmpty()
  planSlug!: string;

  @ApiProperty({ description: 'Administrador inicial do escritório', type: TenantAdminDto })
  @ValidateNested()
  @Type(() => TenantAdminDto)
  admin!: TenantAdminDto;
}
