import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { catalogSchemas } from "../schemas";
import { StockTransfersController } from "./stock-transfers.controller";
import { StockTransfersService } from "./stock-transfers.service";

@Module({
  imports: [MongooseModule.forFeature([...catalogSchemas])],
  controllers: [StockTransfersController],
  providers: [StockTransfersService]
})
export class StockTransfersModule {}
