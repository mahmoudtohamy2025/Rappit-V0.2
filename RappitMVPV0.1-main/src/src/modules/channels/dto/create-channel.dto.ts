import { IsNotEmpty, IsString, IsEnum, IsObject, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ChannelType {
  SHOPIFY = 'SHOPIFY',
  WOOCOMMERCE = 'WOOCOMMERCE',
}

export class CreateChannelDto {
  @ApiProperty({ example: 'My Shopify Store' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ChannelType })
  @IsEnum(ChannelType)
  @IsNotEmpty()
  type: ChannelType;

  @ApiProperty({
    example: {
      shopUrl: 'mystore.myshopify.com',
      accessToken: 'shpat_xxxxx',
    },
  })
  @IsObject()
  @IsNotEmpty()
  config: any;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
