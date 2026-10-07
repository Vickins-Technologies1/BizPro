import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { commerceSchemas, catalogSchemas, businessSchemas, opsSchemas } from "../schemas";
import { CommerceApiGuard, CommerceRateLimiter, CommerceScopeGuard } from "../../common/commerce-api.guard";
import { CommerceController } from "./commerce.controller";
import { CommerceCatalogService } from "./catalog.service";
import { CommerceCredentialsController } from "./credentials.controller";
import { CommerceCredentialsService } from "./credentials.service";
import { CommerceIdempotencyService } from "./idempotency.service";
import { CommerceInventoryService } from "./inventory.service";
import { CommerceOrdersService } from "./orders.service";
import { CommerceVendorsController } from "./vendors.controller";
import { CommerceVendorsService } from "./vendors.service";
import { CommerceWebhooksController } from "./webhooks.controller";
import { CommerceWebhooksService } from "./webhooks.service";

@Module({
  imports: [MongooseModule.forFeature([...commerceSchemas, ...catalogSchemas, ...businessSchemas, ...opsSchemas])],
  controllers: [CommerceController, CommerceCredentialsController, CommerceVendorsController, CommerceWebhooksController],
  providers: [
    CommerceApiGuard,
    CommerceScopeGuard,
    CommerceRateLimiter,
    CommerceCatalogService,
    CommerceCredentialsService,
    CommerceIdempotencyService,
    CommerceInventoryService,
    CommerceOrdersService,
    CommerceVendorsService,
    CommerceWebhooksService
  ],
  exports: [CommerceWebhooksService, CommerceInventoryService]
})
export class CommerceModule {}
