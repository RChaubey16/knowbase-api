import { Request } from "express";
import { JwtUser } from "./jwt-user.interface";

export interface RequestWithJwtUser extends Request {
  user: JwtUser;
}
