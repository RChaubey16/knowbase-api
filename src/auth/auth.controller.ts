import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { AuthService } from "./auth.service";
import type { RequestWithUser } from "./interfaces/request-with-user.interface";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Google redirect happens automatically
  }

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  googleCallback(@Req() req: RequestWithUser) {
    return this.authService.handleGoogleLogin(req.user);
  }
}
