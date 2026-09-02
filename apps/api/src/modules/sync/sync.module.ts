import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { businessOperationSchemas, catalogSchemas, financeSchemas, opsSchemas, syncSchemas } from "../schemas";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";

@Module({
  imports: [MongooseModule.forFeature([...syncSchemas, ...catalogSchemas, ...financeSchemas, ...opsSchemas, ...businessOperationSchemas])],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService]
})
export class SyncModule {}
