import { Module } from '@nestjs/common';
import { ShopifyService } from './shopify.service';
import { ShopifyIntegrationService } from '../../../integrations/shopify/shopify-integration.service';
import { ShopifyClient } from '../../../integrations/shopify/shopify-client';
import { ShopifyWebhookController } from '../../../integrations/shopify/shopify-webhook.controller';
import { ShopifySyncScheduler } from '../../../integrations/shopify/shopify-sync.scheduler';
import { DatabaseModule } from '../../../common/database/database.module';
import { IntegrationLoggingService } from '../../../services/integration-logging.service';
import { OrdersModule } from '../../orders/orders.module';

@Module({
  imports: [DatabaseModule, OrdersModule],
  controllers: [ShopifyWebhookController],
  providers: [
    ShopifyService,
    ShopifyIntegrationService,
    ShopifyClient,
    ShopifySyncScheduler,
    IntegrationLoggingService,
  ],
  exports: [
    ShopifyService,
    ShopifyIntegrationService,
    ShopifyClient,
  ],
})
export class ShopifyModule {}
