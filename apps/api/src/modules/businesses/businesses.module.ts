import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { allSchemas } from "../schemas";
import { BusinessesController } from "./businesses.controller";
import { BusinessesService } from "./businesses.service";

@Module({
  imports: [MongooseModule.forFeature([...allSchemas])],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService]
})
export class BusinessesModule {}
