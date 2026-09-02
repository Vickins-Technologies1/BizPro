import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { financeSchemas, invoiceSchemas } from "../schemas";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";

@Module({
  imports: [MongooseModule.forFeature([...financeSchemas, ...invoiceSchemas])],
  controllers: [FinanceController],
  providers: [FinanceService]
})
export class FinanceModule {}
