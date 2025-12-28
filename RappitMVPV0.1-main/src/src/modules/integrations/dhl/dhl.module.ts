import { Module } from '@nestjs/common';
import { DhlService } from './dhl.service';

@Module({
  providers: [DhlService],
  exports: [DhlService],
})
export class DhlModule {}
