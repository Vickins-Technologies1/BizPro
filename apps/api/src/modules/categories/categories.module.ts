import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { catalogSchemas } from "../schemas";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";

@Module({
  imports: [MongooseModule.forFeature([...catalogSchemas])],
  controllers: [CategoriesController],
  providers: [CategoriesService]
})
export class CategoriesModule {}
