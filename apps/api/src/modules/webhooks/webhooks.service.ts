import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Payment, PaymentDocument, PaymentReconciliationLog, PaymentReconciliationLogDocument, WebhookLog, WebhookLogDocument } from "../schemas";

@Injectable()
export class WebhooksService {
  constructor(
    @InjectModel(WebhookLog.name) private readonly webhookLogModel: Model<WebhookLogDocument>,
    @InjectModel(PaymentReconciliationLog.name) private readonly reconciliationLogModel: Model<PaymentReconciliationLogDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>
  ) {}

  async receiveTuma(payload: Record<string, unknown>) {
    const log = await this.webhookLogModel.create({ provider: "tuma", eventType: String(payload.eventType ?? "callback"), payload, status: "received" });
    const reference = String(payload.reference ?? payload.transactionId ?? "");
    await this.reconciliationLogModel.create({
      businessId: "unknown",
      paymentId: null,
      reference: reference || "unknown",
      status: "pending",
      payload
    });
    await this.webhookLogModel.findByIdAndUpdate(log._id, { status: "processed", error: "Callback was logged but not verified; no payment state or balance was changed" });
    return { ok: true, status: "pending_verification" };
  }

  logs(businessId: string) {
    return this.reconciliationLogModel.find({ businessId }).sort({ createdAt: -1 }).limit(100).lean();
  }
}
