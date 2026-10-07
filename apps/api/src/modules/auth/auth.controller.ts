import { Body, Controller, Get, HttpCode, Post, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from "./dto";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { CurrentUser } from "../../common/current-user.decorator";
import { AuthRateLimitGuard } from "../../common/auth-rate-limit.guard";

@Controller("auth")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  })
)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @UseGuards(AuthRateLimitGuard)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @HttpCode(200)
  @UseGuards(AuthRateLimitGuard)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("forgot-password")
  @UseGuards(AuthRateLimitGuard)
  requestPasswordReset(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post("reset-password")
  @HttpCode(200)
  @UseGuards(AuthRateLimitGuard)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: { sub: string }) {
    return this.authService.me(user.sub);
  }
}
