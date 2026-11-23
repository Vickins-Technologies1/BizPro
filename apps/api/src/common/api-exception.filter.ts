import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { PlatformAdminService } from "../modules/platform-admin/platform-admin.service";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<any>();
    const response = context.getResponse<any>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    const requestId = request.requestId as string | undefined;
    const body = typeof raw === "string"
      ? { statusCode, message: raw }
      : raw && typeof raw === "object"
        ? { ...(raw as Record<string, unknown>), statusCode, ...(requestId ? { requestId } : {}) }
        : { statusCode, message: "Internal server error", ...(requestId ? { requestId } : {}) };

    if (statusCode >= 500) {
      const route = typeof request.route?.path === "string" ? `${request.baseUrl ?? ""}${request.route.path}` : "/unmatched";
      const message = exception instanceof Error ? exception.message : "Unhandled API error";
      void this.platformAdmin.ingestError({
        title: `${request.method} ${route} returned ${statusCode}`,
        message,
        severity: statusCode >= 500 ? "high" : "medium",
        source: "api",
        module: route,
        endpoint: route,
        httpStatus: statusCode,
        stackTrace: exception instanceof Error ? exception.stack : null,
        businessId: request.user?.businessId,
        requestId
      }).catch(() => undefined);
    }

    response.status(statusCode).json(body);
  }
}
