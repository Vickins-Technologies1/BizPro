import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { Permissions } from "../../common/permissions.decorator";
import { PermissionsGuard } from "../../common/permissions.guard";
import { EmployeesService } from "./employees.service";
import { CreateEmployeeDto, ResetEmployeeCredentialsDto, UpdateEmployeeDto } from "./employees.dto";

class SuspendEmployeeDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller("employees")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions("manageEmployees")
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@CurrentUser() user: { businessId: string }) {
    return this.employees.list(user.businessId);
  }

  @Get("audit")
  audit(@CurrentUser() user: { businessId: string }) {
    return this.employees.listAuditLogs(user.businessId);
  }

  @Get("catalog")
  catalog() {
    return this.employees.catalog();
  }

  @Post()
  create(@CurrentUser() user: { sub: string; businessId: string; role?: string }, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(user, {
      ...dto,
      businessId: user.businessId
    });
  }

  @Patch(":id")
  update(@CurrentUser() user: { sub: string; businessId: string; role?: string }, @Param("id") id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(user, id, dto);
  }

  @Post(":id/suspend")
  suspend(@CurrentUser() user: { sub: string; businessId: string; role?: string }, @Param("id") id: string, @Body() dto: SuspendEmployeeDto) {
    return this.employees.suspend(user, id, dto.reason ?? null);
  }

  @Post(":id/restore")
  restore(@CurrentUser() user: { sub: string; businessId: string; role?: string }, @Param("id") id: string) {
    return this.employees.restore(user, id);
  }

  @Post(":id/reset-credentials")
  resetCredentials(@CurrentUser() user: { sub: string; businessId: string; role?: string }, @Param("id") id: string, @Body() dto: ResetEmployeeCredentialsDto) {
    return this.employees.resetCredentials(user, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: { sub: string; businessId: string; role?: string }, @Param("id") id: string) {
    return this.employees.remove(user, id);
  }
}
