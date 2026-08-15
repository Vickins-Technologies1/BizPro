import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { BUSINESS_TYPES, INDUSTRY_KEYS, USER_ROLES } from "@vbo/shared";
import type { BusinessType, IndustryKey, PlanTier, UserRole } from "@vbo/shared";

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

export class RegisterDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => trimString(value))
  businessId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => trimString(value))
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => trimString(value))
  ownerUserId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => trimString(value))
  ownerName!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(32)
  @Transform(({ value }) => trimString(value))
  phone!: string;

  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => trimString(value))
  businessName!: string;

  @IsOptional()
  @IsIn(INDUSTRY_KEYS)
  industryKey?: IndustryKey;

  @IsIn(BUSINESS_TYPES)
  businessType!: BusinessType;

  @IsIn(["lite", "standard", "pro"])
  planTier!: PlanTier;

  @IsString()
  @IsOptional()
  @MaxLength(3)
  @Transform(({ value }) => trimString(value))
  currency?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => trimString(value))
  branchName!: string;

  @IsOptional()
  @Matches(/^\d{4,8}$/)
  @Transform(({ value }) => trimString(value))
  cashierPin?: string;
}

export class LoginDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => trimString(value))
  identifier!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(128)
  passwordOrPin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => trimString(value))
  businessId?: string;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;
}
