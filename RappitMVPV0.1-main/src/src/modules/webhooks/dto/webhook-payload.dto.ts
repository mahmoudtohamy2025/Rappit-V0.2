import { IsNotEmpty, IsObject, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WebhookPayloadDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  event: string;

  @ApiProperty()
  @IsObject()
  @IsNotEmpty()
  data: any;
}
