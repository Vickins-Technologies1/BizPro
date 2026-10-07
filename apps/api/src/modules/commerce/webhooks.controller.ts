import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { IsArray, IsString, IsUrl } from "class-validator";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { CommerceWebhooksService } from "./webhooks.service";

class CreateWebhookDto {
  @IsUrl({ require_tld: false }) url!: string;
  @IsArray() @IsString({ each: true }) events!: string[];
}

@Controller("commerce/webhooks")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommerceWebhooksController {
  constructor(private readonly webhooks: CommerceWebhooksService) {}

  @Get()
  @Roles("owner", "manager")
  list(@CurrentUser() user: { businessId: string }) { return this.webhooks.list(user.businessId); }

  @Post()
  @Roles("owner", "manager")
  create(@CurrentUser() user: { businessId: string }, @Body() dto: CreateWebhookDto) { return this.webhooks.register({ ...dto, businessId: user.businessId }); }

  @Post(":id/rotate")
  @Roles("owner", "manager")
  rotate(@CurrentUser() user: { businessId: string }, @Param("id") id: string) { return this.webhooks.rotate(user.businessId, id); }

  @Delete(":id")
  @Roles("owner", "manager")
  disable(@CurrentUser() user: { businessId: string }, @Param("id") id: string) { return this.webhooks.disable(user.businessId, id); }
}
