import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BusinessNotification, BusinessNotificationDocument, Device, DeviceDocument } from "../schemas";

type NotificationPriority = "low" | "normal" | "high" | "critical";

export type CreateNotificationInput = {
  businessId: string;
  audienceUserId?: string | null;
  title: string;
  body: string;
  category: string;
  priority?: NotificationPriority;
  routeName?: string | null;
  routeParams?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  dedupeKey?: string | null;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(BusinessNotification.name) private readonly notificationModel: Model<BusinessNotificationDocument>,
    @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>
  ) {}

  async listInbox(businessId: string, userId: string) {
    return this.notificationModel
      .find({
        businessId,
        $or: [{ audienceUserId: null }, { audienceUserId: userId }]
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  async registerDevice(input: { businessId: string; deviceKey: string; deviceName: string; platform: "android" | "ios" | "web"; pushToken: string; userId: string }) {
    const now = new Date();
    return this.deviceModel
      .findOneAndUpdate(
        { businessId: input.businessId, deviceKey: input.deviceKey },
        {
          businessId: input.businessId,
          deviceKey: input.deviceKey,
          deviceName: input.deviceName,
          platform: input.platform,
          userId: input.userId,
          pushToken: input.pushToken,
          pushTokenUpdatedAt: now,
          lastSeenAt: now,
          trusted: true,
          deletedAt: null
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      .lean();
  }

  async markRead(businessId: string, userId: string, notificationId: string) {
    return this.notificationModel
      .findOneAndUpdate(
        { _id: notificationId, businessId, $or: [{ audienceUserId: null }, { audienceUserId: userId }] },
        { readAt: new Date() },
        { new: true }
      )
      .lean();
  }

  async createNotification(input: CreateNotificationInput) {
    if (input.dedupeKey) {
      const existing = await this.notificationModel.findOne({ businessId: input.businessId, dedupeKey: input.dedupeKey }).lean();
      if (existing) {
        return existing;
      }
    }

    const notification = await this.notificationModel.create({
      businessId: input.businessId,
      audienceUserId: input.audienceUserId ?? null,
      title: input.title,
      body: input.body,
      category: input.category,
      priority: input.priority ?? "normal",
      routeName: input.routeName ?? null,
      routeParams: input.routeParams ?? null,
      metadata: input.metadata ?? null,
      dedupeKey: input.dedupeKey ?? null,
      readAt: null,
      sentAt: new Date()
    });

    void this.sendPush(notification.toObject()).catch((error) => {
      this.logger.warn(`Push delivery failed for notification "${notification._id}": ${error instanceof Error ? error.message : String(error)}`);
    });

    return notification.toObject();
  }

  async createLowStockNotification(input: {
    businessId: string;
    productId: string;
    productName: string;
    stockOnHand: number;
    threshold: number;
    audienceUserId?: string | null;
    routeName?: string | null;
    routeParams?: Record<string, unknown> | null;
  }) {
    return this.createNotification({
      businessId: input.businessId,
      audienceUserId: input.audienceUserId ?? null,
      title: input.stockOnHand <= 0 ? "Critical stock shortage" : "Low stock alert",
      body:
        input.stockOnHand <= 0
          ? `${input.productName} is out of stock and needs urgent restocking.`
          : `${input.productName} is running low at ${input.stockOnHand} units. Reorder before stock runs out.`,
      category: "inventory",
      priority: input.stockOnHand <= 0 ? "critical" : "high",
      routeName: input.routeName ?? "ProductDetail",
      routeParams: input.routeParams ?? { productId: input.productId },
      metadata: {
        productId: input.productId,
        productName: input.productName,
        stockOnHand: input.stockOnHand,
        threshold: input.threshold
      },
      dedupeKey: `low-stock:${input.businessId}:${input.productId}`
    });
  }

  private async sendPush(notification: {
    _id: unknown;
    businessId: string;
    audienceUserId?: string | null;
    title: string;
    body: string;
    category: string;
    priority: NotificationPriority;
    routeName?: string | null;
    routeParams?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    sentAt: Date;
    createdAt?: Date;
  }) {
    const devices = await this.deviceModel
      .find({
        businessId: notification.businessId,
        deletedAt: null,
        pushToken: { $ne: null },
        ...(notification.audienceUserId ? { userId: notification.audienceUserId } : {})
      })
      .lean();
    const tokens = devices.map((device) => device.pushToken).filter((token): token is string => Boolean(token));
    if (!tokens.length) {
      return;
    }

    const messages = tokens.map((token) => ({
      to: token,
      sound: notification.priority === "critical" ? "default" : undefined,
      title: notification.title,
      body: notification.body,
      priority: notification.priority === "critical" ? "high" : "normal",
      channelId: "biz-pro",
      data: {
        notificationId: String(notification._id),
        businessId: notification.businessId,
        audienceUserId: notification.audienceUserId ?? null,
        category: notification.category,
        priority: notification.priority,
        routeName: notification.routeName ?? null,
        routeParams: notification.routeParams ?? null,
        metadata: notification.metadata ?? null,
        sentAt: (notification.sentAt ?? new Date()).toISOString(),
        createdAt: (notification.createdAt ?? new Date()).toISOString()
      }
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.EXPO_PUSH_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_PUSH_ACCESS_TOKEN}` } : {})
      },
      body: JSON.stringify(messages)
    });
    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(message || `Expo push request failed with status ${response.status}`);
    }
  }
}
