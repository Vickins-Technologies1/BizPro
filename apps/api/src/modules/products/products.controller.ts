import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";
import { ProductsService } from "./products.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard } from "../../common/roles.guard";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";

class CreateProductDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() externalId?: string;
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsString() batchNumber?: string;
  @IsOptional() @IsString() expiryDate?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsString() unit!: string;
  @IsNumber() buyingPrice!: number;
  @IsNumber() sellingPrice!: number;
  @IsOptional() @IsNumber() stockOnHand?: number;
  @IsOptional() @IsNumber() lowStockThreshold?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class AdjustStockDto {
  @IsNumber() quantityDelta!: number;
  @IsNumber() unitCost!: number;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() referenceType?: string;
  @IsOptional() @IsString() referenceId?: string;
}

function normalizeProductCreatePayload(input: CreateProductDto & { businessId: string }) {
  const { expiryDate, ...rest } = input;
  return {
    ...rest,
    ...(expiryDate ? { expiryDate: new Date(expiryDate) } : expiryDate === null ? { expiryDate: null } : {})
  };
}

function normalizeProductPatchPayload(input: Partial<CreateProductDto> & { businessId: string }) {
  const { expiryDate, ...rest } = input;
  return {
    ...rest,
    ...(expiryDate === undefined ? {} : expiryDate ? { expiryDate: new Date(expiryDate) } : { expiryDate: null })
  };
}

@Controller("products")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @Roles("owner", "manager", "cashier")
  list(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Query("branchId") branchId?: string) {
    return this.products.list(user.businessId, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post()
  @Roles("owner", "manager")
  create(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Body() dto: CreateProductDto) {
    return this.products.create(
      normalizeProductCreatePayload({ ...dto, businessId: user.businessId, branchId: dto.branchId ?? user.branchId ?? null }),
      { role: user.role ?? null, branchId: user.branchId ?? null }
    );
  }

  @Patch(":id")
  @Roles("owner", "manager")
  update(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string, @Body() body: Partial<CreateProductDto>) {
    const { businessId, branchId: patchBranchId, ...patch } = body as Partial<CreateProductDto> & { businessId?: string };
    return this.products.update(
      user.businessId,
      id,
      normalizeProductPatchPayload({
        ...(patch as Partial<CreateProductDto>),
        businessId: user.businessId,
        ...(patchBranchId !== undefined ? { branchId: patchBranchId } : {})
      }),
      { role: user.role ?? null, branchId: user.branchId ?? null }
    );
  }

  @Post(":id/archive")
  @Roles("owner", "manager")
  archive(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string, @Query("branchId") branchId?: string) {
    return this.products.archive(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post(":id/adjust-stock")
  @Roles("owner", "manager")
  adjustStock(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string, @Body() dto: AdjustStockDto, @Query("branchId") branchId?: string) {
    return this.products.adjustStock({
      businessId: user.businessId,
      productId: id,
      branchId: branchId ?? user.branchId ?? null,
      referenceType: (dto.referenceType as "sale" | "purchase" | "adjustment" | "restock" | "refund") ?? "adjustment",
      referenceId: dto.referenceId ?? `${id}-${Date.now()}`,
      quantityDelta: dto.quantityDelta,
      unitCost: dto.unitCost,
      ...(dto.note !== undefined ? { note: dto.note } : {})
    }, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Get(":id/history")
  @Roles("owner", "manager", "cashier")
  history(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string, @Query("branchId") branchId?: string) {
    return this.products.history(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }
}
