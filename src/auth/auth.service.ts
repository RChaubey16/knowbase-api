import { Injectable, UnauthorizedException } from "@nestjs/common";
import { GoogleUser } from "./interfaces/google-user.interface";
import { UsersService } from "src/users/users.service";

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

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

    const payload = { sub: user.id, email: user.email, avatar: user.avatar };

    return payload;
  }
}
