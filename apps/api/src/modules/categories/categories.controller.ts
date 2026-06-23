import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { CategoriesService } from "./categories.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard } from "../../common/roles.guard";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";

class CreateCategoryDto {
  @IsString() businessId!: string;
  @IsString() name!: string;
  @IsString() @IsOptional() color?: string;
}

@Controller("categories")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @Roles("owner", "manager", "cashier")
  list(@CurrentUser() user: { businessId: string }) {
    return this.categories.list(user.businessId);
  }

  @Post()
  @Roles("owner", "manager")
  create(@CurrentUser() user: { businessId: string }, @Body() dto: CreateCategoryDto) {
    return this.categories.create({ ...dto, businessId: user.businessId });
  }
}
