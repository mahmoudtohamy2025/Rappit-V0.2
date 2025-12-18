import { IsNotEmpty, IsInt, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AdjustmentType {
  MANUAL = 'MANUAL',
  RESTOCK = 'RESTOCK',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
  CORRECTION = 'CORRECTION',
}

export class AdjustInventoryDto {
  @ApiProperty({ enum: AdjustmentType })
  @IsEnum(AdjustmentType)
  @IsNotEmpty()
  type: AdjustmentType;

  @ApiProperty({ example: 10, description: 'Positive to add, negative to subtract' })
  @IsInt()
  @IsNotEmpty()
  quantity: number;

  @ApiPropertyOptional({ example: 'Restocking from supplier' })
  @IsOptional()
  @IsString()
  reason?: string;
}
