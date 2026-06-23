import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { IsIn, IsOptional, IsString } from "class-validator";
import { DevicesService } from "./devices.service";
import { SupportKeyGuard } from "../../common/support-key.guard";

class RegisterDeviceDto {
  @IsString() businessId!: string;
  @IsString() deviceName!: string;
  @IsIn(["android", "ios", "web"]) platform!: any;
  @IsOptional() @IsString() lastSeenAt?: string;
}

@Controller("devices")
@UseGuards(SupportKeyGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  list(@Query("businessId") businessId: string) {
    return this.devices.list(businessId);
  }

  @Post()
  register(@Body() dto: RegisterDeviceDto) {
    return this.devices.register({
      businessId: dto.businessId,
      deviceName: dto.deviceName,
      platform: dto.platform,
      ...(dto.lastSeenAt ? { lastSeenAt: new Date(dto.lastSeenAt) } : {})
    });
  }

  @Post(":id/trust")
  trust(@Param("id") id: string) {
    return this.devices.trust(id);
  }
}
