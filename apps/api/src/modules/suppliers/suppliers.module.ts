import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { catalogSchemas, supplierSchemas } from "../schemas";
import { SuppliersController } from "./suppliers.controller";
import { SuppliersService } from "./suppliers.service";

@Module({
  imports: [MongooseModule.forFeature([...catalogSchemas, ...supplierSchemas])],
  controllers: [SuppliersController],
  providers: [SuppliersService]
})
export class SuppliersModule {}
