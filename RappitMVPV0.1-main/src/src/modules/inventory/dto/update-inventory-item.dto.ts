import { IsOptional, IsString, IsInt, IsObject, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateInventoryItemDto {
  @ApiPropertyOptional({ example: 'Premium Cotton T-Shirt Updated' })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional({ example: 'Large / Blue' })
  @IsOptional()
  @IsString()
  variantName?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderPoint?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: any;
}
