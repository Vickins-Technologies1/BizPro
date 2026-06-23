import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard } from "../../common/roles.guard";
import { Roles } from "../../common/roles.decorator";
import { CurrentUser } from "../../common/current-user.decorator";

@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("summary")
  @Roles("owner", "manager")
  summary(@CurrentUser() user: { businessId: string }, @Query("from") from?: string, @Query("to") to?: string) {
    return this.reports.summary(user.businessId, from, to);
  }

  @Get("top-products")
  @Roles("owner", "manager")
  topProducts(@CurrentUser() user: { businessId: string }) {
    return this.reports.topProducts(user.businessId);
  }

  @Get("payment-breakdown")
  @Roles("owner", "manager")
  paymentBreakdown(@CurrentUser() user: { businessId: string }) {
    return this.reports.paymentBreakdown(user.businessId);
  }
}
