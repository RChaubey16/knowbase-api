import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { AuthService } from "./auth.service";
import { JwtPayload } from "./interfaces/jwt-payload.interface";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { Request, Response } from "express";
import type { RequestWithGoogleUser } from "./interfaces/request-with-google-user.interface";
import type { RequestWithJwtUser } from "./interfaces/request-with-jwt-user.interface";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private buildCookieOptions() {
    const isProduction = this.configService.get<string>("NODE_ENV") === "production";
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      domain: isProduction ? this.configService.get<string>("COOKIE_DOMAIN") : undefined,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    };
  }

  /**
   * GET /auth/google
   */
  @Get("google")
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Google redirect happens automatically
  }

  /**
   * GET /auth/google/callback
   */
  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: RequestWithGoogleUser,
    @Res() res: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.handleGoogleLogin(req.user);

    const cookieOptions = this.buildCookieOptions();
    res.cookie("kb_accessToken", accessToken, cookieOptions);
    res.cookie("kb_refreshToken", refreshToken, cookieOptions);

    return res.redirect(this.configService.get<string>("FRONT_END_URL", "http://localhost:3001"));
  }

  /**
   * POST /auth/refresh
   */
  @Post("refresh")
  async refresh(@Req() req: Request, @Res() res: Response) {
    const refreshToken = (req.cookies as Record<string, string> | undefined)
      ?.kb_refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    const payload = await this.jwtService.verifyAsync<JwtPayload>(
      refreshToken,
      { secret: this.configService.get<string>("JWT_REFRESH_SECRET") },
    );

    const tokens = await this.authService.handleRefreshTokens(
      payload.sub,
      refreshToken,
    );

    const cookieOptions = this.buildCookieOptions();
    res.cookie("kb_accessToken", tokens.accessToken, cookieOptions);
    res.cookie("kb_refreshToken", tokens.refreshToken, cookieOptions);

    return res.send({ success: true });
  }

  /**
   * POST /auth/demo
   * Issues a 7-day access token for the pre-seeded demo user.
   * No refresh token — demo sessions simply expire after 7 days.
   */
  @Post("demo")
  async demoLogin(@Res() res: Response) {
    const { accessToken } = await this.authService.loginDemo();
    res.cookie("kb_accessToken", accessToken, this.buildCookieOptions());
    return res.send({ success: true });
  }

  /**
   * GET /auth/me
   */
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() req: RequestWithJwtUser) {
    const demoUserId = this.configService.get<string>("DEMO_USER_ID");
    return {
      ...req.user,
      isDemo: !!demoUserId && req.user.userId === demoUserId,
    };
  }

  /**
   * POST /auth/logout
   */
  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@Req() req: RequestWithJwtUser, @Res() res: Response) {
    await this.authService.logout(req.user.userId);

    // Clear both cookies from the browser so the session is fully terminated.
    // Options must match the original Set-Cookie (path, domain, secure, sameSite)
    // so the browser accepts the deletion.
    const { maxAge: _maxAge, ...clearOptions } = this.buildCookieOptions();
    res.clearCookie("kb_accessToken", clearOptions);
    res.clearCookie("kb_refreshToken", clearOptions);

    return res.send({ success: true });
  }
}
