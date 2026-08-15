import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsDateString, IsIn, IsNumber, IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { FinanceService } from "./finance.service";

class CreateBankAccountDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() externalId?: string;
  @IsString() bankName!: string;
  @IsString() accountName!: string;
  @IsOptional() @IsString() accountNumber?: string | null;
  @IsString() currency!: string;
  @IsNumber() openingBalance!: number;
  @IsOptional() @IsNumber() currentBalance?: number;
  @IsOptional() @IsIn([true, false]) isPrimary?: boolean;
  @IsOptional() @IsString() notes?: string | null;
}

class UpdateBankAccountDto {
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() accountName?: string;
  @IsOptional() @IsString() accountNumber?: string | null;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() openingBalance?: number;
  @IsOptional() @IsNumber() currentBalance?: number;
  @IsOptional() @IsIn([true, false]) isPrimary?: boolean;
  @IsOptional() @IsString() notes?: string | null;
}

class CreatePettyCashEntryDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() externalId?: string;
  @IsString() label!: string;
  @IsNumber() amount!: number;
  @IsIn(["in", "out"]) direction!: "in" | "out";
  @IsOptional() @IsString() category?: string | null;
  @IsOptional() @IsString() note?: string | null;
  @IsOptional() @IsString() recordedById?: string | null;
  @IsDateString() entryDate!: string;
}

class CreateCreditNoteDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() externalId?: string;
  @IsOptional() @IsString() branchId?: string | null;
  @IsString() reference!: string;
  @IsOptional() @IsString() relatedSaleId?: string | null;
  @IsOptional() @IsString() customerId?: string | null;
  @IsNumber() amount!: number;
  @IsString() reason!: string;
  @IsOptional() @IsString() note?: string | null;
  @IsOptional() @IsIn(["draft", "issued", "void"]) status?: "draft" | "issued" | "void";
  @IsDateString() creditDate!: string;
}

@Controller("finance")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get("overview")
  @Roles("owner", "manager")
  overview(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Query("from") from?: string, @Query("to") to?: string, @Query("branchId") branchId?: string) {
    return this.finance.overview(user.businessId, from, to, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Get("invoices")
  @Roles("owner", "manager")
  invoices(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Query("from") from?: string, @Query("to") to?: string, @Query("branchId") branchId?: string) {
    return this.finance.invoices(user.businessId, from, to, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Get("payments")
  @Roles("owner", "manager")
  payments(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Query("from") from?: string, @Query("to") to?: string, @Query("branchId") branchId?: string) {
    return this.finance.payments(user.businessId, from, to, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Get("credit-notes")
  @Roles("owner", "manager")
  creditNotes(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Query("from") from?: string, @Query("to") to?: string, @Query("branchId") branchId?: string) {
    return this.finance.creditNotes(user.businessId, from, to, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post("credit-notes")
  @Roles("owner", "manager")
  createCreditNote(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Body() dto: CreateCreditNoteDto) {
    return this.finance.createCreditNote({
      ...dto,
      businessId: user.businessId,
      branchId: dto.branchId ?? user.branchId ?? null,
      externalId: dto.externalId ?? null,
      relatedSaleId: dto.relatedSaleId ?? null,
      customerId: dto.customerId ?? null,
      note: dto.note ?? null,
      status: dto.status ?? "draft",
      creditDate: new Date(dto.creditDate)
    }, { role: user.role ?? null, branchId: user.branchId ?? null });
  }

  @Patch("credit-notes/:id")
  @Roles("owner", "manager")
  updateCreditNote(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string, @Body() dto: Partial<CreateCreditNoteDto>) {
    return this.finance.updateCreditNote(user.businessId, id, {
      ...(dto.reference !== undefined ? { reference: dto.reference } : {}),
      ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
      ...(dto.relatedSaleId !== undefined ? { relatedSaleId: dto.relatedSaleId } : {}),
      ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
      ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
      ...(dto.note !== undefined ? { note: dto.note } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {})
    }, { role: user.role ?? null, branchId: user.branchId ?? null });
  }

  @Post("credit-notes/:id/archive")
  @Roles("owner", "manager")
  archiveCreditNote(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string) {
    return this.finance.archiveCreditNote(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null });
  }

  @Get("bank-accounts")
  @Roles("owner", "manager")
  bankAccounts(@CurrentUser() user: { businessId: string }) {
    return this.finance.bankAccounts(user.businessId);
  }

  @Post("bank-accounts")
  @Roles("owner", "manager")
  createBankAccount(@CurrentUser() user: { businessId: string }, @Body() dto: CreateBankAccountDto) {
    return this.finance.createBankAccount({
      ...dto,
      businessId: user.businessId,
      externalId: dto.externalId ?? null,
      accountNumber: dto.accountNumber ?? null,
      currentBalance: dto.currentBalance ?? dto.openingBalance,
      isPrimary: dto.isPrimary ?? false,
      notes: dto.notes ?? null
    });
  }

  @Patch("bank-accounts/:id")
  @Roles("owner", "manager")
  updateBankAccount(@CurrentUser() user: { businessId: string }, @Param("id") id: string, @Body() dto: UpdateBankAccountDto) {
    return this.finance.updateBankAccount(user.businessId, id, {
      ...(dto.bankName !== undefined ? { bankName: dto.bankName } : {}),
      ...(dto.accountName !== undefined ? { accountName: dto.accountName } : {}),
      ...(dto.accountNumber !== undefined ? { accountNumber: dto.accountNumber } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.openingBalance !== undefined ? { openingBalance: dto.openingBalance } : {}),
      ...(dto.currentBalance !== undefined ? { currentBalance: dto.currentBalance } : {}),
      ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {})
    });
  }

  @Post("bank-accounts/:id/archive")
  @Roles("owner", "manager")
  archiveBankAccount(@CurrentUser() user: { businessId: string }, @Param("id") id: string) {
    return this.finance.archiveBankAccount(user.businessId, id);
  }

  @Get("petty-cash")
  @Roles("owner", "manager")
  pettyCash(@CurrentUser() user: { businessId: string }, @Query("from") from?: string, @Query("to") to?: string) {
    return this.finance.pettyCash(user.businessId, from, to);
  }

  @Post("petty-cash")
  @Roles("owner", "manager")
  createPettyCashEntry(@CurrentUser() user: { businessId: string; sub: string }, @Body() dto: CreatePettyCashEntryDto) {
    return this.finance.createPettyCashEntry({
      ...dto,
      businessId: user.businessId,
      externalId: dto.externalId ?? null,
      category: dto.category ?? null,
      note: dto.note ?? null,
      recordedById: dto.recordedById ?? user.sub,
      entryDate: new Date(dto.entryDate)
    });
  }

  @Post("petty-cash/:id/archive")
  @Roles("owner", "manager")
  archivePettyCashEntry(@CurrentUser() user: { businessId: string }, @Param("id") id: string) {
    return this.finance.archivePettyCashEntry(user.businessId, id);
  }
}
