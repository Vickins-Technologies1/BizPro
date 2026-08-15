import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { PurchaseOrdersService } from "./purchase-orders.service";

class PurchaseOrderItemDto {
  @IsString() productId!: string;
  @IsString() productName!: string;
  @IsNumber() quantity!: number;
  @IsNumber() unitCost!: number;
  @IsOptional() @IsString() batchNumber?: string | null;
  @IsOptional() @IsString() expiryDate?: string | null;
}

class CreatePurchaseOrderDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() externalId?: string;
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsString() supplierId?: string | null;
  @IsString() orderNumber!: string;
  @IsOptional() @IsString() status?: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  @IsDateString() orderDate!: string;
  @IsOptional() @IsDateString() expectedDate?: string | null;
  @IsOptional() @IsDateString() receivedAt?: string | null;
  @IsOptional() @IsNumber() subtotal?: number;
  @IsOptional() @IsNumber() taxTotal?: number;
  @IsOptional() @IsNumber() total?: number;
  @IsOptional() @IsString() notes?: string | null;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];
}

class UpdatePurchaseOrderDto {
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsString() supplierId?: string | null;
  @IsOptional() @IsString() orderNumber?: string;
  @IsOptional() @IsString() status?: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  @IsOptional() @IsDateString() orderDate?: string;
  @IsOptional() @IsDateString() expectedDate?: string | null;
  @IsOptional() @IsDateString() receivedAt?: string | null;
  @IsOptional() @IsNumber() subtotal?: number;
  @IsOptional() @IsNumber() taxTotal?: number;
  @IsOptional() @IsNumber() total?: number;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items?: PurchaseOrderItemDto[];
}

function buildCreateOrderPayload(input: CreatePurchaseOrderDto & { businessId: string; branchId?: string | null }) {
  return {
    businessId: input.businessId,
    branchId: input.branchId ?? null,
    externalId: input.externalId ?? null,
    supplierId: input.supplierId ?? null,
    orderNumber: input.orderNumber,
    status: input.status ?? "draft",
    orderDate: new Date(input.orderDate),
    ...(input.expectedDate === undefined ? {} : input.expectedDate ? { expectedDate: new Date(input.expectedDate) } : { expectedDate: null }),
    ...(input.receivedAt === undefined ? {} : input.receivedAt ? { receivedAt: new Date(input.receivedAt) } : { receivedAt: null }),
    ...(input.subtotal === undefined ? {} : { subtotal: input.subtotal }),
    ...(input.taxTotal === undefined ? {} : { taxTotal: input.taxTotal }),
    ...(input.total === undefined ? {} : { total: input.total }),
    notes: input.notes ?? null,
    items: input.items
  };
}

function buildUpdateOrderPatch(input: UpdatePurchaseOrderDto & { businessId: string; branchId?: string | null }) {
  return {
    ...(input.branchId === undefined ? {} : { branchId: input.branchId }),
    ...(input.supplierId === undefined ? {} : { supplierId: input.supplierId }),
    ...(input.orderNumber === undefined ? {} : { orderNumber: input.orderNumber }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.orderDate === undefined ? {} : { orderDate: new Date(input.orderDate) }),
    ...(input.expectedDate === undefined ? {} : input.expectedDate ? { expectedDate: new Date(input.expectedDate) } : { expectedDate: null }),
    ...(input.receivedAt === undefined ? {} : input.receivedAt ? { receivedAt: new Date(input.receivedAt) } : { receivedAt: null }),
    ...(input.subtotal === undefined ? {} : { subtotal: input.subtotal }),
    ...(input.taxTotal === undefined ? {} : { taxTotal: input.taxTotal }),
    ...(input.total === undefined ? {} : { total: input.total }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.items === undefined ? {} : { items: input.items })
  };
}

@Controller("purchase-orders")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Get()
  @Roles("owner", "manager", "cashier")
  list(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Query("branchId") branchId?: string) {
    return this.purchaseOrders.list(user.businessId, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post()
  @Roles("owner", "manager")
  create(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrders.create(buildCreateOrderPayload({ ...dto, businessId: user.businessId, branchId: dto.branchId ?? user.branchId ?? null }), { role: user.role ?? null, branchId: user.branchId ?? null });
  }

  @Patch(":id")
  @Roles("owner", "manager")
  update(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.purchaseOrders.update(user.businessId, id, buildUpdateOrderPatch({ ...dto, businessId: user.businessId, branchId: user.branchId ?? null }), { role: user.role ?? null, branchId: user.branchId ?? null });
  }

  @Post(":id/archive")
  @Roles("owner", "manager")
  archive(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string, @Query("branchId") branchId?: string) {
    return this.purchaseOrders.archive(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }
}
