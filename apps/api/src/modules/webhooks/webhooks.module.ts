import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { allSchemas } from "../schemas";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { SyncService } from "../sync/sync.service";

@Module({
  imports: [MongooseModule.forFeature([...allSchemas])],
  controllers: [WebhooksController],
  providers: [WebhooksService, SyncService]
})
export class WebhooksModule {}
