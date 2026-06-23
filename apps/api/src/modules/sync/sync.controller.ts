import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsDateString, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { SyncService } from "./sync.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard } from "../../common/roles.guard";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";
import { SupportKeyGuard } from "../../common/support-key.guard";

class SyncPushEventDto {
  @IsString() eventId!: string;
  @IsString() entityType!: string;
  @IsString() entityId!: string;
  @IsString() action!: string;
  @IsObject()
  payload!: Record<string, unknown>;
  @IsDateString() createdAt!: string;
}

class SyncPushRequestDto {
  @IsString() businessId!: string;
  @IsString() deviceId!: string;
  @Type(() => SyncPushEventDto)
  @ValidateNested({ each: true })
  @IsArray() events!: SyncPushEventDto[];
}

@Controller("sync")
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post("push")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "manager", "cashier")
  push(@CurrentUser() user: { businessId: string }, @Body() dto: SyncPushRequestDto) {
    return this.sync.push(user.businessId, dto.deviceId, dto.events);
  }

  @Get("pull")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "manager", "cashier")
  pull(@CurrentUser() user: { businessId: string }, @Query("deviceId") deviceId: string, @Query("since") since?: string) {
    return this.sync.pull(user.businessId, deviceId, since);
  }

  @Get("health")
  @UseGuards(SupportKeyGuard)
  health(@Query("businessId") businessId: string) {
    return this.sync.health(businessId);
  }
}
