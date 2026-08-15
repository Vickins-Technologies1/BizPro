import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { BrandsService } from "./brands.service";

class CreateBrandDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() externalId?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateBrandDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Controller("brands")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @Roles("owner", "manager", "cashier")
  list(@CurrentUser() user: { businessId: string }) {
    return this.brands.list(user.businessId);
  }

  @Post()
  @Roles("owner", "manager")
  create(@CurrentUser() user: { businessId: string }, @Body() dto: CreateBrandDto) {
    return this.brands.create({ ...dto, businessId: user.businessId });
  }

  @Patch(":id")
  @Roles("owner", "manager")
  update(@CurrentUser() user: { businessId: string }, @Param("id") id: string, @Body() dto: UpdateBrandDto) {
    return this.brands.update(user.businessId, id, dto);
  }

  @Post(":id/archive")
  @Roles("owner", "manager")
  archive(@CurrentUser() user: { businessId: string }, @Param("id") id: string) {
    return this.brands.archive(user.businessId, id);
  }
}
