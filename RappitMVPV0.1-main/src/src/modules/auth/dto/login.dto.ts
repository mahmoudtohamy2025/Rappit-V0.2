import { IsEmail, IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string; // Optional: select which org to login to
}
