import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, ValidateNested, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentStatus } from '@prisma/client';

/**
 * DTO for creating/updating an order from channel payload
 *
 * Used when importing orders from Shopify, WooCommerce, etc.
 * Supports upsert semantics based on externalOrderId.
 */

export class OrderItemFromChannelDto {
  @IsString()
  @IsNotEmpty()
  externalItemId: string;

  @IsString()
  @IsNotEmpty()
  sku: string; // SKU code to match against SKU.sku

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  variantName?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsNumber()
  @Min(0)
  totalPrice: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  taxAmount?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  metadata?: any;
}

export class AddressFromChannelDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsNotEmpty()
  street1: string;

  @IsString()
  @IsOptional()
  street2?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @IsString()
  @IsNotEmpty()
  country: string; // ISO 3166-1 alpha-2 (SA, AE, etc.)

  @IsString()
  @IsOptional()
  phone?: string;
}

export class CustomerFromChannelDto {
  @IsString()
  @IsOptional()
  externalId?: string; // Customer ID from channel

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsOptional()
  metadata?: any;
}

export class CreateOrderFromChannelDto {
  @IsString()
  @IsNotEmpty()
  channelId: string; // ID of the channel this order came from

  @IsString()
  @IsNotEmpty()
  externalOrderId: string; // Order ID from channel (for idempotency)

  @IsString()
  @IsOptional()
  orderNumber?: string; // Channel's order number (we'll generate our own)

  @ValidateNested()
  @Type(() => CustomerFromChannelDto)
  customer: CustomerFromChannelDto;

  @ValidateNested()
  @Type(() => AddressFromChannelDto)
  shippingAddress: AddressFromChannelDto;

  @ValidateNested()
  @Type(() => AddressFromChannelDto)
  @IsOptional()
  billingAddress?: AddressFromChannelDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemFromChannelDto)
  items: OrderItemFromChannelDto[];

  // Financial
  @IsNumber()
  @Min(0)
  subtotal: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  shippingCost?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  taxAmount?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountAmount?: number;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsString()
  @IsOptional()
  currency?: string; // Defaults to SAR

  // Payment
  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  // Notes
  @IsString()
  @IsOptional()
  customerNote?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsOptional()
  metadata?: any; // Raw payload from channel

  @IsOptional()
  orderDate?: Date | string; // Order date from channel
}
