import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";
import { ProductsService } from "./products.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard } from "../../common/roles.guard";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";

class CreateProductDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() barcode?: string;
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
}

@Controller("products")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @Roles("owner", "manager", "cashier")
  list(@CurrentUser() user: { businessId: string }) {
    return this.products.list(user.businessId);
  }

  @Post()
  @Roles("owner", "manager")
  create(@CurrentUser() user: { businessId: string }, @Body() dto: CreateProductDto) {
    return this.products.create({ ...dto, businessId: user.businessId });
  }

  @Patch(":id")
  @Roles("owner", "manager")
  update(@Param("id") id: string, @Body() body: Partial<CreateProductDto>) {
    const { businessId, ...patch } = body;
    return this.products.update(id, patch);
  }

  @Post(":id/archive")
  @Roles("owner", "manager")
  archive(@Param("id") id: string) {
    return this.products.archive(id);
  }

  @Post(":id/adjust-stock")
  @Roles("owner", "manager")
  adjustStock(@CurrentUser() user: { businessId: string }, @Param("id") id: string, @Body() dto: AdjustStockDto) {
    return this.products.adjustStock({
      businessId: user.businessId,
      productId: id,
      referenceType: (dto.referenceType as "sale" | "purchase" | "adjustment" | "restock" | "refund") ?? "adjustment",
      referenceId: `${id}-${Date.now()}`,
      quantityDelta: dto.quantityDelta,
      unitCost: dto.unitCost,
      ...(dto.note !== undefined ? { note: dto.note } : {})
    });
  }

  @Get(":id/history")
  @Roles("owner", "manager", "cashier")
  history(@CurrentUser() user: { businessId: string }, @Param("id") id: string) {
    return this.products.history(user.businessId, id);
  }
}
