import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Device, DeviceDocument } from "../schemas";

@Injectable()
export class DevicesService {
  constructor(@InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>) {}

  list(businessId: string) {
    return this.deviceModel.find({ businessId, deletedAt: null }).sort({ updatedAt: -1 }).lean();
  }

  register(input: Partial<Device> & { businessId: string; deviceName: string; platform: Device["platform"] }) {
    return this.deviceModel.create({ ...input, trusted: false, deletedAt: null });
  }

  trust(id: string) {
    return this.deviceModel.findByIdAndUpdate(id, { trusted: true, lastSeenAt: new Date() }, { new: true }).lean();
  }
}
