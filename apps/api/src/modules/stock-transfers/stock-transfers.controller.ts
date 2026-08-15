import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { StockTransfersService } from "./stock-transfers.service";

class StockTransferItemDto {
  @IsString() productId!: string;
  @IsNumber() quantity!: number;
  @IsNumber() unitCost!: number;
  @IsOptional() @IsString() batchNumber?: string | null;
  @IsOptional() @IsArray() serialNumbers?: string[];
}

class CreateStockTransferDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() externalId?: string;
  @IsOptional() @IsString() fromBranchId?: string | null;
  @IsOptional() @IsString() toBranchId?: string | null;
  @IsString() transferNumber!: string;
  @IsOptional() @IsString() status?: "draft" | "in_transit" | "received" | "cancelled";
  @IsDateString() transferDate!: string;
  @IsOptional() @IsDateString() receivedAt?: string | null;
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
  @IsOptional() @IsString() status?: "draft" | "in_transit" | "received" | "cancelled";
  @IsOptional() @IsDateString() transferDate?: string;
  @IsOptional() @IsDateString() receivedAt?: string | null;
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
    ...(input.receivedAt === undefined ? {} : input.receivedAt ? { receivedAt: new Date(input.receivedAt) } : { receivedAt: null }),
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
    ...(input.receivedAt === undefined ? {} : input.receivedAt ? { receivedAt: new Date(input.receivedAt) } : { receivedAt: null }),
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
  list(@CurrentUser() user: { businessId: string }) {
    return this.stockTransfers.list(user.businessId);
  }

  @Post()
  @Roles("owner", "manager")
  create(@CurrentUser() user: { businessId: string }, @Body() dto: CreateStockTransferDto) {
    return this.stockTransfers.create(buildCreateTransferPayload({ ...dto, businessId: user.businessId }));
  }

  @Patch(":id")
  @Roles("owner", "manager")
  update(@CurrentUser() user: { businessId: string }, @Param("id") id: string, @Body() dto: UpdateStockTransferDto) {
    return this.stockTransfers.update(user.businessId, id, buildUpdateTransferPatch({ ...dto, businessId: user.businessId }));
  }

  @Post(":id/archive")
  @Roles("owner", "manager")
  archive(@CurrentUser() user: { businessId: string }, @Param("id") id: string) {
    return this.stockTransfers.archive(user.businessId, id);
  }
}
