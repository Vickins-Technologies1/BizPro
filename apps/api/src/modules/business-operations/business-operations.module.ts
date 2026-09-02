import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BusinessOperation, BusinessOperationSchema } from "../business-operations.schemas";
import { BusinessOperationsController } from "./business-operations.controller";
import { BusinessOperationsService } from "./business-operations.service";

@Module({
  imports: [MongooseModule.forFeature([{ name: BusinessOperation.name, schema: BusinessOperationSchema }])],
  controllers: [BusinessOperationsController],
  providers: [BusinessOperationsService]
})
export class BusinessOperationsModule {}
