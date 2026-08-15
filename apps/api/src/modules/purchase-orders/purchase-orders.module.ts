import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { catalogSchemas } from "../schemas";
import { PurchaseOrdersController } from "./purchase-orders.controller";
import { PurchaseOrdersService } from "./purchase-orders.service";

@Module({
  imports: [MongooseModule.forFeature([...catalogSchemas])],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService]
})
export class PurchaseOrdersModule {}
