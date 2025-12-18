import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { OrdersProcessor } from './processors/orders.processor';
import { InventoryProcessor } from './processors/inventory.processor';
import { ShippingProcessor } from './processors/shipping.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
          db: configService.get('redis.db'),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: 'orders' },
      { name: 'inventory' },
      { name: 'shipping' },
    ),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    OrdersProcessor,
    InventoryProcessor,
    ShippingProcessor,
  ],
  exports: [JobsService],
})
export class JobsModule {}