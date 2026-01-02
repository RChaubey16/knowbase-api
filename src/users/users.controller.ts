import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import type { JwtUser } from "src/auth/interfaces/jwt-user.interface";

@Controller("users")
export class UsersController {
  /**
   * GET /users/profile
   */
  @UseGuards(JwtAuthGuard)
  @Get("profile")
  getProfile(@Req() req: Request & { user: JwtUser }): JwtUser {
    return req.user;
  }
}
