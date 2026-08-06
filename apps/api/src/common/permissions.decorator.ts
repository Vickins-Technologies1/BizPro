import { SetMetadata } from "@nestjs/common";
import type { AccessPermission } from "@vbo/shared";

export const PERMISSIONS_KEY = "permissions";
export const Permissions = (...permissions: AccessPermission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
