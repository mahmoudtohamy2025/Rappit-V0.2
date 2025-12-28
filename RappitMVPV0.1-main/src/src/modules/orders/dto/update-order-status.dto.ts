import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    description: 'New order status',
    example: 'READY_TO_SHIP',
  })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;

  @ApiPropertyOptional({
    description: 'Optional comment explaining the status change',
    example: 'Payment confirmed by Stripe webhook',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}