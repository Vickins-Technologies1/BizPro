import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuditLog, AuditLogDocument } from "../schemas";

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>) {}

  list(businessId: string) {
    return this.auditLogModel.find({ businessId }).sort({ createdAt: -1 }).limit(100).lean();
  }
}
