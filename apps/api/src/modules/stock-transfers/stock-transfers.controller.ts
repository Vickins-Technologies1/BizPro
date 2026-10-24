import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { StockTransfersService } from "./stock-transfers.service";

class StockTransferItemDto {
  @IsString() productId!: string;
  @IsNumber() @Min(0.000001) quantity!: number;
  @IsNumber() @Min(0) unitCost!: number;
  @IsOptional() @IsString() batchNumber?: string | null;
  @IsOptional() @IsArray() serialNumbers?: string[];
}

class CreateStockTransferDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() externalId?: string;
  @IsOptional() @IsString() fromBranchId?: string | null;
  @IsOptional() @IsString() toBranchId?: string | null;
  @IsString() transferNumber!: string;
  @IsOptional() @IsIn(["draft"]) status?: "draft";
  @IsDateString() transferDate!: string;
  @IsOptional() @IsString() note?: string | null;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockTransferItemDto)
  items!: StockTransferItemDto[];
}

class UpdateStockTransferDto {
  @IsOptional() @IsString() fromBranchId?: string | null;
  @IsOptional() @IsString() toBranchId?: string | null;
  @IsOptional() @IsString() transferNumber?: string;
  @IsOptional() @IsIn(["draft", "cancelled"]) status?: "draft" | "cancelled";
  @IsOptional() @IsDateString() transferDate?: string;
  @IsOptional() @IsString() note?: string | null;
  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockTransferItemDto)
  items?: StockTransferItemDto[];
}

function buildCreateTransferPayload(input: CreateStockTransferDto & { businessId: string }) {
  return {
    businessId: input.businessId,
    externalId: input.externalId ?? null,
    fromBranchId: input.fromBranchId ?? null,
    toBranchId: input.toBranchId ?? null,
    transferNumber: input.transferNumber,
    status: input.status ?? "draft",
    transferDate: new Date(input.transferDate),
    note: input.note ?? null,
    items: input.items
  };
}

function buildUpdateTransferPatch(input: UpdateStockTransferDto & { businessId: string }) {
  return {
    ...(input.fromBranchId === undefined ? {} : { fromBranchId: input.fromBranchId }),
    ...(input.toBranchId === undefined ? {} : { toBranchId: input.toBranchId }),
    ...(input.transferNumber === undefined ? {} : { transferNumber: input.transferNumber }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.transferDate === undefined ? {} : { transferDate: new Date(input.transferDate) }),
    ...(input.note === undefined ? {} : { note: input.note }),
    ...(input.items === undefined ? {} : { items: input.items })
  };
}

@Controller("stock-transfers")
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockTransfersController {
  constructor(private readonly stockTransfers: StockTransfersService) {}

  @Get()
  @Roles("owner", "manager", "cashier")
  list(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Query("branchId") branchId?: string) {
    return this.stockTransfers.list(user.businessId, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post()
  @Roles("owner", "manager")
  create(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Body() dto: CreateStockTransferDto) {
    return this.stockTransfers.create(buildCreateTransferPayload({ ...dto, businessId: user.businessId }), { role: user.role ?? null, branchId: user.branchId ?? null });
  }

  @Patch(":id")
  @Roles("owner", "manager")
  update(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string, @Body() dto: UpdateStockTransferDto) {
    return this.stockTransfers.update(user.businessId, id, buildUpdateTransferPatch({ ...dto, businessId: user.businessId }), { role: user.role ?? null, branchId: user.branchId ?? null });
  }

  @Post(":id/dispatch")
  @Roles("owner", "manager")
  dispatch(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string) {
    return this.stockTransfers.dispatch(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null });
  }

  @Post(":id/receive")
  @Roles("owner", "manager")
  receive(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string) {
    return this.stockTransfers.receive(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null });
  }

  @Post(":id/archive")
  @Roles("owner", "manager")
  archive(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string) {
    return this.stockTransfers.archive(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null });
  }
}
