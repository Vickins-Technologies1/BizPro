import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { catalogSchemas, financeSchemas, invoiceSchemas } from "../schemas";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [MongooseModule.forFeature([...catalogSchemas, ...financeSchemas, ...invoiceSchemas])],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
