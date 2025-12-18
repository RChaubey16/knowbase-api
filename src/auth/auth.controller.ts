import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { AuthService } from "./auth.service";
import type { RequestWithGoogleUser } from "./interfaces/request-with-google-user.interface";
import type { RequestWithJwtUser } from "./interfaces/request-with-jwt-user.interface";
import { JwtPayload } from "./interfaces/jwt-payload.interface";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
  ) {}

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Google redirect happens automatically
  }

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  googleCallback(@Req() req: RequestWithGoogleUser) {
    return this.authService.handleGoogleLogin(req.user);
  }

  @Post("refresh")
  async refresh(@Body("refreshToken") refreshToken: string) {
    const payload = await this.jwtService.verifyAsync<JwtPayload>(
      refreshToken,
      {
        secret: process.env.JWT_REFRESH_SECRET,
      },
    );

    return this.authService.handleRefreshTokens(payload.sub, refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  logout(@Req() req: RequestWithJwtUser) {
    return this.authService.logout(req.user.userId);
  }
}
