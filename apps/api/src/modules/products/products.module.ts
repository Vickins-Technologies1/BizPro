import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { catalogSchemas, financeSchemas } from "../schemas";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [MongooseModule.forFeature([...catalogSchemas, ...financeSchemas])],
  controllers: [ProductsController],
  providers: [ProductsService]
})
export class ProductsModule {}
