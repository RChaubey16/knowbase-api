import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";

import { GoogleUser } from "./interfaces/google-user.interface";
import { UsersService } from "src/users/users.service";
import { users } from "../db/schema/users";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Signs and returns a short-lived access token and a long-lived refresh token
   *
   * @param user - Full user record from the database
   * @returns Object containing accessToken (15m) and refreshToken (7d)
   */
  private async getTokens(user: typeof users.$inferSelect) {
    const payload = { sub: user.id, email: user.email };

    // Sign access token with the default JWT secret configured in AuthModule
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: "15m",
    });

    // Sign refresh token with a separate secret so the two token types are independent
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      expiresIn: "7d",
    });

    return { accessToken, refreshToken };
  }

  /**
   * Hashes a refresh token and persists it so future refresh requests can be validated
   *
   * @param userId - ID of the user whose token should be updated
   * @param refreshToken - Plain-text refresh token to hash and store
   */
  private async updateRefreshToken(userId: string, refreshToken: string) {
    // bcrypt rounds=10 is the standard cost for refresh token hashing
    const hash = await bcrypt.hash(refreshToken, 10);

    // Persist the hash; the plain-text token never touches the database
    await this.usersService.update(userId, {
      refreshTokenHash: hash,
    });
  }

  /**
   * Handles the post-OAuth callback: finds or creates the user, issues token pair
   *
   * @param googleUser - Profile data received from Google OAuth
   * @returns Fresh access and refresh tokens
   * @throws UnauthorizedException if the Google profile carries no email
   */
  async handleGoogleLogin(googleUser: GoogleUser) {
    if (!googleUser?.email) {
      throw new UnauthorizedException();
    }

    // Look up an existing account by email before creating a new one
    let user = await this.usersService.findByEmail(googleUser.email);

    if (!user) {
      // First-time login — provision a new user record from the Google profile
      user = await this.usersService.create({
        email: googleUser.email,
        firstName: googleUser.firstName,
        lastName: googleUser.lastName,
        googleId: googleUser.googleId,
        avatar: googleUser.avatar,
        provider: "google",
      });
    }

    // Issue tokens and persist the refresh token hash atomically
    const tokens = await this.getTokens(user);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Validates a refresh token and rotates both tokens if valid
   *
   * @param userId - Subject claim from the decoded refresh token JWT
   * @param refreshToken - Plain-text refresh token from the cookie
   * @returns Rotated access and refresh tokens
   * @throws UnauthorizedException if the user is not found, has no stored hash, or the token does not match
   */
  async handleRefreshTokens(userId: string, refreshToken: string) {
    // Load the user so we can compare against the stored hash
    const user = await this.usersService.findById(userId);

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException();
    }

    // Compare the incoming plain-text token against the bcrypt hash
    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);

    if (!isValid) {
      throw new UnauthorizedException();
    }

    // Issue a fresh pair and store the new hash (token rotation)
    const tokens = await this.getTokens(user);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Invalidates the user's refresh token, effectively ending the session
   *
   * @param userId - ID of the user to log out
   * @returns Success confirmation object
   */
  async logout(userId: string) {
    // Nulling the hash means any outstanding refresh token becomes unusable
    await this.usersService.update(userId, {
      refreshTokenHash: null,
    });
    return { success: true };
  }
}
