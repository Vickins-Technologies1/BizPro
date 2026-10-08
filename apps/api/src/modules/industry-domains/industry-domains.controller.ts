import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { IndustryDomainsService } from "./industry-domains.service";

class DomainPatchDto {
  @IsOptional() @IsString() branchId?: string | null;
  [key: string]: unknown;
}
type DomainPath = "room-types" | "rooms" | "reservations" | "stays" | "room-charges" | "patients" | "visits" | "matters" | "tasks" | "time-entries";

@Controller("industry")
@UseGuards(JwtAuthGuard, RolesGuard)
export class IndustryDomainsController {
  constructor(private readonly domains: IndustryDomainsService) {}

  @Get("summary")
  @Roles("owner", "manager", "cashier", "receptionist", "stylist", "mechanic", "pharmacist")
  summary(@CurrentUser() user: { businessId: string; branchId?: string | null }, @Query("branchId") branchId?: string) {
    return this.domains.summary(user.businessId, { branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post("reservations/:id/check-in")
  @Roles("owner", "manager", "receptionist")
  checkIn(@Param("id") id: string, @CurrentUser() user: { businessId: string }) { return this.domains.checkIn(user.businessId, id); }

  @Post("stays/:id/check-out")
  @Roles("owner", "manager", "receptionist")
  checkOut(@Param("id") id: string, @CurrentUser() user: { businessId: string }) { return this.domains.checkOut(user.businessId, id); }

  @Get(":domain")
  @Roles("owner", "manager", "cashier", "receptionist", "stylist", "mechanic", "pharmacist")
  list(@Param("domain") domain: DomainPath, @CurrentUser() user: { businessId: string; branchId?: string | null }, @Query("branchId") branchId?: string) {
    return this.domains.list(domain, user.businessId, { branchId: user.branchId ?? null, requestedBranchId: branchId ?? null });
  }

  @Post(":domain")
  @Roles("owner", "manager", "receptionist", "pharmacist")
  create(@Param("domain") domain: DomainPath, @CurrentUser() user: { businessId: string }, @Body() body: Record<string, unknown>) {
    return this.domains.create(domain, user.businessId, body);
  }

  @Patch(":domain/:id")
  @Roles("owner", "manager", "receptionist", "pharmacist")
  update(@Param("domain") domain: DomainPath, @Param("id") id: string, @CurrentUser() user: { businessId: string }, @Body() body: DomainPatchDto) {
    return this.domains.update(domain, user.businessId, id, body);
  }

  @Post(":domain/:id/archive")
  @Roles("owner", "manager")
  archive(@Param("domain") domain: DomainPath, @Param("id") id: string, @CurrentUser() user: { businessId: string }) {
    return this.domains.archive(domain, user.businessId, id);
  }
}
