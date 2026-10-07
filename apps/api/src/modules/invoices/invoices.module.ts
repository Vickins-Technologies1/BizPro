import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditLog, AuditLogSchema, Business, BusinessSchema, CreditNote, CreditNoteSchema, Customer, CustomerSchema, DebitNote, DebitNoteSchema, Invoice, InvoiceSchema, Payment, PaymentSchema, Sale, SaleSchema } from "../schemas";
import { FiscalizationService } from "./fiscalization.service";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Module({
  imports: [
    NotificationsModule,
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: DebitNote.name, schema: DebitNoteSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Business.name, schema: BusinessSchema },
      { name: CreditNote.name, schema: CreditNoteSchema },
      { name: AuditLog.name, schema: AuditLogSchema }
      ,{ name: Sale.name, schema: SaleSchema }
    ])
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, FiscalizationService]
})
export class InvoicesModule {}
