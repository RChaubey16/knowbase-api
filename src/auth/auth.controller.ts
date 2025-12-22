import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { AuthService } from "./auth.service";
import type { RequestWithGoogleUser } from "./interfaces/request-with-google-user.interface";
import type { RequestWithJwtUser } from "./interfaces/request-with-jwt-user.interface";
import { JwtPayload } from "./interfaces/jwt-payload.interface";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { Request, Response } from "express";

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
  async googleCallback(
    @Req() req: RequestWithGoogleUser,
    @Res() res: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.handleGoogleLogin(req.user);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    };

    // Option A (recommended): httpOnly cookies
    res.cookie("accessToken", accessToken, cookieOptions);

    res.cookie("refreshToken", refreshToken, cookieOptions);

    return res.redirect(process.env.FRONT_END_URL!);
  }

  @Post("refresh")
  async refresh(@Req() req: Request, @Res() res: Response) {
    const refreshToken = (req.cookies as Record<string, string> | undefined)
      ?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    const payload = await this.jwtService.verifyAsync<JwtPayload>(
      refreshToken,
      { secret: process.env.JWT_REFRESH_SECRET },
    );

    const tokens = await this.authService.handleRefreshTokens(
      payload.sub,
      refreshToken,
    );

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };

    // rotate cookies
    res.cookie("accessToken", tokens.accessToken, cookieOptions);
    res.cookie("refreshToken", tokens.refreshToken, cookieOptions);

    return res.send({ success: true });
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() req: RequestWithJwtUser) {
    return req.user;
  }

  @Get("debug-cookies")
  debug(@Req() req: Request) {
    return req.cookies;
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  logout(@Req() req: RequestWithJwtUser) {
    return this.authService.logout(req.user.userId);
  }
}
