import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { catalogSchemas, financeSchemas, opsSchemas, syncSchemas } from "../schemas";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";

@Module({
  imports: [MongooseModule.forFeature([...syncSchemas, ...catalogSchemas, ...financeSchemas, ...opsSchemas])],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService]
})
export class SyncModule {}
