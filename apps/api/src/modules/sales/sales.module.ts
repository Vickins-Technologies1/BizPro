import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { allSchemas } from "../schemas";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";
import { ProductsService } from "../products/products.service";
import { CustomersService } from "../customers/customers.service";

@Module({
  imports: [MongooseModule.forFeature([...allSchemas])],
  controllers: [SalesController],
  providers: [SalesService, ProductsService, CustomersService],
  exports: [SalesService]
})
export class SalesModule {}
