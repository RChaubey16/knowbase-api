import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";

import { GoogleUser } from "./interfaces/google-user.interface";
import { UsersService } from "src/users/users.service";
import { users } from "../db/schema";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  /**
   * Generates access and refresh tokens
   *
   * @param user - User object
   * @returns - Access and refresh tokens
   */
  private async getTokens(user: typeof users.$inferSelect) {
    const payload = { sub: user.id, email: user.email };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: "15m",
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: "7d",
    });

    return { accessToken, refreshToken };
  }

  /**
   * Updates user's refresh token hash
   *
   * @param userId - User ID
   * @param refreshToken - Refresh token
   */
  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.update(userId, {
      refreshTokenHash: hash,
    });
  }

  /**
   * Handles Google login
   *
   * @param googleUser - Google user object
   * @returns - Access and refresh tokens
   */
  async handleGoogleLogin(googleUser: GoogleUser) {
    if (!googleUser?.email) {
      throw new UnauthorizedException();
    }

    let user = await this.usersService.findByEmail(googleUser.email);

    if (!user) {
      user = await this.usersService.create({
        email: googleUser.email,
        firstName: googleUser.firstName,
        lastName: googleUser.lastName,
        googleId: googleUser.googleId,
        avatar: googleUser.avatar,
        provider: "google",
      });
    }

    const tokens = await this.getTokens(user);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Handles token refresh
   *
   * @param userId - User ID
   * @param refreshToken - Refresh token
   * @returns - Access and refresh tokens
   */
  async handleRefreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException();
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);

    if (!isValid) {
      throw new UnauthorizedException();
    }

    const tokens = await this.getTokens(user);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Logs out user
   *
   * @param userId - User ID
   */
  async logout(userId: string) {
    await this.usersService.update(userId, {
      refreshTokenHash: null,
    });
    return { success: true };
  }
}
