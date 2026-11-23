import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, IsObject } from "class-validator";
import { CreateEmployeeDto, ResetEmployeeCredentialsDto, UpdateEmployeeDto } from "../employees/employees.dto";
import { CurrentPlatformAdmin, PlatformAdminAuthGuard, PlatformAdminIdentity, PlatformAdminPermissions, PlatformAdminPermissionsGuard } from "../../common/platform-admin.guard";
import { PlatformAdminService } from "./platform-admin.service";
import { PlatformErrorIngestGuard, MobileErrorRateGuard } from "../../common/platform-error.guard";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { CurrentUser } from "../../common/current-user.decorator";

class BusinessPatchDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) name?: string;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @IsOptional() @IsString() @MaxLength(80) industryKey?: string | null;
}
class SuspendBusinessDto { @IsOptional() @IsString() @MaxLength(500) reason?: string; }
class PlanDto { @IsString() @MaxLength(40) planCode!: string; }
class ExtendDto { @Type(() => Number) @IsInt() @Min(1) @Max(365) days!: number; }
class ErrorUpdateDto {
  @IsOptional() @IsIn(["open", "investigating", "resolved"]) status?: string;
  @IsOptional() @IsString() @MaxLength(160) assignedTo?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) resolutionComment?: string | null;
}
class ErrorNoteDto { @IsString() @MinLength(1) @MaxLength(4000) body!: string; }
class TicketCreateDto {
  @IsOptional() @IsString() @MaxLength(160) businessId?: string | null;
  @IsString() @MinLength(1) @MaxLength(160) contactName!: string;
  @IsOptional() @IsEmail() contactEmail?: string | null;
  @IsIn(["technical", "payment", "subscription", "complaint", "other"]) category!: string;
  @IsOptional() @IsIn(["low", "normal", "high", "urgent"]) priority?: string;
  @IsString() @MinLength(1) @MaxLength(240) subject!: string;
  @IsString() @MinLength(1) @MaxLength(10000) description!: string;
}
class TicketUpdateDto {
  @IsOptional() @IsIn(["open", "in_progress", "waiting_customer", "resolved", "closed"]) status?: string;
  @IsOptional() @IsIn(["low", "normal", "high", "urgent"]) priority?: string;
  @IsOptional() @IsString() @MaxLength(200) assignedTo?: string | null;
}
class TicketNoteDto { @IsString() @MinLength(1) @MaxLength(4000) body!: string; }
class SettingsDto {
  @IsOptional() @IsBoolean() maintenanceMode?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) maintenanceMessage?: string | null;
  @IsOptional() @IsString() @MaxLength(80) latestAppVersion?: string | null;
  @IsOptional() @IsString() @MaxLength(80) minimumAppVersion?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) announcement?: string | null;
  @IsOptional() @IsObject() featureFlags?: Record<string, boolean>;
  @IsOptional() @IsObject() operationalLimits?: Record<string, number>;
}
class AdminUserUpdateDto {
  @IsOptional() @IsIn(["super_admin", "operations_admin", "finance_admin", "support_admin", "developer", "read_only"]) role?: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class AdminUserCreateDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsIn(["super_admin", "operations_admin", "finance_admin", "support_admin", "developer", "read_only"]) role!: string;
  @IsString() @MaxLength(512) passwordHash!: string;
}
class ErrorIngestDto {
  @IsOptional() @IsString() @MaxLength(240) title?: string;
  @IsString() @MaxLength(4000) message!: string;
  @IsOptional() @IsIn(["critical", "high", "medium", "low"]) severity?: string;
  @IsOptional() @IsIn(["api", "mobile", "admin", "database", "sync", "background", "payment", "integration"]) source?: string;
  @IsOptional() @IsString() @MaxLength(40) environment?: string;
  @IsOptional() @IsString() @MaxLength(120) module?: string;
  @IsOptional() @IsString() @MaxLength(240) endpoint?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(100) @Max(599) httpStatus?: number;
  @IsOptional() @IsString() @MaxLength(12000) stackTrace?: string;
  @IsOptional() @IsString() @MaxLength(160) businessId?: string;
  @IsOptional() @IsString() @MaxLength(160) deviceId?: string;
  @IsOptional() @IsString() @MaxLength(80) appVersion?: string;
}

