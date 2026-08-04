import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { IsNumber, IsOptional, IsString } from "class-validator";
import { CustomersService } from "./customers.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard } from "../../common/roles.guard";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";

class CreateCustomerDto {
  @IsString() businessId!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumber() balance?: number;
}

class RecordPaymentDto {
  @IsNumber() amount!: number;
  @IsString() method!: "cash" | "mpesa" | "bank" | "credit";
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
}

@Controller("customers")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @Roles("owner", "manager", "cashier")
  list(@CurrentUser() user: { businessId: string }) {
    return this.customers.list(user.businessId);
  }

  @Post()
  @Roles("owner", "manager", "cashier")
  create(@CurrentUser() user: { businessId: string }, @Body() dto: CreateCustomerDto) {
    return this.customers.create({ ...dto, businessId: user.businessId });
  }

  @Get(":id/payments")
  @Roles("owner", "manager", "cashier")
  payments(@CurrentUser() user: { businessId: string }, @Param("id") id: string) {
    return this.customers.payments(user.businessId, id);
  }

  @Post(":id/payments")
  @Roles("owner", "manager", "cashier")
  recordPayment(@CurrentUser() user: { businessId: string; sub: string }, @Param("id") id: string, @Body() dto: RecordPaymentDto) {
    return this.customers.recordPayment({
      businessId: user.businessId,
      customerId: id,
      amount: dto.amount,
      method: dto.method,
      reference: dto.reference ?? null,
      note: dto.note ?? null,
      recordedById: user.sub
    });
  }
}
