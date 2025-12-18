import { Request } from "express";
import { GoogleUser } from "./google-user.interface";

export interface RequestWithGoogleUser extends Request {
  user: GoogleUser;
}
