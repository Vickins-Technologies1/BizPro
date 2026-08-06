import { ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { ACCESS_PERMISSIONS, USER_ROLES } from "@vbo/shared";
import type { AccessPermission, UserRole } from "@vbo/shared";

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @MinLength(6)
  password!: string;

  @IsOptional()
  @MinLength(4)
  pin?: string;

  @IsIn(USER_ROLES)
  role!: UserRole;

  @IsOptional()
  @IsString()
  roleLabel?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ACCESS_PERMISSIONS, { each: true })
  permissions?: AccessPermission[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  branchId?: string | null;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;

  @IsOptional()
  @IsString()
  roleLabel?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ACCESS_PERMISSIONS, { each: true })
  permissions?: AccessPermission[] | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetEmployeeCredentialsDto {
  @IsOptional()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @MinLength(4)
  pin?: string;
}
