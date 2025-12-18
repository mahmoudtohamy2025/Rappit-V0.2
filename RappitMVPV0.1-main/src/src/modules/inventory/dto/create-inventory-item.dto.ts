import { IsNotEmpty, IsString, IsInt, IsOptional, IsObject, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInventoryItemDto {
  @ApiProperty({ example: 'SKU-12345' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({ example: 'Premium Cotton T-Shirt' })
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiPropertyOptional({ example: 'Large / Blue' })
  @IsOptional()
  @IsString()
  variantName?: string;

  @ApiProperty({ example: 100, default: 0 })
  @IsInt()
  @Min(0)
  quantityOnHand: number;

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
