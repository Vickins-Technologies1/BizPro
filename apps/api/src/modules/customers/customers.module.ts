import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { allSchemas } from "../schemas";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  imports: [MongooseModule.forFeature([...allSchemas])],
  controllers: [CustomersController],
  providers: [CustomersService]
})
export class CustomersModule {}
