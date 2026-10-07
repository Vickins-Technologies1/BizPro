import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { catalogSchemas, financeSchemas, invoiceSchemas, opsSchemas } from "../schemas";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  imports: [MongooseModule.forFeature([...catalogSchemas, ...financeSchemas, ...invoiceSchemas, ...opsSchemas])],
  controllers: [CustomersController],
  providers: [CustomersService]
})
export class CustomersModule {}
