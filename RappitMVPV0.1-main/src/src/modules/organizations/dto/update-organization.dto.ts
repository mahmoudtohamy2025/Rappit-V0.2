import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
