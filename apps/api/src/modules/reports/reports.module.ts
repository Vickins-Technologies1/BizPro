import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { catalogSchemas, financeSchemas } from "../schemas";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [MongooseModule.forFeature([...catalogSchemas, ...financeSchemas])],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
