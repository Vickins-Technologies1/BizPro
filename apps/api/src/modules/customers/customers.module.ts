import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { catalogSchemas, financeSchemas } from "../schemas";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  imports: [MongooseModule.forFeature([...catalogSchemas, ...financeSchemas])],
  controllers: [CustomersController],
  providers: [CustomersService]
})
export class CustomersModule {}
