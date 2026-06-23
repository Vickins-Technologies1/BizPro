import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { allSchemas } from "../schemas";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [MongooseModule.forFeature([...allSchemas])],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
