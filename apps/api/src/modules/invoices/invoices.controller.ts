import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { InvoicesService } from "./invoices.service";
import { PAYMENT_METHODS } from "@vbo/shared";

class InvoiceLineItemDto {
  @IsOptional() @IsString() productId?: string | null;
  @IsOptional() @IsString() productName?: string | null;
  @IsString() description!: string;
  @IsNumber() quantity!: number;
  @IsString() unit!: string;
  @IsNumber() unitPrice!: number;
  @IsOptional() @IsIn(["percentage", "fixed"]) discountType?: "percentage" | "fixed";
  @IsOptional() @IsNumber() discountValue?: number;
  @IsOptional() @IsIn(["vat", "zero_rated", "exempt", "non_taxable", "custom"]) taxCategory?: "vat" | "zero_rated" | "exempt" | "non_taxable" | "custom";
  @IsOptional() @IsString() taxCode?: string | null;
  @IsOptional() @IsNumber() taxRate?: number;
  @IsOptional() @IsBoolean() taxInclusive?: boolean;
}

class CreateInvoiceDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() externalId?: string;
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsString() customerId?: string | null;
  @IsOptional() @IsString() customerName?: string | null;
  @IsOptional() @IsString() customerBusinessName?: string | null;
  @IsOptional() @IsString() customerEmail?: string | null;
  @IsOptional() @IsString() customerPhone?: string | null;
  @IsOptional() @IsString() customerAddress?: string | null;
  @IsOptional() @IsString() customerTaxPin?: string | null;
  @IsOptional() @IsString() invoiceNumber?: string | null;
  @IsDateString() issueDate!: string;
  @IsDateString() dueDate!: string;
  @IsString() paymentTerms!: string;
  @IsString() currency!: string;
  @IsOptional() @IsString() referenceNumber?: string | null;
  @IsOptional() @IsString() purchaseOrderNumber?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() termsAndConditions?: string | null;
  @IsOptional() @IsIn(["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled", "void", "refunded", "archived"]) status?: any;
  @Type(() => InvoiceLineItemDto)
  @ValidateNested({ each: true })
  @IsArray()
  lineItems!: InvoiceLineItemDto[];
  @IsOptional() @IsNumber() amountPaid?: number;
}

class PatchInvoiceDto {
  @IsOptional() @IsString() invoiceNumber?: string | null;
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsString() customerId?: string | null;
  @IsOptional() @IsString() customerName?: string | null;
  @IsOptional() @IsString() customerBusinessName?: string | null;
  @IsOptional() @IsString() customerEmail?: string | null;
  @IsOptional() @IsString() customerPhone?: string | null;
  @IsOptional() @IsString() customerAddress?: string | null;
  @IsOptional() @IsString() customerTaxPin?: string | null;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() paymentTerms?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() referenceNumber?: string | null;
  @IsOptional() @IsString() purchaseOrderNumber?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() termsAndConditions?: string | null;
  @IsOptional() @IsIn(["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled", "void", "refunded", "archived"]) status?: any;
  @Type(() => InvoiceLineItemDto)
  @ValidateNested({ each: true })
  @IsArray()
  @IsOptional()
  lineItems?: InvoiceLineItemDto[];
}

class RecordInvoicePaymentDto {
  @IsNumber() amount!: number;
  @IsIn(PAYMENT_METHODS) method!: string;
  @IsDateString() paymentDate!: string;
  @IsOptional() @IsString() reference?: string | null;
  @IsOptional() @IsString() note?: string | null;
  @IsOptional() @IsString() externalId?: string | null;
}

class CreateCreditNoteDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() externalId?: string | null;
  @IsOptional() @IsString() branchId?: string | null;
  @IsString() reference!: string;
  @IsOptional() @IsString() customerId?: string | null;
  @IsNumber() amount!: number;
  @IsString() reason!: string;
  @IsOptional() @IsString() note?: string | null;
  @IsDateString() creditDate!: string;
  @IsOptional() @IsIn(["draft", "issued", "void"]) status?: "draft" | "issued" | "void";
}

class CreateDebitNoteDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() externalId?: string | null;
  @IsOptional() @IsString() branchId?: string | null;
  @IsString() reference!: string;
  @IsString() reason!: string;
  @IsNumber() amount!: number;
  @IsNumber() taxAdjustment!: number;
  @IsOptional() @IsString() note?: string | null;
  @IsDateString() issuedAt!: string;
  @IsOptional() @IsIn(["draft", "issued", "void"]) status?: "draft" | "issued" | "void";
}

@Controller("invoices")
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get("dashboard")
  @Roles("owner", "manager")
  dashboard(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Query("from") from?: string, @Query("to") to?: string, @Query("branchId") branchId?: string) {
    return this.invoices.dashboard(user.businessId, from, to, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Get()
  @Roles("owner", "manager", "cashier")
  list(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Query() query: Record<string, string>) {
    return this.invoices.list(
      user.businessId,
      {
        search: query.search,
        status: query.status,
        customerId: query.customerId,
        from: query.from,
        to: query.to,
        sortBy: query.sortBy as any,
        sortOrder: query.sortOrder as any,
        page: query.page ? Number(query.page) : undefined,
        pageSize: query.pageSize ? Number(query.pageSize) : undefined
      },
      { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: query.branchId ?? null }
    );
  }

  @Get("customer/:customerId")
  @Roles("owner", "manager", "cashier")
  customerHistory(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("customerId") customerId: string, @Query("branchId") branchId?: string) {
    return this.invoices.customerHistory(user.businessId, customerId, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Get("public/:token")
  getPublic(@Param("token") token: string) {
    return this.invoices.getByToken(token);
  }

  @Get(":id/pdf-html")
  @Roles("owner", "manager", "cashier")
  pdfHtml(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string, @Query("branchId") branchId?: string) {
    return this.invoices.renderInvoiceHtml(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Get(":id")
  @Roles("owner", "manager", "cashier")
  get(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Param("id") id: string, @Query("branchId") branchId?: string) {
    return this.invoices.get(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post()
  @Roles("owner", "manager", "cashier")
  create(@CurrentUser() user: { businessId: string; branchId?: string | null; role?: string }, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(
      {
        ...dto,
        businessId: user.businessId,
        branchId: dto.branchId ?? user.branchId ?? null,
        externalId: dto.externalId ?? null,
        customerId: dto.customerId ?? null,
        customerName: dto.customerName ?? null,
        customerBusinessName: dto.customerBusinessName ?? null,
        customerEmail: dto.customerEmail ?? null,
        customerPhone: dto.customerPhone ?? null,
        customerAddress: dto.customerAddress ?? null,
        customerTaxPin: dto.customerTaxPin ?? null,
        invoiceNumber: dto.invoiceNumber ?? null,
        issueDate: new Date(dto.issueDate),
        dueDate: new Date(dto.dueDate),
        referenceNumber: dto.referenceNumber ?? null,
        purchaseOrderNumber: dto.purchaseOrderNumber ?? null,
        notes: dto.notes ?? null,
        termsAndConditions: dto.termsAndConditions ?? null,
        amountPaid: dto.amountPaid ?? 0,
        lineItems: dto.lineItems
      },
      { role: user.role ?? null, branchId: user.branchId ?? null }
    );
  }

  @Patch(":id")
  @Roles("owner", "manager", "cashier")
  update(@CurrentUser() user: { businessId: string; branchId?: string | null; role?: string }, @Param("id") id: string, @Body() dto: PatchInvoiceDto) {
    const { issueDate, dueDate, lineItems, ...restDto } = dto;
    return this.invoices.update(
      user.businessId,
      id,
      {
        ...restDto,
        customerId: dto.customerId ?? null,
        customerName: dto.customerName ?? null,
        customerBusinessName: dto.customerBusinessName ?? null,
        customerEmail: dto.customerEmail ?? null,
        customerPhone: dto.customerPhone ?? null,
        customerAddress: dto.customerAddress ?? null,
        customerTaxPin: dto.customerTaxPin ?? null,
        ...(issueDate ? { issueDate: new Date(issueDate) } : {}),
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        referenceNumber: dto.referenceNumber ?? null,
        purchaseOrderNumber: dto.purchaseOrderNumber ?? null,
        notes: dto.notes ?? null,
        termsAndConditions: dto.termsAndConditions ?? null,
        ...(lineItems ? { lineItems } : {})
      },
      { role: user.role ?? null, branchId: user.branchId ?? null }
    );
  }

  @Post(":id/duplicate")
  @Roles("owner", "manager", "cashier")
  duplicate(@CurrentUser() user: { businessId: string; branchId?: string | null; role?: string }, @Param("id") id: string, @Query("branchId") branchId?: string) {
    return this.invoices.duplicate(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post(":id/send")
  @Roles("owner", "manager", "cashier")
  send(@CurrentUser() user: { businessId: string; branchId?: string | null; role?: string }, @Param("id") id: string, @Query("branchId") branchId?: string) {
    return this.invoices.send(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post(":id/view")
  @Roles("owner", "manager", "cashier")
  view(@CurrentUser() user: { businessId: string; branchId?: string | null; role?: string }, @Param("id") id: string, @Query("branchId") branchId?: string) {
    return this.invoices.markViewed(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post(":id/payments")
  @Roles("owner", "manager", "cashier")
  recordPayment(@CurrentUser() user: { businessId: string; sub: string; branchId?: string | null; role?: string }, @Param("id") id: string, @Body() dto: RecordInvoicePaymentDto) {
    return this.invoices.recordPayment(
      {
        businessId: user.businessId,
        invoiceId: id,
        amount: dto.amount,
        method: dto.method,
        paymentDate: new Date(dto.paymentDate),
        reference: dto.reference ?? null,
        note: dto.note ?? null,
        externalId: dto.externalId ?? null,
        recordedById: user.sub
      },
      { role: user.role ?? null, branchId: user.branchId ?? null }
    );
  }

  @Post(":id/cancel")
  @Roles("owner", "manager")
  cancel(@CurrentUser() user: { businessId: string; branchId?: string | null; role?: string }, @Param("id") id: string, @Query("branchId") branchId?: string) {
    return this.invoices.cancel(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post(":id/void")
  @Roles("owner", "manager")
  void(@CurrentUser() user: { businessId: string; branchId?: string | null; role?: string }, @Param("id") id: string, @Query("branchId") branchId?: string) {
    return this.invoices.void(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post(":id/archive")
  @Roles("owner", "manager")
  archive(@CurrentUser() user: { businessId: string; branchId?: string | null; role?: string }, @Param("id") id: string, @Query("branchId") branchId?: string) {
    return this.invoices.archive(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post(":id/restore")
  @Roles("owner", "manager")
  restore(@CurrentUser() user: { businessId: string; branchId?: string | null; role?: string }, @Param("id") id: string, @Query("branchId") branchId?: string) {
    return this.invoices.restore(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Delete(":id")
  @Roles("owner", "manager")
  delete(@CurrentUser() user: { businessId: string; branchId?: string | null; role?: string }, @Param("id") id: string, @Query("branchId") branchId?: string) {
    return this.invoices.deleteDraft(user.businessId, id, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post(":id/credit-notes")
  @Roles("owner", "manager")
  createCreditNote(@CurrentUser() user: { businessId: string; branchId?: string | null; role?: string }, @Param("id") id: string, @Body() dto: CreateCreditNoteDto) {
    return this.invoices.createCreditNote(
      {
        ...dto,
        businessId: user.businessId,
        invoiceId: id,
        branchId: dto.branchId ?? user.branchId ?? null,
        externalId: dto.externalId ?? null,
        customerId: dto.customerId ?? null,
        note: dto.note ?? null,
        status: dto.status ?? "draft",
        creditDate: new Date(dto.creditDate)
      },
      { role: user.role ?? null, branchId: user.branchId ?? null }
    );
  }

  @Post(":id/debit-notes")
  @Roles("owner", "manager")
  createDebitNote(@CurrentUser() user: { businessId: string; branchId?: string | null; role?: string }, @Param("id") id: string, @Body() dto: CreateDebitNoteDto) {
    return this.invoices.createDebitNote(
      {
        ...dto,
        businessId: user.businessId,
        invoiceId: id,
        branchId: dto.branchId ?? user.branchId ?? null,
        externalId: dto.externalId ?? null,
        note: dto.note ?? null,
        status: dto.status ?? "draft",
        issuedAt: new Date(dto.issuedAt)
      },
      { role: user.role ?? null, branchId: user.branchId ?? null }
    );
  }
}
