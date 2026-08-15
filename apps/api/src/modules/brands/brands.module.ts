import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { catalogSchemas } from "../schemas";
import { BrandsController } from "./brands.controller";
import { BrandsService } from "./brands.service";

@Module({
  imports: [MongooseModule.forFeature([...catalogSchemas])],
  controllers: [BrandsController],
  providers: [BrandsService]
})
export class BrandsModule {}
