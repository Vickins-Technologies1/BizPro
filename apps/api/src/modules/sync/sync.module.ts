import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { allSchemas } from "../schemas";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";

@Module({
  imports: [MongooseModule.forFeature([...allSchemas])],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService]
})
export class SyncModule {}
