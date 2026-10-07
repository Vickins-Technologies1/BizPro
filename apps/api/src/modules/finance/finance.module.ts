import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { financeSchemas, invoiceSchemas, opsSchemas } from "../schemas";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";

@Module({
  imports: [MongooseModule.forFeature([...financeSchemas, ...invoiceSchemas, ...opsSchemas])],
  controllers: [FinanceController],
  providers: [FinanceService]
})
export class FinanceModule {}
