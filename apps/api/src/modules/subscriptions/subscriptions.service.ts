import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
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

  current(businessId: string) {
    return this.subscriptionModel.findOne({ businessId }).sort({ createdAt: -1 }).lean();
  }

  setPlan(businessId: string, planCode: "lite" | "standard" | "pro") {
    return this.subscriptionModel.findOneAndUpdate(
      { businessId },
      { businessId, planCode, status: "active", expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      { upsert: true, new: true }
    );
  }
}
