import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { businessSchemas, catalogSchemas, financeSchemas } from "../schemas";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  imports: [MongooseModule.forFeature([...businessSchemas, ...catalogSchemas, ...financeSchemas])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService]
})
export class AnalyticsModule {}
