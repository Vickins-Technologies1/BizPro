import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { businessSchemas, opsSchemas, subscriptionSchemas } from "../schemas";
import { AuthRateLimitGuard } from "../../common/auth-rate-limit.guard";

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET") ?? "change-me",
        signOptions: { expiresIn: config.get<string>("JWT_EXPIRES_IN") ?? "7d" }
      })
    }),
    MongooseModule.forFeature([...businessSchemas, ...subscriptionSchemas, ...opsSchemas])
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuthRateLimitGuard],
  exports: [AuthService]
})
export class AuthModule {}
