import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { businessSchemas } from "../schemas";
import { DevicesController } from "./devices.controller";
import { DevicesService } from "./devices.service";

@Module({
  imports: [MongooseModule.forFeature([...businessSchemas])],
  controllers: [DevicesController],
  providers: [DevicesService]
})
export class DevicesModule {}
