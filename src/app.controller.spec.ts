import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

const mockDb = { execute: jest.fn() };

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: "DB", useValue: mockDb },
      ],
    }).compile();
    appController = app.get<AppController>(AppController);
  });

  it("should be defined", () => {
    expect(appController).toBeDefined();
  });

  describe("health", () => {
    it("returns status ok with database ok when DB is healthy", async () => {
      mockDb.execute.mockResolvedValueOnce([{ "?column?": 1 }]);
      const result = await appController.health();
      expect(result.status).toBe("ok");
      expect(result.database).toBe("ok");
      expect(typeof result.uptime).toBe("number");
      expect(result.timestamp).toBeDefined();
    });

    it("returns database error when DB query throws", async () => {
      mockDb.execute.mockRejectedValueOnce(new Error("Connection refused"));
      const result = await appController.health();
      expect(result.status).toBe("ok");
      expect(result.database).toBe("error");
    });
  });
});