@Controller("platform-admin")
@UseGuards(PlatformAdminAuthGuard, PlatformAdminPermissionsGuard)
export class PlatformAdminController {
  constructor(private readonly platform: PlatformAdminService) {}

  @Get("dashboard") @PlatformAdminPermissions("dashboard:view")
  dashboard(@Query("range") range?: string) { return this.platform.dashboard(range); }

  @Get("businesses") @PlatformAdminPermissions("businesses:view")
  businesses(@Query("page") page?: number, @Query("limit") limit?: number, @Query("search") search?: string, @Query("industry") industry?: string, @Query("status") status?: string, @Query("subscriptionStatus") subscriptionStatus?: string, @Query("from") from?: string, @Query("to") to?: string) {
    return this.platform.listBusinesses({ page, limit, search, industry, status, subscriptionStatus, from, to });
  }
  @Get("businesses/:id") @PlatformAdminPermissions("businesses:view")
  business(@Param("id") id: string) { return this.platform.businessDetail(id); }
  @Get("businesses/:id/activity") @PlatformAdminPermissions("businesses:view")
  businessActivity(@Param("id") id: string) { return this.platform.businessActivity(id); }
  @Patch("businesses/:id") @PlatformAdminPermissions("businesses:manage")
  updateBusiness(@Param("id") id: string, @Body() dto: BusinessPatchDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.updateBusiness(id, dto, admin, req.headers["x-request-id"]); }
  @Post("businesses/:id/suspend") @PlatformAdminPermissions("businesses:manage")
  suspendBusiness(@Param("id") id: string, @Body() dto: SuspendBusinessDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.suspendBusiness(id, dto.reason, admin, req.headers["x-request-id"]); }
  @Post("businesses/:id/restore") @PlatformAdminPermissions("businesses:manage")
  restoreBusiness(@Param("id") id: string, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.restoreBusiness(id, admin, req.headers["x-request-id"]); }

  @Get("businesses/:businessId/employees") @PlatformAdminPermissions("employees:view")
  employees(@Param("businessId") businessId: string) { return this.platform.listEmployees(businessId); }
  @Post("businesses/:businessId/employees") @PlatformAdminPermissions("employees:manage")
  createEmployee(@Param("businessId") businessId: string, @Body() dto: CreateEmployeeDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.createEmployee(businessId, dto, admin, req.headers["x-request-id"]); }
  @Patch("businesses/:businessId/employees/:employeeId") @PlatformAdminPermissions("employees:manage")
  updateEmployee(@Param("businessId") businessId: string, @Param("employeeId") employeeId: string, @Body() dto: UpdateEmployeeDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.changeEmployee(businessId, employeeId, "update", dto, admin, req.headers["x-request-id"]); }
  @Patch("businesses/:businessId/employees/:employeeId/suspend") @PlatformAdminPermissions("employees:manage")
  suspendEmployee(@Param("businessId") businessId: string, @Param("employeeId") employeeId: string, @Body() dto: SuspendBusinessDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.changeEmployee(businessId, employeeId, "suspend", dto, admin, req.headers["x-request-id"]); }
  @Patch("businesses/:businessId/employees/:employeeId/restore") @PlatformAdminPermissions("employees:manage")
  restoreEmployee(@Param("businessId") businessId: string, @Param("employeeId") employeeId: string, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.changeEmployee(businessId, employeeId, "restore", {}, admin, req.headers["x-request-id"]); }
  @Patch("businesses/:businessId/employees/:employeeId/reset-credentials") @PlatformAdminPermissions("employees:manage")
  resetEmployeeCredentials(@Param("businessId") businessId: string, @Param("employeeId") employeeId: string, @Body() dto: ResetEmployeeCredentialsDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.changeEmployee(businessId, employeeId, "reset", dto, admin, req.headers["x-request-id"]); }
  @Delete("businesses/:businessId/employees/:employeeId") @PlatformAdminPermissions("employees:manage")
  removeEmployee(@Param("businessId") businessId: string, @Param("employeeId") employeeId: string, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.removeEmployee(businessId, employeeId, admin, req.headers["x-request-id"]); }

