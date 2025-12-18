import { IsNotEmpty, IsString, IsEnum, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ShippingProvider {
  DHL = 'DHL',
  FEDEX = 'FEDEX',
}

export class CreateShipmentDto {
  @ApiProperty({ example: 'order-uuid' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ enum: ShippingProvider })
  @IsEnum(ShippingProvider)
  @IsNotEmpty()
  provider: ShippingProvider;

  @ApiPropertyOptional({
    example: {
      serviceType: 'EXPRESS',
      packageType: 'ENVELOPE',
      weight: 0.5,
      dimensions: { length: 20, width: 15, height: 5 },
    },
  })
  @IsOptional()
  @IsObject()
  shipmentOptions?: any;
}
