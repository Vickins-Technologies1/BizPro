import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { SalesService } from "./sales.service";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "@vbo/shared";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard } from "../../common/roles.guard";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";

class SaleItemDto {
  @IsString() productId!: string;
  @IsString() productName!: string;
  @IsNumber() quantity!: number;
  @IsNumber() unitPrice!: number;
  @IsNumber() costPrice!: number;
  @IsNumber() lineDiscount!: number;
  @IsNumber() lineTotal!: number;
}

class CreateSaleDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() cashierId?: string;
  @IsString() receiptNumber!: string;
  @IsNumber() subtotal!: number;
  @IsNumber() discountTotal!: number;
  @IsNumber() taxTotal!: number;
  @IsNumber() grandTotal!: number;
  @IsNumber() amountPaid!: number;
  @IsNumber() balanceDue!: number;
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
  list(@CurrentUser() user: { businessId: string }) {
    return this.sales.list(user.businessId);
  }

  @Post()
  @Roles("owner", "manager", "cashier")
  create(@CurrentUser() user: { businessId: string; sub: string }, @Body() dto: CreateSaleDto) {
    return this.sales.create({ ...dto, businessId: user.businessId, cashierId: user.sub });
  }
}
