import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsDate, IsNumber, IsOptional, IsString } from "class-validator";
import { ExpensesService } from "./expenses.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard } from "../../common/roles.guard";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";

class CreateExpenseDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsNumber() amount!: number;
  @IsString() note!: string;
  @Type(() => Date) @IsDate() expenseDate!: Date;
  @IsOptional() @IsString() recordedById?: string;
}

@Controller("expenses")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @Roles("owner", "manager")
  list(@CurrentUser() user: { businessId: string }) {
    return this.expenses.list(user.businessId);
  }

  @Post()
  @Roles("owner", "manager")
  create(@CurrentUser() user: { businessId: string; sub: string }, @Body() dto: CreateExpenseDto) {
    return this.expenses.create({ ...dto, businessId: user.businessId, recordedById: user.sub });
  }
}
