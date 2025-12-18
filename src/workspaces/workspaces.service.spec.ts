import { Test, TestingModule } from "@nestjs/testing";
import { WorkspacesService } from "./workspaces.service";

describe("WorkspacesService", () => {
  let service: WorkspacesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        {
          provide: "DB",
          useValue: {
            transaction: jest.fn(),
            insert: jest.fn(),
            select: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findAllByUser", () => {
    it("should return workspaces for a user", async () => {
      const userId = "user-123";
      const mockWorkspaces = [{ id: "ws-1", name: "Workspace 1" }];
      const dbMock = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(
          mockWorkspaces.map((w) => ({
            workspace: w,
          })),
        ),
      };

      Object.assign(service, { db: dbMock });

      const result = await service.findAllByUser(userId);

      expect(result).toEqual(mockWorkspaces);
      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.from).toHaveBeenCalled();
      expect(dbMock.innerJoin).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
    });
  });
});
