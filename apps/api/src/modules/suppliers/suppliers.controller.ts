import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { SuppliersService } from "./suppliers.service";

class CreateSupplierDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() externalId?: string;
  @IsOptional() @IsString() categoryId?: string | null;
  @IsOptional() @IsString() code?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateSupplierDto {
  @IsOptional() @IsString() categoryId?: string | null;
  @IsOptional() @IsString() code?: string | null;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() email?: string | null;
  @IsOptional() @IsString() contactName?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class CreateSupplierCategoryDto {
  @IsString() businessId!: string;
  @IsOptional() @IsString() externalId?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() color?: string | null;
  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdateSupplierCategoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() color?: string | null;
  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class CreateSupplierContactDto {
  @IsString() name!: string;
  @IsOptional() @IsString() role?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() email?: string | null;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsString() notes?: string | null;
}

class UpdateSupplierContactDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() role?: string | null;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsString() email?: string | null;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsString() notes?: string | null;
}

class CreateSupplierDocumentDto {
  @IsString() title!: string;
  @IsString() url!: string;
  @IsOptional() @IsString() fileName?: string | null;
  @IsOptional() @IsString() documentType?: string | null;
  @IsOptional() @IsString() note?: string | null;
  @IsOptional() @IsString() uploadedById?: string | null;
}

class UpdateSupplierDocumentDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() fileName?: string | null;
  @IsOptional() @IsString() documentType?: string | null;
  @IsOptional() @IsString() note?: string | null;
  @IsOptional() @IsString() uploadedById?: string | null;
}

class CreateSupplierPaymentDto {
  @IsOptional() @IsString() externalId?: string;
  @IsOptional() @IsString() purchaseOrderId?: string | null;
  @IsNumber() amount!: number;
  @IsIn(["cash", "mpesa", "bank", "credit"]) method!: "cash" | "mpesa" | "bank" | "credit";
  @IsOptional() @IsString() reference?: string | null;
  @IsOptional() @IsString() note?: string | null;
  @IsDateString() paymentDate!: string;
  @IsOptional() @IsString() recordedById?: string | null;
}

