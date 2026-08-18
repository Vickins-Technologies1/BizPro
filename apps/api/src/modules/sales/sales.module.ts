import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { catalogSchemas, financeSchemas } from "../schemas";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";
import { ProductsService } from "../products/products.service";
import { CustomersService } from "../customers/customers.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [MongooseModule.forFeature([...catalogSchemas, ...financeSchemas]), NotificationsModule],
  controllers: [SalesController],
  providers: [SalesService, ProductsService, CustomersService],
  exports: [SalesService]
})
export class SalesModule {}
