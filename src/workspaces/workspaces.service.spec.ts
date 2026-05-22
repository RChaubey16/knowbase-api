import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { WorkspacesService } from "./workspaces.service";

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  transaction: jest.fn(),
  selectDistinct: jest.fn().mockReturnThis(),
};

describe("WorkspacesService", () => {
  let service: WorkspacesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.selectDistinct.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.innerJoin.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.delete.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: "DB", useValue: mockDb },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findAllByOrganisation", () => {
    it("returns workspaces for the user and organisation", async () => {
      const mockWorkspaces = [{ id: "ws-1", name: "Workspace 1" }];
      mockDb.where.mockResolvedValueOnce(mockWorkspaces.map((w) => ({ workspace: w })));

      const result = await service.findAllByOrganisation("user-123", "org-1");

      expect(result).toEqual(mockWorkspaces);
      expect(mockDb.selectDistinct).toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("creates a workspace and owner membership in a transaction", async () => {
      const ws = { id: "ws-1", name: "New WS", slug: "new-ws-abc12345" };
      mockDb.transaction.mockImplementationOnce(async (fn: (tx: typeof mockDb) => Promise<unknown>) => {
        mockDb.returning.mockResolvedValueOnce([ws]);
        return fn(mockDb);
      });

      const result = await service.create("org-1", "member-1", { name: "New WS" });

      expect(result).toEqual(ws);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("deleteWorkspace", () => {
    it("throws ForbiddenException when user is not the workspace owner", async () => {
      mockDb.where.mockResolvedValueOnce([]); // no owner membership

      await expect(
        service.deleteWorkspace("user-1", "org-1", "ws-1"),
      ).rejects.toThrow(ForbiddenException);

      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it("deletes the workspace when user is the owner", async () => {
      mockDb.where
        .mockResolvedValueOnce([{ id: "ws-member-1" }]) // owner check passes
        .mockResolvedValueOnce([]);                       // delete where clause

      const result = await service.deleteWorkspace("user-1", "org-1", "ws-1");

      expect(result).toEqual({ success: true });
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe("getWorkspaceBySlug", () => {
    it("returns workspace when found", async () => {
      const ws = { id: "ws-1", name: "WS", slug: "ws-slug" };
      mockDb.limit.mockResolvedValueOnce([{ workspace: ws }]);

      const result = await service.getWorkspaceBySlug("ws-slug", "org-1", "member-1");

      expect(result).toEqual(ws);
    });

    it("throws NotFoundException when workspace not found", async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.getWorkspaceBySlug("missing-slug", "org-1", "member-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateWorkspace", () => {
    it("throws ForbiddenException when user is not the owner", async () => {
      mockDb.where.mockResolvedValueOnce([]); // no owner membership

      await expect(
        service.updateWorkspace("user-1", "org-1", "ws-1", "New Name"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("updates and returns the workspace", async () => {
      const updated = { id: "ws-1", name: "New Name", slug: "ws-slug" };
      mockDb.where.mockResolvedValueOnce([{ id: "ws-member-1" }]); // owner check passes
      mockDb.returning.mockResolvedValueOnce([updated]);

      const result = await service.updateWorkspace("user-1", "org-1", "ws-1", "New Name");

      expect(result).toEqual(updated);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
