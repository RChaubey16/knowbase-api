import { Request } from "express";
import { GoogleUser } from "./google-user.interface";

export interface RequestWithUser extends Request {
  user: GoogleUser;
}
