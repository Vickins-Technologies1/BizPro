import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { businessSchemas, opsSchemas } from "../schemas";
import { EmployeesController } from "./employees.controller";
import { SupportEmployeesController } from "./support-employees.controller";
import { EmployeesService } from "./employees.service";
import { PermissionsGuard } from "../../common/permissions.guard";

@Module({
  imports: [MongooseModule.forFeature([...businessSchemas, ...opsSchemas])],
  controllers: [EmployeesController, SupportEmployeesController],
  providers: [EmployeesService, PermissionsGuard]
})
export class EmployeesModule {}
