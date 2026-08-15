import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { BusinessesService } from "./businesses.service";
import { IsIn, IsOptional, IsString } from "class-validator";
import { BUSINESS_TYPES, INDUSTRY_KEYS, type BusinessType, type IndustryKey } from "@vbo/shared";
import { SupportKeyGuard } from "../../common/support-key.guard";

class CreateBusinessDto {
  @IsString() name!: string;
  @IsString() slug!: string;
  @IsOptional()
  @IsIn(INDUSTRY_KEYS)
  industryKey?: IndustryKey;
  @IsIn(BUSINESS_TYPES) businessType!: BusinessType;
  @IsString() @IsOptional() currency?: string;
  @IsIn(["lite", "standard", "pro"]) planTier!: any;
}

@Controller("businesses")
@UseGuards(SupportKeyGuard)
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Get()
  list() {
    return this.businesses.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.businesses.get(id);
  }

  @Post()
  create(@Body() dto: CreateBusinessDto) {
    return this.businesses.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: Partial<CreateBusinessDto>) {
    return this.businesses.update(id, body);
  }
}
