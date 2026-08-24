import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { IsIn, IsOptional, IsString } from "class-validator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { CurrentUser } from "../../common/current-user.decorator";
import { NotificationsService } from "./notifications.service";

class RegisterDevicePushDto {
  @IsString() businessId!: string;
  @IsString() deviceId!: string;
  @IsString() deviceName!: string;
  @IsIn(["android", "ios", "web"]) platform!: "android" | "ios" | "web";
  @IsString() pushToken!: string;
  @IsOptional() @IsString() userId?: string;
}

class CreateNotificationDto {
  @IsString() title!: string;
  @IsString() body!: string;
  @IsString() category!: string;
  @IsOptional() @IsString() routeName?: string;
}

@Controller("notifications")
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  })
)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: { businessId: string; sub: string }) {
    return this.notifications.listInbox(user.businessId, user.sub);
  }

  @Get("page")
  listPage(
    @CurrentUser() user: { businessId: string; sub: string },
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string
  ) {
    const input: { page: number; pageSize: number; search?: string } = {
      page: parsePositiveInt(page, 1),
      pageSize: Math.min(parsePositiveInt(pageSize, 20), 50)
    };
    const normalizedSearch = search?.trim();
    if (normalizedSearch) input.search = normalizedSearch;
    return this.notifications.listInboxPage(user.businessId, user.sub, input);
  }

  @Post("devices")
  registerDevice(@CurrentUser() user: { businessId: string; sub: string }, @Body() dto: RegisterDevicePushDto) {
    return this.notifications.registerDevice({
      businessId: user.businessId,
      deviceKey: dto.deviceId,
      deviceName: dto.deviceName,
      platform: dto.platform,
      pushToken: dto.pushToken,
      userId: dto.userId?.trim() || user.sub
    });
  }

  @Post()
  create(@CurrentUser() user: { businessId: string; sub: string }, @Body() dto: CreateNotificationDto) {
    return this.notifications.createNotification({
      businessId: user.businessId,
      audienceUserId: user.sub,
      title: dto.title,
      body: dto.body,
      category: dto.category,
      priority: "normal"
    });
  }

  @Patch("read-all")
  markAllRead(@CurrentUser() user: { businessId: string; sub: string }) {
    return this.notifications.markAllRead(user.businessId, user.sub);
  }

  @Patch(":id/read")
  markRead(@CurrentUser() user: { businessId: string; sub: string }, @Param("id") id: string) {
    return this.notifications.markRead(user.businessId, user.sub, id);
  }
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
