import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { SupportKeyGuard } from "../../common/support-key.guard";
import { EmployeesService } from "./employees.service";
import { CreateEmployeeDto, ResetEmployeeCredentialsDto, UpdateEmployeeDto } from "./employees.dto";

class SuspendEmployeeDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller("support/employees")
@UseGuards(SupportKeyGuard)
export class SupportEmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@Query("businessId") businessId: string) {
    if (!businessId?.trim()) {
      throw new BadRequestException("businessId is required");
    }
    return this.employees.list(businessId.trim());
  }

  @Get("catalog")
  catalog() {
    return this.employees.catalog();
  }

  @Post()
  create(@Body() dto: CreateEmployeeDto, @Query("businessId") businessId: string) {
    if (!businessId?.trim()) {
      throw new BadRequestException("businessId is required");
    }

    return this.employees.create(
      { sub: "support-console", businessId: businessId.trim(), role: "owner" },
      {
        ...dto,
        businessId: businessId.trim()
      }
    );
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateEmployeeDto, @Query("businessId") businessId: string) {
    if (!businessId?.trim()) {
      throw new BadRequestException("businessId is required");
    }
    return this.employees.update({ sub: "support-console", businessId: businessId.trim(), role: "owner" }, id, dto);
  }

  @Post(":id/suspend")
  suspend(@Param("id") id: string, @Body() dto: SuspendEmployeeDto, @Query("businessId") businessId: string) {
    if (!businessId?.trim()) {
      throw new BadRequestException("businessId is required");
    }
    return this.employees.suspend({ sub: "support-console", businessId: businessId.trim(), role: "owner" }, id, dto.reason ?? null);
  }

  @Post(":id/restore")
  restore(@Param("id") id: string, @Query("businessId") businessId: string) {
    if (!businessId?.trim()) {
      throw new BadRequestException("businessId is required");
    }
    return this.employees.restore({ sub: "support-console", businessId: businessId.trim(), role: "owner" }, id);
  }

  @Post(":id/reset-credentials")
  resetCredentials(@Param("id") id: string, @Body() dto: ResetEmployeeCredentialsDto, @Query("businessId") businessId: string) {
    if (!businessId?.trim()) {
      throw new BadRequestException("businessId is required");
    }
    return this.employees.resetCredentials({ sub: "support-console", businessId: businessId.trim(), role: "owner" }, id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Query("businessId") businessId: string) {
    if (!businessId?.trim()) {
      throw new BadRequestException("businessId is required");
    }
    return this.employees.remove({ sub: "support-console", businessId: businessId.trim(), role: "owner" }, id);
  }
}
