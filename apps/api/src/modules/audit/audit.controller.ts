import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { SupportKeyGuard } from "../../common/support-key.guard";

@Controller("audit")
@UseGuards(SupportKeyGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query("businessId") businessId: string) {
    return this.audit.list(businessId);
  }
}
