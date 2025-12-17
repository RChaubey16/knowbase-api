import { Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class AuthService {
  handleGoogleLogin(googleUser: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar: string;
  }) {
    if (!googleUser?.email) {
      throw new UnauthorizedException();
    }

    console.log("GOOGLE USER DETAILS:", googleUser);

    // let user = await this.usersService.findByEmail(googleUser.email);

    // if (!user) {
    //   user = await this.usersService.create({
    //     email: googleUser.email,
    //     firstName: googleUser.firstName,
    //     lastName: googleUser.lastName,
    //     googleId: googleUser.googleId,
    //     avatar: googleUser.avatar,
    //     provider: "google",
    //   });
    // }

    // const payload = { sub: user.id, email: user.email };

    return googleUser;
  }
}
