import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../users/users.service";

const mockUsersService = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue("mock-token"),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue("test-secret"),
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockJwtService.signAsync.mockResolvedValue("mock-token");

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("handleGoogleLogin", () => {
    it("throws UnauthorizedException when googleUser has no email", async () => {
      await expect(
        service.handleGoogleLogin({} as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("creates a new user when one does not exist and returns tokens", async () => {
      const googleUser = {
        email: "new@example.com",
        firstName: "New",
        lastName: "User",
        googleId: "g-123",
        avatar: null,
      };
      const newUser = { id: "user-1", email: "new@example.com", refreshTokenHash: null };

      mockUsersService.findByEmail.mockResolvedValueOnce(null);
      mockUsersService.create.mockResolvedValueOnce(newUser);
      mockUsersService.update.mockResolvedValueOnce(newUser);

      const result = await service.handleGoogleLogin(googleUser as any);

      expect(mockUsersService.create).toHaveBeenCalled();
      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
    });

    it("uses existing user when found and returns tokens", async () => {
      const googleUser = { email: "existing@example.com" };
      const existingUser = { id: "user-2", email: "existing@example.com", refreshTokenHash: "hash" };

      mockUsersService.findByEmail.mockResolvedValueOnce(existingUser);
      mockUsersService.update.mockResolvedValueOnce(existingUser);

      const result = await service.handleGoogleLogin(googleUser as any);

      expect(mockUsersService.create).not.toHaveBeenCalled();
      expect(result).toHaveProperty("accessToken");
    });
  });

  describe("handleRefreshTokens", () => {
    it("throws UnauthorizedException when user is not found", async () => {
      mockUsersService.findById.mockResolvedValueOnce(null);

      await expect(
        service.handleRefreshTokens("user-1", "some-token"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws UnauthorizedException when user has no stored hash", async () => {
      mockUsersService.findById.mockResolvedValueOnce({ id: "user-1", refreshTokenHash: null });

      await expect(
        service.handleRefreshTokens("user-1", "some-token"),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("logout", () => {
    it("nulls the refresh token hash and returns success", async () => {
      mockUsersService.update.mockResolvedValueOnce({});

      const result = await service.logout("user-1");

      expect(mockUsersService.update).toHaveBeenCalledWith("user-1", { refreshTokenHash: null });
      expect(result).toEqual({ success: true });
    });
  });
});
