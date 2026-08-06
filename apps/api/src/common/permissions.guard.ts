import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AccessPermission } from "@vbo/shared";
import { getEffectivePermissions } from "@vbo/shared";
import { PERMISSIONS_KEY } from "./permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permissions = this.reflector.getAllAndOverride<AccessPermission[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!permissions || !permissions.length) return true;
    const request = context.switchToHttp().getRequest();
    const effectivePermissions = getEffectivePermissions(request.user);
    return permissions.every((permission) => effectivePermissions.includes(permission));
  }
}
