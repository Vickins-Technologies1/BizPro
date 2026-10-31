import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
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

class SalePaymentLineDto {
  @IsIn(PAYMENT_METHODS) method!: any;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
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
  @IsOptional() @Type(() => SalePaymentLineDto) @ValidateNested({ each: true }) @IsArray() paymentLines?: SalePaymentLineDto[];
  @IsOptional() @IsString() notes?: string;
  @Type(() => SaleItemDto)
  @ValidateNested({ each: true })
  @IsArray()
  items!: SaleItemDto[];
}

class RecordSalePaymentDto {
  @IsString() externalId!: string;
  @IsIn(PAYMENT_METHODS) method!: any;
  @IsNumber() @Min(Number.EPSILON) amount!: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
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

  @Post(":id/payments")
  @Roles("owner", "manager", "cashier")
  recordPayment(@CurrentUser() user: { businessId: string; sub: string; role?: string; branchId?: string | null }, @Param("id") id: string, @Body() dto: RecordSalePaymentDto, @Query("branchId") branchId?: string) {
    return this.sales.recordPayment({
      businessId: user.businessId,
      saleId: id,
      externalId: dto.externalId,
      amount: dto.amount,
      method: dto.method,
      reference: dto.reference ?? null,
      note: dto.note ?? null,
      recordedById: user.sub
    }, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }
}
