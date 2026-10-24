import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import nodemailer, { Transporter } from "nodemailer";
import { EmailOutbox, EmailOutboxDocument, EmailTemplate } from "./email.schemas";
import { normalizeEmailAddress, renderEmail } from "./email-templates";

export type EnqueueEmailInput = {
  to: string;
  template: EmailTemplate;
  variables?: Record<string, unknown>;
  idempotencyKey: string;
  businessId?: string | null;
};

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private worker: ReturnType<typeof setInterval> | null = null;
  private pumping = false;
  private enabled = false;
  private readonly pollIntervalMs = 5000;

  constructor(
    @InjectModel(EmailOutbox.name) private readonly outboxModel: Model<EmailOutboxDocument>,
    private readonly config: ConfigService
  ) {}

  async onModuleInit() {
    this.enabled = parseBoolean(this.config.get<string>("MAIL_ENABLED"), false);
    if (!this.enabled) {
      this.logger.warn("Email delivery is disabled. Set MAIL_ENABLED=true with valid SMTP settings to enable it.");
      return;
    }
    const settings = this.readSmtpSettings();
    this.transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      requireTLS: !settings.secure,
      ...(settings.user ? { auth: { user: settings.user, pass: settings.password! } } : {}),
      connectionTimeout: settings.timeout,
      greetingTimeout: settings.timeout,
      socketTimeout: settings.timeout,
      tls: { minVersion: "TLSv1.2" }
    });
    try {
      await this.transporter.verify();
      this.logger.log("SMTP transport verified.");
    } catch (error) {
      const code = safeErrorCode(error);
      this.logger.warn(`SMTP transport verification failed${code ? ` (code ${code})` : ""}; queued messages will retry delivery.`);
    }
    const staleProcessingBefore = new Date(Date.now() - 5 * 60 * 1000);
    await this.outboxModel.updateMany(
      { state: "processing", $or: [{ lockedAt: null }, { lockedAt: { $lte: staleProcessingBefore } }] },
      { $set: { state: "retrying", availableAt: new Date() }, $unset: { lockedAt: 1 } }
    );
    this.worker = setInterval(() => void this.drain().catch((error) => this.logger.error(`Email outbox worker failed${safeErrorCode(error) ? ` (code ${safeErrorCode(error)})` : ""}.`)), this.pollIntervalMs);
    this.worker.unref?.();
    void this.drain().catch(() => this.logger.warn("Email outbox drain failed; the scheduled worker will retry."));
  }

  onModuleDestroy() {
    if (this.worker) clearInterval(this.worker);
    this.transporter?.close();
    this.transporter = null;
  }

  async enqueue(input: EnqueueEmailInput) {
    if (!this.enabled || !this.transporter) throw new ServiceUnavailableException("Email delivery is not configured.");
    const to = normalizeEmailAddress(input.to);
    const idempotencyKey = input.idempotencyKey.trim();
    if (!idempotencyKey || idempotencyKey.length > 200 || /[\r\n]/.test(idempotencyKey)) {
      throw new Error("A valid email idempotency key is required.");
    }
    try {
      const created = await this.outboxModel.create({
        to,
        template: input.template,
        variables: input.variables ?? {},
        idempotencyKey,
        businessId: input.businessId ?? null,
        state: "pending",
        attempts: 0,
        availableAt: new Date(),
        expiresAt: null
      });
      void this.drain().catch(() => this.logger.warn("Email outbox drain failed; the scheduled worker will retry."));
      return { id: String(created._id), state: "pending" as const, duplicate: false };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const existing = await this.outboxModel.findOne({ idempotencyKey }).select("_id state").lean();
        if (existing) return { id: String(existing._id), state: existing.state, duplicate: true };
      }
      throw error;
    }
  }

  isEnabled() {
    return this.enabled && Boolean(this.transporter);
  }

  async getDeliveryHealth() {
    const counts = await this.outboxModel.aggregate([{ $group: { _id: "$state", count: { $sum: 1 } } }]);
    return {
      enabled: this.enabled,
      smtpVerified: Boolean(this.transporter),
      deliveries: Object.fromEntries(counts.map((row: { _id: string; count: number }) => [row._id, row.count]))
    };
  }

  private readSmtpSettings() {
    const host = this.config.get<string>("SMTP_HOST")?.trim();
    const port = Number(this.config.get<string>("SMTP_PORT") ?? 587);
    const secure = parseBoolean(this.config.get<string>("SMTP_SECURE"), port === 465);
    const user = this.config.get<string>("SMTP_USER")?.trim();
    const password = this.config.get<string>("SMTP_PASS");
    const timeout = Number(this.config.get<string>("MAIL_TIMEOUT_MS") ?? 15000);
    const fromAddress = this.config.get<string>("MAIL_FROM_ADDRESS")?.trim();
    if (!host) throw new Error("MAIL_ENABLED=true requires SMTP_HOST.");
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT must be an integer between 1 and 65535.");
    if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 120000) throw new Error("MAIL_TIMEOUT_MS must be between 1000 and 120000.");
    if ((user && !password) || (!user && password)) throw new Error("SMTP_USER and SMTP_PASS must be configured together.");
    if (!fromAddress) throw new Error("MAIL_ENABLED=true requires MAIL_FROM_ADDRESS.");
    let from: string;
    let replyTo: string | undefined;
    try {
      from = normalizeEmailAddress(fromAddress);
      const configuredReplyTo = this.config.get<string>("MAIL_REPLY_TO")?.trim();
      replyTo = configuredReplyTo ? normalizeEmailAddress(configuredReplyTo) : undefined;
    } catch {
      throw new Error("MAIL_FROM_ADDRESS and MAIL_REPLY_TO must contain valid email addresses.");
    }
    const fromName = this.config.get<string>("MAIL_FROM_NAME")?.trim() || "Dira OS";
    if (/[\r\n]/.test(fromName)) throw new Error("MAIL_FROM_NAME cannot contain line breaks.");
    const maxRetries = Number(this.config.get<string>("MAIL_MAX_RETRIES") ?? 5);
    if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 10) throw new Error("MAIL_MAX_RETRIES must be an integer from 0 to 10.");
    return { host, port, secure, user, password, timeout, fromAddress: from, fromName, replyTo, maxRetries };
  }

  private async drain() {
    if (this.pumping || !this.transporter) return;
    this.pumping = true;
    try {
      for (let index = 0; index < 10; index += 1) {
        const now = new Date();
        const job = await this.outboxModel.findOneAndUpdate(
          { state: { $in: ["pending", "retrying"] }, availableAt: { $lte: now } },
          { $set: { state: "processing", lockedAt: now } },
          { sort: { availableAt: 1, createdAt: 1 }, new: true }
        );
        if (!job) break;
        await this.deliver(job);
      }
    } finally {
      this.pumping = false;
    }
  }

  private async deliver(job: EmailOutboxDocument) {
    const smtp = this.readSmtpSettings();
    try {
      const rendered = renderEmail(job.template, job.variables ?? {});
      await this.transporter!.sendMail({
        from: { name: smtp.fromName, address: smtp.fromAddress },
        ...(smtp.replyTo ? { replyTo: smtp.replyTo } : {}),
        to: job.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text
      });
      await this.outboxModel.updateOne({ _id: job._id, state: "processing" }, { $set: { state: "sent", sentAt: new Date(), lastError: null, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, $unset: { lockedAt: 1 } });
      this.logger.log(`Email delivery sent id="${String(job._id)}" template="${job.template}".`);
    } catch (error) {
      const attempts = Number(job.attempts ?? 0) + 1;
      const exhausted = attempts > smtp.maxRetries;
      const delay = Math.min(60 * 60 * 1000, 1000 * 2 ** Math.min(attempts, 12));
      await this.outboxModel.updateOne(
        { _id: job._id, state: "processing" },
        { $set: { state: exhausted ? "failed" : "retrying", attempts, availableAt: new Date(Date.now() + delay), lastError: safeErrorCode(error) ?? "delivery_failed", ...(exhausted ? { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } : {}) }, $unset: { lockedAt: 1 } }
      );
      this.logger.warn(`Email delivery ${exhausted ? "failed" : "scheduled for retry"} id="${String(job._id)}" template="${job.template}" attempt=${attempts}${safeErrorCode(error) ? ` code="${safeErrorCode(error)}"` : ""}.`);
    }
  }
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === "") return fallback;
  if (["true", "1", "yes"].includes(value.trim().toLowerCase())) return true;
  if (["false", "0", "no"].includes(value.trim().toLowerCase())) return false;
  throw new Error("Boolean mail configuration values must be true or false.");
}

function safeErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code ?? "");
    return /^[A-Z0-9_-]{1,40}$/i.test(code) ? code : null;
  }
  return null;
}

function isDuplicateKeyError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === 11000);
}
