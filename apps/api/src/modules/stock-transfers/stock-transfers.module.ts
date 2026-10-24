import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Branch, BranchSchema, catalogSchemas, financeSchemas } from "../schemas";
import { StockTransfersController } from "./stock-transfers.controller";
import { StockTransfersService } from "./stock-transfers.service";

@Module({
  imports: [MongooseModule.forFeature([...catalogSchemas, ...financeSchemas, { name: Branch.name, schema: BranchSchema }])],
  controllers: [StockTransfersController],
  providers: [StockTransfersService]
})
export class StockTransfersModule {}
