import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

const cookieExtractor = (req: Request): string | null => {
  if (!req || !req.cookies) {
    return null;
  }
  return (req.cookies["accessToken"] as string | undefined) ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>("JWT_SECRET");

    if (!secret) {
      throw new Error("JWT_SECRET is not defined");
    }

    super({
      jwtFromRequest: cookieExtractor,
      secretOrKey: secret,
      ignoreExpiration: false,
    });
  }

  validate(payload: { sub: string; email: string }) {
    return {
      userId: payload.sub,
      email: payload.email,
    };
  }
}
