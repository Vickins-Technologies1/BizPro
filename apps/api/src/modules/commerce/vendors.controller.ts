import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsIn, IsNumber, IsObject, IsOptional, IsString, Min } from "class-validator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { CurrentUser } from "../../common/current-user.decorator";
import { CommerceVendorsService } from "./vendors.service";

class VendorDto {
  @IsString() name!: string;
  @IsOptional() @IsString() businessName?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() contactPerson?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsIn(["ACTIVE", "INACTIVE", "SUSPENDED"]) status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  @IsOptional() @IsString() notes?: string;
}

class VendorProductDto {
  @IsString() productId!: string;
  @IsNumber() @Min(0) vendorCost!: number;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() vendorSku?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() @Min(1) minimumOrderQuantity?: number;
  @IsOptional() @IsNumber() @Min(0) leadTimeDays?: number;
  @IsOptional() @IsIn(["available", "unavailable", "backorder", "discontinued"]) availability?: "available" | "unavailable" | "backorder" | "discontinued";
  @IsOptional() @IsIn(["active", "inactive"]) status?: "active" | "inactive";
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

@Controller("commerce/vendors")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommerceVendorsController {
  constructor(private readonly vendors: CommerceVendorsService) {}

  @Get()
  @Roles("owner", "manager")
  list(@CurrentUser() user: { businessId: string }) {
    return this.vendors.list(user.businessId);
  }

  @Post()
  @Roles("owner", "manager")
  create(@CurrentUser() user: { businessId: string }, @Body() dto: VendorDto) {
    return this.vendors.create({ ...dto, businessId: user.businessId });
  }

  @Patch(":id")
  @Roles("owner", "manager")
  update(@CurrentUser() user: { businessId: string }, @Param("id") id: string, @Body() dto: Partial<VendorDto>) {
    return this.vendors.update(user.businessId, id, dto);
  }

  @Post(":id/disable")
  @Roles("owner", "manager")
  disable(@CurrentUser() user: { businessId: string }, @Param("id") id: string) {
    return this.vendors.disable(user.businessId, id);
  }

  @Get(":vendorId/products")
  @Roles("owner", "manager")
  links(@CurrentUser() user: { businessId: string }, @Param("vendorId") vendorId: string, @Query("productId") productId?: string) {
    return this.vendors.listProductLinks(user.businessId, vendorId, productId);
  }

  @Post(":vendorId/products")
  @Roles("owner", "manager")
  attach(@CurrentUser() user: { businessId: string }, @Param("vendorId") vendorId: string, @Body() dto: VendorProductDto) {
    return this.vendors.attachProduct({ ...dto, businessId: user.businessId, vendorId, metadata: dto.metadata ?? {} });
  }

  @Delete(":vendorId/products/:id")
  @Roles("owner", "manager")
  detach(@CurrentUser() user: { businessId: string }, @Param("id") id: string) {
    return this.vendors.detachProduct(user.businessId, id);
  }
}
