import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { businessSchemas, opsSchemas, subscriptionSchemas, syncSchemas } from "../schemas";
import { BusinessesModule } from "../businesses/businesses.module";
import { DevicesModule } from "../devices/devices.module";
import { EmployeesModule } from "../employees/employees.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { SyncModule } from "../sync/sync.module";
import { PlatformAdminAuthGuard, PlatformAdminPermissionsGuard } from "../../common/platform-admin.guard";
import { MobileErrorRateGuard, PlatformErrorIngestGuard } from "../../common/platform-error.guard";
import { PlatformAdminController, PlatformErrorIngestController, PlatformMobileErrorIngestController } from "./platform-admin.controller";
import {
  PlatformAdminAuditLog, PlatformAdminAuditLogSchema, PlatformAdminLoginEvent, PlatformAdminLoginEventSchema,
  PlatformRequestMetric, PlatformRequestMetricSchema, PlatformSettings, PlatformSettingsSchema,
  PlatformSupportTicket, PlatformSupportTicketSchema, PlatformSystemError, PlatformSystemErrorSchema
} from "./platform-admin.schemas";
import { PlatformAdminService } from "./platform-admin.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      ...businessSchemas, ...opsSchemas, ...subscriptionSchemas, ...syncSchemas,
      { name: PlatformAdminAuditLog.name, schema: PlatformAdminAuditLogSchema },
      { name: PlatformAdminLoginEvent.name, schema: PlatformAdminLoginEventSchema },
      { name: PlatformSystemError.name, schema: PlatformSystemErrorSchema },
      { name: PlatformRequestMetric.name, schema: PlatformRequestMetricSchema },
      { name: PlatformSettings.name, schema: PlatformSettingsSchema },
      { name: PlatformSupportTicket.name, schema: PlatformSupportTicketSchema }
    ]),
    BusinessesModule, EmployeesModule, DevicesModule, SubscriptionsModule, SyncModule
  ],
  controllers: [PlatformAdminController, PlatformErrorIngestController, PlatformMobileErrorIngestController],
  providers: [PlatformAdminService, PlatformAdminAuthGuard, PlatformAdminPermissionsGuard, PlatformErrorIngestGuard, MobileErrorRateGuard],
  exports: [PlatformAdminService]
})
export class PlatformAdminModule {}
