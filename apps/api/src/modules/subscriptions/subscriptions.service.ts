import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { PLAN_EMPLOYEE_LIMITS, PLAN_NAMES, PLAN_PRICING, type PlanTier } from "@vbo/shared";
import { Subscription, SubscriptionDocument, SubscriptionPlan, SubscriptionPlanDocument } from "../schemas";

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name) private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionPlan.name) private readonly planModel: Model<SubscriptionPlanDocument>
  ) {}

  plans() {
    return this.planModel.find({ active: true }).sort({ monthlyPrice: 1 }).lean();
  }

  async current(businessId: string) {
    const subscription = await this.subscriptionModel.findOne({ businessId }).sort({ createdAt: -1 });
    if (!subscription) return null;
    if (subscription.status === "TRIAL" && subscription.trialEndsAt && subscription.trialEndsAt <= new Date()) {
      subscription.status = "EXPIRED";
      await subscription.save();
    }
    return subscription.toObject();
  }

  setPlan(businessId: string, planCode: PlanTier) {
    return this.subscriptionModel.findOneAndUpdate(
      { businessId },
      {
        businessId,
        planCode,
        planName: PLAN_NAMES[planCode],
        monthlyPrice: PLAN_PRICING[planCode],
        employeeLimit: PLAN_EMPLOYEE_LIMITS[planCode],
        status: "ACTIVE",
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentStatus: "unpaid"
      },
      { upsert: true, new: true }
    );
  }
}
