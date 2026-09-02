import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { BusinessOperationsService } from "./business-operations.service";

class OperationItemDto {
  @IsOptional() @IsString() productId?: string | null;
  @IsString() name!: string;
  @IsNumber() quantity!: number;
  @IsNumber() unitPrice!: number;
}

type BusinessOperationStatus = "draft" | "open" | "preparing" | "ready" | "confirmed" | "in_progress" | "completed" | "cancelled";

class CreateOperationDto {
  @IsOptional() @IsString() externalId?: string;
  @IsOptional() @IsString() branchId?: string | null;
  @IsIn(["order", "appointment", "work_order"]) kind!: "order" | "appointment" | "work_order";
  @IsString() title!: string;
  @IsOptional() @IsString() customerId?: string | null;
  @IsOptional() @IsString() staffId?: string | null;
  @IsOptional() @IsDateString() scheduledAt?: string | null;
  @IsOptional() @IsNumber() durationMinutes?: number | null;
  @IsOptional() @IsString() tableName?: string | null;
  @IsOptional() @IsString() vehiclePlate?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsIn(["draft", "open", "preparing", "ready", "confirmed", "in_progress", "completed", "cancelled"]) status?: BusinessOperationStatus;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OperationItemDto) items?: OperationItemDto[];
  @IsOptional() @IsNumber() total?: number;
}

class UpdateOperationDto {
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsIn(["order", "appointment", "work_order"]) kind?: "order" | "appointment" | "work_order";
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() customerId?: string | null;
  @IsOptional() @IsString() staffId?: string | null;
  @IsOptional() @IsDateString() scheduledAt?: string | null;
  @IsOptional() @IsNumber() durationMinutes?: number | null;
  @IsOptional() @IsString() tableName?: string | null;
  @IsOptional() @IsString() vehiclePlate?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsIn(["draft", "open", "preparing", "ready", "confirmed", "in_progress", "completed", "cancelled"]) status?: BusinessOperationStatus;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OperationItemDto) items?: OperationItemDto[];
  @IsOptional() @IsNumber() total?: number;
}

@Controller("business-operations")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BusinessOperationsController {
  constructor(private readonly operations: BusinessOperationsService) {}

  @Get()
  @Roles("owner", "manager", "cashier", "waiter", "receptionist", "stylist", "mechanic")
  list(@CurrentUser() user: { businessId: string }, @Query("kind") kind?: string, @Query("status") status?: string) {
    return this.operations.list(user.businessId, kind, status);
  }

  @Post()
  @Roles("owner", "manager", "cashier", "waiter", "receptionist", "stylist", "mechanic")
  create(@CurrentUser() user: { businessId: string }, @Body() dto: CreateOperationDto) {
    const { scheduledAt, ...rest } = dto;
    return this.operations.create({ ...rest, businessId: user.businessId, scheduledAt: scheduledAt ? new Date(scheduledAt) : null });
  }

  @Patch(":id")
  @Roles("owner", "manager", "cashier", "waiter", "receptionist", "stylist", "mechanic")
  update(@CurrentUser() user: { businessId: string }, @Param("id") id: string, @Body() dto: UpdateOperationDto) {
    const { scheduledAt, ...rest } = dto;
    return this.operations.update(user.businessId, id, { ...rest, ...(scheduledAt === undefined ? {} : { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }) });
  }

  @Post(":id/archive")
  @Roles("owner", "manager")
  archive(@CurrentUser() user: { businessId: string }, @Param("id") id: string) {
    return this.operations.archive(user.businessId, id);
  }
}