@Controller("suppliers")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @Roles("owner", "manager", "cashier")
  list(@CurrentUser() user: { businessId: string }) {
    return this.suppliers.list(user.businessId);
  }

  @Post()
  @Roles("owner", "manager")
  create(@CurrentUser() user: { businessId: string }, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create({
      ...dto,
      businessId: user.businessId,
      categoryId: dto.categoryId ?? null
    });
  }

  @Patch(":id")
  @Roles("owner", "manager")
  update(@CurrentUser() user: { businessId: string }, @Param("id") id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliers.update(user.businessId, id, dto);
  }

  @Post(":id/archive")
  @Roles("owner", "manager")
  archive(@CurrentUser() user: { businessId: string }, @Param("id") id: string) {
    return this.suppliers.archive(user.businessId, id);
  }

  @Get("categories")
  @Roles("owner", "manager", "cashier")
  listCategories(@CurrentUser() user: { businessId: string }) {
    return this.suppliers.listCategories(user.businessId);
  }

  @Post("categories")
  @Roles("owner", "manager")
  createCategory(@CurrentUser() user: { businessId: string }, @Body() dto: CreateSupplierCategoryDto) {
    return this.suppliers.createCategory({
      ...dto,
      businessId: user.businessId,
      externalId: dto.externalId ?? null,
      description: dto.description ?? null,
      color: dto.color ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true
    });
  }

  @Patch("categories/:id")
  @Roles("owner", "manager")
  updateCategory(@CurrentUser() user: { businessId: string }, @Param("id") id: string, @Body() dto: UpdateSupplierCategoryDto) {
    return this.suppliers.updateCategory(user.businessId, id, dto);
  }

  @Post("categories/:id/archive")
  @Roles("owner", "manager")
  archiveCategory(@CurrentUser() user: { businessId: string }, @Param("id") id: string) {
    return this.suppliers.archiveCategory(user.businessId, id);
  }

  @Get(":supplierId/contacts")
  @Roles("owner", "manager", "cashier")
  listContacts(@CurrentUser() user: { businessId: string }, @Param("supplierId") supplierId: string) {
    return this.suppliers.listContacts(user.businessId, supplierId);
  }

  @Post(":supplierId/contacts")
  @Roles("owner", "manager")
  createContact(@CurrentUser() user: { businessId: string }, @Param("supplierId") supplierId: string, @Body() dto: CreateSupplierContactDto) {
    return this.suppliers.createContact({
      ...dto,
      businessId: user.businessId,
      supplierId,
      role: dto.role ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      notes: dto.notes ?? null,
      isPrimary: dto.isPrimary ?? false
    });
  }

  @Patch(":supplierId/contacts/:id")
  @Roles("owner", "manager")
  updateContact(@CurrentUser() user: { businessId: string }, @Param("supplierId") supplierId: string, @Param("id") id: string, @Body() dto: UpdateSupplierContactDto) {
    return this.suppliers.updateContact(user.businessId, supplierId, id, dto);
  }

  @Post(":supplierId/contacts/:id/archive")
  @Roles("owner", "manager")
  archiveContact(@CurrentUser() user: { businessId: string }, @Param("supplierId") supplierId: string, @Param("id") id: string) {
    return this.suppliers.archiveContact(user.businessId, supplierId, id);
  }

  @Get(":supplierId/documents")
  @Roles("owner", "manager", "cashier")
  listDocuments(@CurrentUser() user: { businessId: string }, @Param("supplierId") supplierId: string) {
    return this.suppliers.listDocuments(user.businessId, supplierId);
  }

  @Post(":supplierId/documents")
  @Roles("owner", "manager")
  createDocument(@CurrentUser() user: { businessId: string }, @Param("supplierId") supplierId: string, @Body() dto: CreateSupplierDocumentDto) {
    return this.suppliers.createDocument({
      ...dto,
      businessId: user.businessId,
      supplierId,
      fileName: dto.fileName ?? null,
      documentType: dto.documentType ?? null,
      note: dto.note ?? null,
      uploadedById: dto.uploadedById ?? null
    });
  }

  @Patch(":supplierId/documents/:id")
  @Roles("owner", "manager")
  updateDocument(@CurrentUser() user: { businessId: string }, @Param("supplierId") supplierId: string, @Param("id") id: string, @Body() dto: UpdateSupplierDocumentDto) {
    return this.suppliers.updateDocument(user.businessId, supplierId, id, dto);
  }

  @Post(":supplierId/documents/:id/archive")
  @Roles("owner", "manager")
  archiveDocument(@CurrentUser() user: { businessId: string }, @Param("supplierId") supplierId: string, @Param("id") id: string) {
    return this.suppliers.archiveDocument(user.businessId, supplierId, id);
  }

  @Get(":supplierId/payments")
  @Roles("owner", "manager", "cashier")
  listPayments(@CurrentUser() user: { businessId: string }, @Param("supplierId") supplierId: string, @Query("from") from?: string, @Query("to") to?: string) {
    return this.suppliers.listPayments(user.businessId, supplierId, from, to);
  }

  @Post(":supplierId/payments")
  @Roles("owner", "manager")
  createPayment(@CurrentUser() user: { businessId: string; sub: string }, @Param("supplierId") supplierId: string, @Body() dto: CreateSupplierPaymentDto) {
    return this.suppliers.createPayment({
      ...dto,
      businessId: user.businessId,
      supplierId,
      externalId: dto.externalId ?? null,
      purchaseOrderId: dto.purchaseOrderId ?? null,
      reference: dto.reference ?? null,
      note: dto.note ?? null,
      recordedById: dto.recordedById ?? user.sub,
      paymentDate: new Date(dto.paymentDate)
    });
  }

  @Post(":supplierId/payments/:id/archive")
  @Roles("owner", "manager")
  archivePayment(@CurrentUser() user: { businessId: string }, @Param("supplierId") supplierId: string, @Param("id") id: string) {
    return this.suppliers.archivePayment(user.businessId, supplierId, id);
  }

  @Get(":supplierId/statement")
  @Roles("owner", "manager", "cashier")
  statement(@CurrentUser() user: { businessId: string }, @Param("supplierId") supplierId: string, @Query("from") from?: string, @Query("to") to?: string) {
    return this.suppliers.statement(user.businessId, supplierId, from, to);
  }

  @Get(":supplierId/performance")
  @Roles("owner", "manager", "cashier")
  performance(@CurrentUser() user: { businessId: string }, @Param("supplierId") supplierId: string, @Query("from") from?: string, @Query("to") to?: string) {
    return this.suppliers.performance(user.businessId, supplierId, from, to);
  }
}
