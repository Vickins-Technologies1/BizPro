import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { financeSchemas, opsSchemas } from "../schemas";
import { SyncModule } from "../sync/sync.module";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";

@Module({
  imports: [MongooseModule.forFeature([...financeSchemas, ...opsSchemas]), SyncModule],
  controllers: [WebhooksController],
  providers: [WebhooksService]
})
export class WebhooksModule {}
