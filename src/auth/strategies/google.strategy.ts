import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { Strategy, Profile } from "passport-google-oauth20";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(configService: ConfigService) {
    const GOOGLE_AUTH_CLIENT_ID = configService.get<string>(
      "GOOGLE_AUTH_CLIENT_ID",
    );
    const GOOGLE_AUTH_CLIENT_SECRET = configService.get<string>(
      "GOOGLE_AUTH_CLIENT_SECRET",
    );
    const GOOGLE_AUTH_CALLBACK_URL = configService.get<string>(
      "GOOGLE_AUTH_CALLBACK_URL",
    );

    if (
      !GOOGLE_AUTH_CLIENT_ID ||
      !GOOGLE_AUTH_CLIENT_SECRET ||
      !GOOGLE_AUTH_CALLBACK_URL
    ) {
      throw new Error("Google Auth credentials are not defined");
    }

    super({
      clientID: GOOGLE_AUTH_CLIENT_ID,
      clientSecret: GOOGLE_AUTH_CLIENT_SECRET,
      callbackURL: GOOGLE_AUTH_CALLBACK_URL,
      scope: ["email", "profile"],
    });
  }

  validate(accessToken: string, refreshToken: string, profile: Profile) {
    const { id, emails, name, photos } = profile;

    return {
      googleId: id,
      email: emails?.[0]?.value,
      firstName: name?.givenName,
      lastName: name?.familyName,
      avatar: photos?.[0]?.value,
    };
  }
}
