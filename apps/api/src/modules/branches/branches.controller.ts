import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { PermissionsGuard } from "../../common/permissions.guard";
import { Permissions } from "../../common/permissions.decorator";
import { CurrentUser } from "../../common/current-user.decorator";
import { BranchesService } from "./branches.service";

class CreateBranchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  managerId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}

class UpdateBranchDto extends CreateBranchDto {}

@Controller("branches")
@UseGuards(JwtAuthGuard)
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  list(@CurrentUser() user: { businessId: string; role?: string; branchId?: string | null }) {
    return this.branches.list(user.businessId, { role: user.role ?? null, branchId: user.branchId ?? null });
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions("manageBranches")
  create(
    @CurrentUser() user: { sub: string; businessId: string; role?: string | null; branchId?: string | null },
    @Body() dto: CreateBranchDto
  ) {
    return this.branches.create(
      { sub: user.sub, businessId: user.businessId, role: user.role ?? null, branchId: user.branchId ?? null },
      {
        businessId: user.businessId,
        name: dto.name,
        code: dto.code,
        location: dto.location ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        managerId: dto.managerId ?? null,
        description: dto.description ?? null,
        status: dto.status ?? "active"
      }
    );
  }

  @Patch(":id")
  @UseGuards(PermissionsGuard)
  @Permissions("manageBranches")
  update(
    @CurrentUser() user: { sub: string; businessId: string; role?: string | null; branchId?: string | null },
    @Param("id") id: string,
    @Body() dto: Partial<UpdateBranchDto>
  ) {
    return this.branches.update(
      { sub: user.sub, businessId: user.businessId, role: user.role ?? null, branchId: user.branchId ?? null },
      id,
      dto
    );
  }

  @Post(":id/deactivate")
  @UseGuards(PermissionsGuard)
  @Permissions("manageBranches")
  deactivate(@CurrentUser() user: { sub: string; businessId: string; role?: string | null; branchId?: string | null }, @Param("id") id: string) {
    return this.branches.deactivate(
      { sub: user.sub, businessId: user.businessId, role: user.role ?? null, branchId: user.branchId ?? null },
      id
    );
  }

  @Post(":id/activate")
  @UseGuards(PermissionsGuard)
  @Permissions("manageBranches")
  activate(@CurrentUser() user: { sub: string; businessId: string; role?: string | null; branchId?: string | null }, @Param("id") id: string) {
    return this.branches.activate(
      { sub: user.sub, businessId: user.businessId, role: user.role ?? null, branchId: user.branchId ?? null },
      id
    );
  }
}
