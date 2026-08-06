import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { allSchemas } from "../schemas";
import { EmployeesController } from "./employees.controller";
import { SupportEmployeesController } from "./support-employees.controller";
import { EmployeesService } from "./employees.service";
import { PermissionsGuard } from "../../common/permissions.guard";

@Module({
  imports: [MongooseModule.forFeature([...allSchemas])],
  controllers: [EmployeesController, SupportEmployeesController],
  providers: [EmployeesService, PermissionsGuard]
})
export class EmployeesModule {}
