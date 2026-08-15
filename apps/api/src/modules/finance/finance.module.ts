import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { financeSchemas } from "../schemas";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";

@Module({
  imports: [MongooseModule.forFeature([...financeSchemas])],
  controllers: [FinanceController],
  providers: [FinanceService]
})
export class FinanceModule {}
