import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsDateString,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class OrderItemDto {
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

  @ApiProperty({ example: 2 })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 99.99 })
  @IsNumber()
  unitPrice: number;

  @ApiProperty({ example: 199.98 })
  @IsNumber()
  totalPrice: number;

  @ApiPropertyOptional({ example: 'ext-item-123' })
  @IsOptional()
  @IsString()
  externalItemId?: string;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'ch-uuid' })
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @ApiProperty({ example: 'shopify-order-12345' })
  @IsString()
  @IsNotEmpty()
  externalOrderId: string;

  @ApiProperty({ example: '#1001' })
  @IsString()
  @IsNotEmpty()
  orderNumber: string;

  @ApiProperty({ example: 'Ahmed Al-Rashid' })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiPropertyOptional({ example: 'ahmed@example.com' })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiPropertyOptional({ example: '+966501234567' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty()
  @IsObject()
  @IsNotEmpty()
  shippingAddress: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  billingAddress?: any;

  @ApiProperty({ example: 199.98 })
  @IsNumber()
  totalAmount: number;

  @ApiPropertyOptional({ example: 'SAR', default: 'SAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  @IsDateString()
  orderDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: any;
}
