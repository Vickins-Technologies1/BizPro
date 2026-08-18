import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { catalogSchemas, financeSchemas } from "../schemas";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [MongooseModule.forFeature([...catalogSchemas, ...financeSchemas]), NotificationsModule],
  controllers: [ProductsController],
  providers: [ProductsService]
})
export class ProductsModule {}
