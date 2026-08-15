import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("enterprise")
  @Roles("owner", "manager")
  enterprise(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }, @Query("from") from?: string, @Query("to") to?: string, @Query("branchId") branchId?: string) {
    return this.analytics.enterprise(user.businessId, from, to, { role: user.role ?? null, branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }
}
