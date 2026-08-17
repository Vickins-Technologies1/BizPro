import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";
import { toSafeIsoString } from "../../common/date-normalizer";
import { CustomersService } from "./customers.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard } from "../../common/roles.guard";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";

class CustomerAttachmentDto {
  @IsOptional() @IsString() id?: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() addedAt?: string;
}

class CreateCustomerDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() externalId?: string;
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsString() groupId?: string | null;
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() email?: string | null;
  @IsOptional() @IsNumber() creditLimit?: number;
  @IsOptional() @IsNumber() loyaltyPoints?: number;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsNumber() balance?: number;
  @IsOptional() @IsArray() attachments?: CustomerAttachmentDto[];
}

class UpdateCustomerDto {
  @IsOptional() @IsString() externalId?: string | null;
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsString() groupId?: string | null;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() email?: string | null;
  @IsOptional() @IsNumber() creditLimit?: number;
  @IsOptional() @IsNumber() loyaltyPoints?: number;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsArray() attachments?: CustomerAttachmentDto[];
}

class CreateCustomerGroupDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() externalId?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() color?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateCustomerGroupDto {
  @IsOptional() @IsString() externalId?: string | null;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() color?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class RecordPaymentDto {
  @IsNumber() amount!: number;
  @IsString() method!: "cash" | "mpesa" | "bank" | "credit";
  @IsOptional() @IsString() externalId?: string;
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
}

function normalizeCustomerAttachments(attachments?: CustomerAttachmentDto[] | null) {
  if (!Array.isArray(attachments)) {
    return [];
  }
  return attachments.map((attachment, index) => ({
    id: attachment.id ?? `attachment-${index}`,
    label: attachment.label ?? "Attachment",
    url: attachment.url ?? "",
    note: attachment.note ?? null,
    addedAt: toSafeIsoString(attachment.addedAt ?? null)
  }));
}

@Controller("customers")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @Roles("owner", "manager", "cashier")
  list(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Query("branchId") branchId?: string) {
    return this.customers.list(user.businessId, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Get("groups")
  @Roles("owner", "manager", "cashier")
  groups(@CurrentUser() user: { businessId: string }) {
    return this.customers.listGroups(user.businessId);
  }

  @Post("groups")
  @Roles("owner", "manager", "cashier")
  createGroup(@CurrentUser() user: { businessId: string }, @Body() dto: CreateCustomerGroupDto) {
    return this.customers.createGroup({ ...dto, businessId: user.businessId });
  }

  @Patch("groups/:id")
  @Roles("owner", "manager", "cashier")
  updateGroup(@CurrentUser() user: { businessId: string }, @Param("id") id: string, @Body() dto: UpdateCustomerGroupDto) {
    return this.customers.updateGroup(user.businessId, id, dto);
  }

  @Post("groups/:id/archive")
  @Roles("owner", "manager", "cashier")
  archiveGroup(@CurrentUser() user: { businessId: string }, @Param("id") id: string) {
    return this.customers.archiveGroup(user.businessId, id);
  }

  @Get("analytics")
  @Roles("owner", "manager", "cashier")
  analytics(@CurrentUser() user: { businessId: string; branchId?: string | null }, @Query("branchId") branchId?: string) {
    return this.customers.analytics(user.businessId, { branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post()
  @Roles("owner", "manager", "cashier")
  create(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Body() dto: CreateCustomerDto) {
    return this.customers.create({
      ...dto,
      businessId: user.businessId,
      branchId: dto.branchId ?? user.branchId ?? null,
      groupId: dto.groupId ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      notes: dto.notes ?? null,
      creditLimit: dto.creditLimit ?? 0,
      loyaltyPoints: dto.loyaltyPoints ?? 0,
      balance: dto.balance ?? 0,
      attachments: normalizeCustomerAttachments(dto.attachments)
    }, { role: user.role ?? null, branchId: user.branchId ?? null });
  }

  @Patch(":id")
  @Roles("owner", "manager", "cashier")
  update(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(user.businessId, id, {
      ...(dto.externalId !== undefined ? { externalId: dto.externalId } : {}),
      ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
      ...(dto.groupId !== undefined ? { groupId: dto.groupId } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.creditLimit !== undefined ? { creditLimit: dto.creditLimit } : {}),
      ...(dto.loyaltyPoints !== undefined ? { loyaltyPoints: dto.loyaltyPoints } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.attachments !== undefined ? { attachments: normalizeCustomerAttachments(dto.attachments) } : {})
    }, { role: user.role ?? null, branchId: user.branchId ?? null });
  }

  @Get(":id/payments")
  @Roles("owner", "manager", "cashier")
  payments(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string, @Query("branchId") branchId?: string) {
    return this.customers.payments(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post(":id/payments")
  @Roles("owner", "manager", "cashier")
  recordPayment(@CurrentUser() user: { businessId: string; sub: string; role?: string; branchId?: string | null }, @Param("id") id: string, @Body() dto: RecordPaymentDto) {
    return this.customers.recordPayment({
      businessId: user.businessId,
      customerId: id,
      ...(dto.externalId !== undefined ? { externalId: dto.externalId } : {}),
      ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
      amount: dto.amount,
      method: dto.method,
      reference: dto.reference ?? null,
      note: dto.note ?? null,
      recordedById: user.sub
    }, { role: user.role ?? null, branchId: user.branchId ?? null });
  }
}
