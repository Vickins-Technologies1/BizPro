import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { allSchemas } from "../schemas";
import { DevicesController } from "./devices.controller";
import { DevicesService } from "./devices.service";

@Module({
  imports: [MongooseModule.forFeature([...allSchemas])],
  controllers: [DevicesController],
  providers: [DevicesService]
})
export class DevicesModule {}