  @Get("subscriptions") @PlatformAdminPermissions("subscriptions:view")
  subscriptions(@Query("page") page?: number, @Query("limit") limit?: number, @Query("status") status?: string, @Query("search") search?: string) { return this.platform.listSubscriptions({ page, limit, status, search }); }
  @Get("subscriptions/plans") @PlatformAdminPermissions("subscriptions:view")
  plans() { return this.platform.listPlans(); }
  @Get("payments") @PlatformAdminPermissions("payments:view")
  payments(@Query("page") page?: number, @Query("limit") limit?: number, @Query("businessId") businessId?: string, @Query("status") status?: string) { return this.platform.listReconciliationLogs({ page, limit, businessId, status }); }
  @Post("subscriptions/:businessId/plan") @PlatformAdminPermissions("subscriptions:manage")
  setPlan(@Param("businessId") businessId: string, @Body() dto: PlanDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.setSubscriptionPlan(businessId, dto.planCode, admin, req.headers["x-request-id"]); }
  @Post("subscriptions/:businessId/extend") @PlatformAdminPermissions("subscriptions:manage")
  extend(@Param("businessId") businessId: string, @Body() dto: ExtendDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.extendSubscription(businessId, dto.days, admin, req.headers["x-request-id"]); }

  @Get("devices") @PlatformAdminPermissions("devices:view")
  devices(@Query("page") page?: number, @Query("limit") limit?: number, @Query("search") search?: string, @Query("businessId") businessId?: string, @Query("status") status?: string) { return this.platform.listDevices({ page, limit, search, businessId, status }); }
  @Post("devices/:id/revoke") @PlatformAdminPermissions("devices:manage")
  revokeDevice(@Param("id") id: string, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.revokeDevice(id, admin, req.headers["x-request-id"]); }

  @Get("sync/events") @PlatformAdminPermissions("sync:view")
  syncEvents(@Query("page") page?: number, @Query("limit") limit?: number, @Query("status") status?: string, @Query("businessId") businessId?: string, @Query("deviceId") deviceId?: string, @Query("search") search?: string) { return this.platform.listSyncEvents({ page, limit, status, businessId, deviceId, search }); }
  @Post("sync/events/:id/retry") @PlatformAdminPermissions("sync:retry")
  retrySync(@Param("id") id: string, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.retrySyncEvent(id, admin, req.headers["x-request-id"]); }

  @Get("errors") @PlatformAdminPermissions("errors:view") errors(@Query("page") page?: number, @Query("limit") limit?: number, @Query("status") status?: string, @Query("severity") severity?: string, @Query("source") source?: string, @Query("search") search?: string) { return this.platform.listErrors({ page, limit, status, severity, source, search }); }
  @Get("incidents") @PlatformAdminPermissions("errors:view") incidents(@Query("page") page?: number, @Query("limit") limit?: number, @Query("status") status?: string, @Query("severity") severity?: string, @Query("source") source?: string, @Query("search") search?: string) { return this.platform.listErrors({ page, limit, status, severity, source, search }); }
  @Get("errors/:id") @PlatformAdminPermissions("errors:view") getError(@Param("id") id: string) { return this.platform.getError(id); }
  @Patch("errors/:id") @PlatformAdminPermissions("errors:manage") updateError(@Param("id") id: string, @Body() dto: ErrorUpdateDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.updateError(id, dto, admin, req.headers["x-request-id"]); }
  @Post("errors/:id/notes") @PlatformAdminPermissions("errors:manage") addErrorNote(@Param("id") id: string, @Body() dto: ErrorNoteDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.addErrorNote(id, dto.body, admin, req.headers["x-request-id"]); }

