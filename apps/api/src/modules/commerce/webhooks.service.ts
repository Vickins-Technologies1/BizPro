import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes } from "node:crypto";
import { Model } from "mongoose";
import { CommerceWebhookDelivery, CommerceWebhookDeliveryDocument, CommerceWebhookEndpoint, CommerceWebhookEndpointDocument } from "../commerce.schemas";

@Injectable()
export class CommerceWebhooksService {
  constructor(
    @InjectModel(CommerceWebhookEndpoint.name) private readonly endpointModel: Model<CommerceWebhookEndpointDocument>,
    @InjectModel(CommerceWebhookDelivery.name) private readonly deliveryModel: Model<CommerceWebhookDeliveryDocument>,
    private readonly config: ConfigService
  ) {}

  async register(input: { businessId: string; url: string; events: string[] }) {
    const secret = randomBytes(32).toString("base64url");
    const endpoint = await this.endpointModel.create({ businessId: input.businessId, url: input.url, events: [...new Set(input.events)], secretCiphertext: this.encrypt(secret), secretVersion: 1, status: "ACTIVE" });
    return { id: String(endpoint._id), businessId: endpoint.businessId, url: endpoint.url, events: endpoint.events, status: endpoint.status, secret };
  }

  list(businessId: string) {
    return this.endpointModel.find({ businessId }).sort({ createdAt: -1 }).lean().then((rows) => rows.map((row) => ({ id: String(row._id), url: row.url, events: row.events, status: row.status, secretVersion: row.secretVersion, createdAt: (row as typeof row & { createdAt?: Date }).createdAt })));
  }

  async rotate(businessId: string, id: string) {
    const secret = randomBytes(32).toString("base64url");
    const endpoint = await this.endpointModel.findOneAndUpdate({ _id: id, businessId, status: "ACTIVE" }, { $set: { secretCiphertext: this.encrypt(secret) }, $inc: { secretVersion: 1 } }, { new: true }).lean();
    if (!endpoint) throw new NotFoundException("Webhook endpoint not found");
    return { id: String(endpoint._id), secret, secretVersion: endpoint.secretVersion };
  }

  async disable(businessId: string, id: string) {
    const endpoint = await this.endpointModel.findOneAndUpdate({ _id: id, businessId, status: "ACTIVE" }, { $set: { status: "DISABLED", disabledAt: new Date() } }, { new: true }).lean();
    if (!endpoint) throw new NotFoundException("Webhook endpoint not found");
    return { id: String(endpoint._id), status: endpoint.status };
  }

  async publish(input: { businessId: string; eventType: string; data: Record<string, unknown> }) {
    const endpoints = await this.endpointModel.find({ businessId: input.businessId, status: "ACTIVE", events: input.eventType }).lean();
    const eventId = randomBytes(16).toString("hex");
    const payload = { id: eventId, type: input.eventType, occurredAt: new Date().toISOString(), data: input.data };
    if (endpoints.length) {
      await this.deliveryModel.insertMany(endpoints.map((endpoint) => ({ businessId: input.businessId, endpointId: String(endpoint._id), eventId, eventType: input.eventType, payload, status: "PENDING", attemptCount: 0, nextAttemptAt: new Date() })), { ordered: false });
    }
    return { eventId, queued: endpoints.length };
  }

  async deliver(deliveryId: string) {
    const delivery = await this.deliveryModel.findById(deliveryId).lean();
    if (!delivery) throw new NotFoundException("Webhook delivery not found");
    const endpoint = await this.endpointModel.findOne({ _id: delivery.endpointId, status: "ACTIVE" }).select("+secretCiphertext").lean();
    if (!endpoint) return { status: "SKIPPED" };
    const body = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", this.decrypt(endpoint.secretCiphertext)).update(`${timestamp}.${body}`).digest("hex");
    try {
      const response = await fetch(endpoint.url, { method: "POST", headers: { "content-type": "application/json", "x-dira-event-id": delivery.eventId, "x-dira-timestamp": timestamp, "x-dira-signature": `sha256=${signature}` }, body });
      if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`);
      await this.deliveryModel.updateOne({ _id: delivery._id }, { $set: { status: "DELIVERED", deliveredAt: new Date(), lastResponseStatus: response.status }, $inc: { attemptCount: 1 } });
      return { status: "DELIVERED" };
    } catch (error) {
      const attemptCount = Number(delivery.attemptCount ?? 0) + 1;
      await this.deliveryModel.updateOne({ _id: delivery._id }, { $set: { status: attemptCount >= 8 ? "FAILED" : "PENDING", lastError: error instanceof Error ? error.message : String(error), nextAttemptAt: new Date(Date.now() + Math.min(60 * 60 * 1000, 2 ** attemptCount * 1000)) }, $inc: { attemptCount: 1 } });
      return { status: "FAILED", retryable: attemptCount < 8 };
    }
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
  }

  private decrypt(value: string) {
    const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(ivRaw!, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw!, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedRaw!, "base64url")), decipher.final()]).toString("utf8");
  }

  private encryptionKey() {
    return createHash("sha256").update(this.config.get<string>("COMMERCE_WEBHOOK_ENCRYPTION_KEY") ?? this.config.getOrThrow<string>("JWT_SECRET")).digest();
  }
}
