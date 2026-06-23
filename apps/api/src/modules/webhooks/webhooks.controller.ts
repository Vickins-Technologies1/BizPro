import { Body, Controller, Headers, Post, UnauthorizedException, UseGuards } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";
import { ConfigService } from "@nestjs/config";
import { SupportKeyGuard } from "../../common/support-key.guard";

@Controller("webhooks")
export class WebhooksController {
  constructor(
    private readonly webhooks: WebhooksService,
    private readonly config: ConfigService
  ) {}

  @Post("tuma")
  tuma(@Body() payload: Record<string, unknown>, @Headers("x-webhook-secret") secret?: string) {
    const expected = this.config.get<string>("TUMA_WEBHOOK_SECRET") ?? "";
    if (!expected || secret !== expected) {
      throw new UnauthorizedException("Invalid webhook secret");
    }
    return this.webhooks.receiveTuma(payload);
  }

  @Post("tuma/logs")
  @UseGuards(SupportKeyGuard)
  logs(@Body() body: { businessId: string }) {
    return this.webhooks.logs(body.businessId);
  }
}
