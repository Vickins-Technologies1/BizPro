import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class SupportKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = String(request.headers["x-support-key"] ?? "");
    const expected = this.config.get<string>("SUPPORT_API_KEY") ?? "";
    if (!expected || provided !== expected) {
      throw new UnauthorizedException("Invalid support key");
    }
    return true;
  }
}
