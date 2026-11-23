import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { randomUUID } from "node:crypto";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { PlatformAdminService } from "./modules/platform-admin/platform-admin.service";

const HOST = "0.0.0.0";
const DEFAULT_PORT = 8080;
const bootstrapLogger = new Logger("Bootstrap");

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const express = app.getHttpAdapter().getInstance();
  const platformAdmin = app.get(PlatformAdminService);
  let maintenanceCache: { enabled: boolean; message: string | null; expiresAt: number } = { enabled: false, message: null, expiresAt: 0 };
  let maintenanceRead: Promise<void> | null = null;

  express.set("trust proxy", 1);
  app.enableCors(buildCorsOptions());
  app.setGlobalPrefix("api");
  app.use((request: any, response: any, next: (error?: unknown) => void) => {
    const supplied = String(request.headers["x-request-id"] ?? "");
    const requestId = /^[A-Za-z0-9._:-]{1,128}$/.test(supplied) ? supplied : randomUUID();
    const startedAt = Date.now();
    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);
    response.once("finish", () => {
      if (!String(request.path ?? "").startsWith("/api/")) return;
      const route = typeof request.route?.path === "string" ? `${request.baseUrl ?? ""}${request.route.path}` : "/unmatched";
      void platformAdmin.recordRequestMetric({ route, method: request.method, statusCode: response.statusCode, durationMs: Date.now() - startedAt }).catch(() => undefined);
    });
    const path = String(request.path ?? "");
    const bypassMaintenance = !path.startsWith("/api/")
      || path.startsWith("/api/platform-admin/")
      || path === "/api/telemetry/errors"
      || path.startsWith("/api/auth/");
    if (bypassMaintenance) { next(); return; }
    void readMaintenanceState().then(() => {
      if (!maintenanceCache.enabled) { next(); return; }
      response.status(503).setHeader("retry-after", "60").json({
        statusCode: 503,
        message: maintenanceCache.message || "DIRA OS is temporarily unavailable for maintenance.",
        maintenanceMode: true,
        requestId
      });
    });
  });

  function readMaintenanceState() {
    if (Date.now() < maintenanceCache.expiresAt) return Promise.resolve();
    if (!maintenanceRead) {
      maintenanceRead = platformAdmin.getSettings().then((settings) => {
        maintenanceCache = {
          enabled: settings.maintenanceMode === true,
          message: typeof settings.maintenanceMessage === "string" ? settings.maintenanceMessage.trim().slice(0, 1000) : null,
          expiresAt: Date.now() + 5_000
        };
      }).catch(() => {
        maintenanceCache = { enabled: false, message: null, expiresAt: Date.now() + 1_000 };
      }).finally(() => { maintenanceRead = null; });
    }
    return maintenanceRead;
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidUnknownValues: false,
      transform: true
    })
  );
  app.useGlobalFilters(new ApiExceptionFilter(platformAdmin));
  express.get("/health", (_request: unknown, response: { status: (statusCode: number) => { json: (body: { status: string }) => void } }) => {
    response.status(200).json({ status: "ok" });
  });

  const port = resolvePort();
  await app.listen(port, HOST);
  bootstrapLogger.log(`Dira OS API running on ${HOST}:${port}`);

  const shutdown = async (signal: NodeJS.Signals) => {
    bootstrapLogger.log(`${signal} received. Shutting down Dira OS API...`);
    await app.close();
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

bootstrap().catch((error: unknown) => {
  bootstrapLogger.error(
    `Failed to start Dira OS API: ${error instanceof Error ? error.message : String(error)}`,
    error instanceof Error ? error.stack : undefined
  );
  process.exit(1);
});

function resolvePort() {
  const rawPort = Number(process.env.PORT ?? DEFAULT_PORT);
  return Number.isInteger(rawPort) && rawPort > 0 ? rawPort : DEFAULT_PORT;
}

function buildCorsOptions() {
  const configuredOrigins = process.env.CORS_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [];
  if (!configuredOrigins.length) {
    if (process.env.NODE_ENV === "production") {
      return {
        origin: false,
        credentials: true
      };
    }

    return {
      origin: true,
      credentials: true
    };
  }

  return {
    origin: configuredOrigins,
    credentials: true
  };
}
