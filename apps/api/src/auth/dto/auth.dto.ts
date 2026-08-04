import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Política de senha: mínimo 10 caracteres, maiúscula, minúscula e número. */
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;
export const PASSWORD_MESSAGE =
  'A senha deve ter no mínimo 10 caracteres, com letra maiúscula, minúscula e número';

export class LoginDto {
  @ApiProperty({ example: 'contador@escritorio.com.br' })
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Informe a senha' })
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({
    description: 'Slug do escritório (subdomínio). Ausente = login de superadmin.',
    example: 'escritorio1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(63)
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, { message: 'Slug de escritório inválido' })
  tenantSlug?: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token recebido no login' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ description: PASSWORD_MESSAGE })
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}
