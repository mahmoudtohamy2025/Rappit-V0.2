import { IsNotEmpty, IsString, IsOptional, IsObject } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
