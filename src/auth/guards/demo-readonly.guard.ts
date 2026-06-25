import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class DemoReadOnlyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const demoUserId = this.configService.get<string>("DEMO_USER_ID");

    if (!demoUserId || req.user?.userId !== demoUserId) {
      return true;
    }

    const method: string = req.method.toUpperCase();

    // POST /rag/query is semantically a read — allow it
    if (method === "POST" && (req.path as string).endsWith("/rag/query")) {
      return true;
    }

    if (method !== "GET") {
      throw new ForbiddenException("Demo users have read-only access");
    }

    return true;
  }
}
