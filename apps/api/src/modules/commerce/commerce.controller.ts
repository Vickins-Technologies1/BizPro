import { Body, Controller, Delete, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { CommerceApiGuard, CommerceScopeGuard } from "../../common/commerce-api.guard";
import { CommerceAuth, CommerceScopes, type CommercePrincipal } from "../../common/commerce-auth.decorator";
import { CommerceCatalogService, type ProductQuery } from "./catalog.service";
import { CommerceInventoryService } from "./inventory.service";
import { CommerceOrdersService } from "./orders.service";

class ProductQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() vendorId?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsIn(["in_stock", "out_of_stock"]) availability?: "in_stock" | "out_of_stock";
  @IsOptional() @Type(() => Number) @IsNumber() minPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maxPrice?: number;
}

class ReservationDto {
  @IsString() productId!: string;
  @IsString() branchId!: string;
  @IsNumber() @Min(0.000001) quantity!: number;
  @IsString() referenceType!: string;
  @IsString() referenceId!: string;
  @IsOptional() @IsString() expiresAt?: string;
}

class OrderItemDto {
  @IsString() productId!: string;
  @IsNumber() @Min(0.000001) quantity!: number;
  @IsOptional() @IsString() vendorId?: string;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsNumber() @Min(0) tax?: number;
}

class CreateOrderDto {
  @IsString() branchId!: string;
  @IsOptional() @IsString() externalReference?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsIn(["INTERNAL", "EXTERNAL_API", "MARKETPLACE"]) source?: "INTERNAL" | "EXTERNAL_API" | "MARKETPLACE";
  @Type(() => OrderItemDto) @ValidateNested({ each: true }) @IsArray() items!: OrderItemDto[];
}

@Controller("v1/commerce")
@UseGuards(CommerceApiGuard, CommerceScopeGuard)
export class CommerceController {
  constructor(private readonly catalog: CommerceCatalogService, private readonly inventory: CommerceInventoryService, private readonly orders: CommerceOrdersService) {}

  @Get("products")
  @CommerceScopes("products:read")
  products(@CommerceAuth() principal: CommercePrincipal, @Query() query: ProductQueryDto) { return this.catalog.products(principal, query as ProductQuery); }

  @Get("products/:id")
  @CommerceScopes("products:read")
  product(@CommerceAuth() principal: CommercePrincipal, @Param("id") id: string, @Query("branchId") branchId?: string) { return this.catalog.product(principal, id, branchId); }

  @Get("categories")
  @CommerceScopes("products:read")
  categories(@CommerceAuth() principal: CommercePrincipal, @Query("page") page?: string, @Query("limit") limit?: string) { return this.catalog.categories(principal, numberOrUndefined(page), numberOrUndefined(limit)); }

  @Get("inventory")
  @CommerceScopes("inventory:read")
  inventoryAvailability(@CommerceAuth() principal: CommercePrincipal, @Query("productId") productId?: string, @Query("branchId") branchId?: string, @Query("page") page?: string, @Query("limit") limit?: string) {
    return this.inventory.availability(principal, { ...(productId ? { productId } : {}), ...(branchId ? { branchId } : {}), page: numberOrUndefined(page) ?? 1, limit: Math.min(numberOrUndefined(limit) ?? 50, 100) });
  }

  @Get("vendors")
  @CommerceScopes("vendors:read")
  vendors(@CommerceAuth() principal: CommercePrincipal, @Query("page") page?: string, @Query("limit") limit?: string) { return this.catalog.vendors(principal, numberOrUndefined(page), numberOrUndefined(limit)); }

  @Post("inventory/reservations")
  @CommerceScopes("inventory:reserve")
  reserve(@CommerceAuth() principal: CommercePrincipal, @Body() dto: ReservationDto, @Headers("idempotency-key") idempotencyKey?: string) {
    const { expiresAt, ...reservation } = dto;
    return this.inventory.reserve(principal, { ...reservation, ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}) }, idempotencyKey);
  }

  @Delete("inventory/reservations/:id")
  @CommerceScopes("inventory:reserve")
  release(@CommerceAuth() principal: CommercePrincipal, @Param("id") id: string) { return this.inventory.release(principal, id); }

  @Post("orders")
  @CommerceScopes("orders:write")
  order(@CommerceAuth() principal: CommercePrincipal, @Body() dto: CreateOrderDto, @Headers("idempotency-key") idempotencyKey?: string) { return this.orders.create(principal, dto, idempotencyKey); }

  @Get("orders/:id")
  @CommerceScopes("orders:read")
  getOrder(@CommerceAuth() principal: CommercePrincipal, @Param("id") id: string) { return this.orders.get(principal, id); }
}

function numberOrUndefined(value?: string) {
  if (value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
