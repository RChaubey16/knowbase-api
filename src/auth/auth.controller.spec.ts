import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import type { RequestWithJwtUser } from "./interfaces/request-with-jwt-user.interface";

const mockAuthService = {
  handleGoogleLogin: jest.fn(),
  handleRefreshTokens: jest.fn(),
  logout: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string, defaultVal?: unknown) => defaultVal ?? "test-value"),
};

describe("AuthController", () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(GoogleAuthGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("me", () => {
    it("returns req.user", () => {
      const req = {
        user: { userId: "user-1", email: "test@example.com" },
      } as unknown as RequestWithJwtUser;

      const result = controller.me(req);

      expect(result).toEqual({ userId: "user-1", email: "test@example.com" });
    });
  });

  describe("logout", () => {
    it("delegates to authService.logout with userId", async () => {
      mockAuthService.logout.mockResolvedValueOnce({ success: true });

      const req = {
        user: { userId: "user-1", email: "test@example.com" },
      } as unknown as RequestWithJwtUser;

      const result = await controller.logout(req);

      expect(result).toEqual({ success: true });
      expect(mockAuthService.logout).toHaveBeenCalledWith("user-1");
    });
  });
});
