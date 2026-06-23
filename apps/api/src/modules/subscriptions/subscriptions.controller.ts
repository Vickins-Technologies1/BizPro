import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { IsIn, IsString } from "class-validator";
import { SubscriptionsService } from "./subscriptions.service";
import { SupportKeyGuard } from "../../common/support-key.guard";

class SetPlanDto {
  @IsString() businessId!: string;
  @IsIn(["lite", "standard", "pro"]) planCode!: any;
}

@Controller("subscriptions")
@UseGuards(SupportKeyGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get("plans")
  plans() {
    return this.subscriptions.plans();
  }

  @Get("current")
  current(@Query("businessId") businessId: string) {
    return this.subscriptions.current(businessId);
  }

  @Post("current")
  setPlan(@Body() dto: SetPlanDto) {
    return this.subscriptions.setPlan(dto.businessId, dto.planCode);
  }
}
