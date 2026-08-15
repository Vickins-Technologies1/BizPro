import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { financeSchemas } from "../schemas";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";

@Module({
  imports: [MongooseModule.forFeature([...financeSchemas])],
  controllers: [ExpensesController],
  providers: [ExpensesService]
})
export class ExpensesModule {}
