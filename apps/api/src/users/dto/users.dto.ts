import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_RULE } from '../../auth/dto/auth.dto';

/** Papéis atribuíveis dentro de um escritório (superadmin fica de fora). */
export const TENANT_ROLES = ['tenant_admin', 'accountant', 'client', 'auditor'] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export class CreateUserDto {
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

  @ApiProperty({ enum: TENANT_ROLES })
  @IsIn(TENANT_ROLES as unknown as string[])
  role!: TenantRole;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: TENANT_ROLES })
  @IsOptional()
  @IsIn(TENANT_ROLES as unknown as string[])
  role?: TenantRole;

  @ApiPropertyOptional({ description: 'Ativa/desativa o acesso do usuário' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
