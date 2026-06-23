import { IsArray, IsDateString, IsObject, IsOptional, IsString } from "class-validator";

export class SyncEventDto {
  @IsString() eventId!: string;
  @IsString() businessId!: string;
  @IsString() deviceId!: string;
  @IsString() entityType!: string;
  @IsString() entityId!: string;
  @IsString() action!: string;
  @IsObject() payload!: Record<string, unknown>;
  @IsDateString() createdAt!: string;
}

export class SyncPushDto {
  @IsString() businessId!: string;
  @IsString() deviceId!: string;
  @IsArray() events!: SyncEventDto[];
}
