import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { CommerceCredentialsService } from "./credentials.service";
import { COMMERCE_SCOPES } from "./commerce.helpers";

class CreateCredentialDto {
  @IsString() name!: string;
  @IsArray() @IsString({ each: true }) @IsIn(COMMERCE_SCOPES, { each: true }) scopes!: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) branchIds?: string[];
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsNumber() @Min(1) rateLimitPerMinute?: number;
}

@Controller("commerce/credentials")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommerceCredentialsController {
  constructor(private readonly credentials: CommerceCredentialsService) {}

  @Get()
  @Roles("owner", "manager")
  list(@CurrentUser() user: { businessId: string }) { return this.credentials.list(user.businessId); }

  @Post()
  @Roles("owner")
  create(@CurrentUser() user: { businessId: string }, @Body() dto: CreateCredentialDto) {
    return this.credentials.create({ ...dto, businessId: user.businessId, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null });
  }

  @Post(":keyId/rotate")
  @Roles("owner")
  rotate(@CurrentUser() user: { businessId: string }, @Param("keyId") keyId: string) { return this.credentials.rotate(user.businessId, keyId); }

  @Delete(":keyId")
  @Roles("owner")
  revoke(@CurrentUser() user: { businessId: string }, @Param("keyId") keyId: string) { return this.credentials.revoke(user.businessId, keyId); }
}
