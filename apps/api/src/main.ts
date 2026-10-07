import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const HOST = "0.0.0.0";
const DEFAULT_PORT = 8080;
const bootstrapLogger = new Logger("Bootstrap");

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const express = app.getHttpAdapter().getInstance();

  express.set("trust proxy", 1);
  app.enableCors(buildCorsOptions());
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidUnknownValues: false,
      transform: true
    })
  );
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
