import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { allSchemas } from "../schemas";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

@Module({
  imports: [MongooseModule.forFeature([...allSchemas])],
  controllers: [AuditController],
  providers: [AuditService]
})
export class AuditModule {}
