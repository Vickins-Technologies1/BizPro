import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { SalesService } from "./sales.service";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "@vbo/shared";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard } from "../../common/roles.guard";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";

class SaleItemDto {
  @IsString() productId!: string;
  @IsNumber() @Min(Number.EPSILON) quantity!: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsNumber() @Min(0) tax?: number;
}

class CreateSaleDto {
  @IsOptional() @IsString() externalId?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() cashierId?: string;
  @IsString() receiptNumber!: string;
  @IsNumber() amountPaid!: number;
  @IsIn(PAYMENT_STATUSES) paymentStatus!: any;
  @IsIn(PAYMENT_METHODS) paymentMethod!: any;
  @IsOptional() @IsString() notes?: string;
  @Type(() => SaleItemDto)
  @ValidateNested({ each: true })
  @IsArray()
  items!: SaleItemDto[];
}

@Controller("sales")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  @Roles("owner", "manager", "cashier")
  list(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Query("branchId") branchId?: string) {
    return this.sales.list(user.businessId, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post()
  @Roles("owner", "manager", "cashier")
  create(@CurrentUser() user: { businessId: string; sub: string; role?: string; branchId?: string | null }, @Body() dto: CreateSaleDto) {
    return this.sales.create({ ...dto, businessId: user.businessId, branchId: dto.branchId ?? user.branchId ?? null, cashierId: user.sub }, { role: user.role ?? null, branchId: user.branchId ?? null });
  }
}