  @Get("health") @PlatformAdminPermissions("health:view") health() { return this.platform.health(); }
  @Get("api-metrics") @PlatformAdminPermissions("health:view") metrics(@Query("range") range?: string) { return this.platform.apiMetrics(range); }
  @Get("reports/:report") @PlatformAdminPermissions("reports:view") report(@Param("report") report: string, @Query("from") from?: string, @Query("to") to?: string) { return this.platform.report(report, from, to); }

  @Get("support/tickets") @PlatformAdminPermissions("support:view") tickets(@Query("page") page?: number, @Query("limit") limit?: number, @Query("status") status?: string, @Query("priority") priority?: string, @Query("search") search?: string) { return this.platform.listTickets({ page, limit, status, priority, search }); }
  @Post("support/tickets") @PlatformAdminPermissions("support:manage") createTicket(@Body() dto: TicketCreateDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.createTicket(dto, admin, req.headers["x-request-id"]); }
  @Patch("support/tickets/:id") @PlatformAdminPermissions("support:manage") updateTicket(@Param("id") id: string, @Body() dto: TicketUpdateDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.updateTicket(id, dto, admin, req.headers["x-request-id"]); }
  @Post("support/tickets/:id/notes") @PlatformAdminPermissions("support:manage") addTicketNote(@Param("id") id: string, @Body() dto: TicketNoteDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.addTicketNote(id, dto.body, admin, req.headers["x-request-id"]); }

  @Get("settings") @PlatformAdminPermissions("settings:view") settings() { return this.platform.getSettings(); }
  @Patch("settings") @PlatformAdminPermissions("settings:manage") updateSettings(@Body() dto: SettingsDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.updateSettings(dto, admin, req.headers["x-request-id"]); }
  @Get("audit") @PlatformAdminPermissions("audit:view") audit(@Query("page") page?: number, @Query("limit") limit?: number, @Query("actorId") actorId?: string, @Query("action") action?: string) { return this.platform.listAudit({ page, limit, actorId, action }); }
  @Get("audit/login-events") @PlatformAdminPermissions("audit:view") loginEvents(@Query("page") page?: number, @Query("limit") limit?: number, @Query("email") email?: string) { return this.platform.listLoginEvents({ page, limit, email }); }

  @Get("admin-users") @PlatformAdminPermissions("platform_users:view") adminUsers() { return this.platform.listAdminUsers(); }
  @Post("admin-users") @PlatformAdminPermissions("platform_users:manage") createAdminUser(@Body() dto: AdminUserCreateDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.createAdminUser(dto, admin, req.headers["x-request-id"]); }
  @Patch("admin-users/:id") @PlatformAdminPermissions("platform_users:manage") updateAdminUser(@Param("id") id: string, @Body() dto: AdminUserUpdateDto, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.updateAdminUser(id, dto, admin, req.headers["x-request-id"]); }
  @Post("admin-users/:id/revoke-sessions") @PlatformAdminPermissions("platform_users:manage") revokeAdminSessions(@Param("id") id: string, @CurrentPlatformAdmin() admin: PlatformAdminIdentity, @Req() req: any) { return this.platform.revokeAdminSessions(id, admin, req.headers["x-request-id"]); }
}

@Controller("platform-admin/errors")
@UseGuards(PlatformErrorIngestGuard)
export class PlatformErrorIngestController {
  constructor(private readonly platform: PlatformAdminService) {}
  @Post("ingest") ingest(@Body() dto: ErrorIngestDto, @Req() req: any) { return this.platform.ingestError({ ...dto, requestId: req.headers["x-request-id"] }); }
}

@Controller("telemetry/errors")
@UseGuards(JwtAuthGuard, MobileErrorRateGuard)
export class PlatformMobileErrorIngestController {
  constructor(private readonly platform: PlatformAdminService) {}
  @Post() ingest(@Body() dto: ErrorIngestDto, @CurrentUser() user: { sub: string; businessId: string }, @Req() req: any) {
    return this.platform.ingestError({ ...dto, source: "mobile", businessId: user.businessId, requestId: req.headers["x-request-id"] });
  }
}
