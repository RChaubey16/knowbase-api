import { Test, TestingModule } from "@nestjs/testing";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganisationContextGuard } from "../organisations/guards/organisation-context.guard";
import type { RequestWithJwtAndOrg } from "src/organisations/interfaces/request-with-org.interface";

const mockWorkspacesService = {
  findAllByOrganisation: jest.fn(),
  create: jest.fn(),
  getWorkspaceBySlug: jest.fn(),
  getUserWorkspaceDetails: jest.fn(),
  deleteWorkspace: jest.fn(),
  addViewers: jest.fn(),
  updateWorkspace: jest.fn(),
};

const mockReq = {
  user: { userId: "user-123", email: "test@example.com" },
  organisation: { organisationId: "org-1", organisationMemberId: "member-1", role: "owner" as const },
  params: { slug: "my-workspace" },
} as unknown as RequestWithJwtAndOrg;

describe("WorkspacesController", () => {
  let controller: WorkspacesController;
  let service: WorkspacesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [{ provide: WorkspacesService, useValue: mockWorkspacesService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(OrganisationContextGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WorkspacesController>(WorkspacesController);
    service = module.get<WorkspacesService>(WorkspacesService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll", () => {
    it("returns workspaces for the organisation", async () => {
      const workspaces = [{ id: "ws-1", name: "Workspace 1" }];
      jest.spyOn(service, "findAllByOrganisation").mockResolvedValueOnce(workspaces as any);

      const result = await controller.findAll(mockReq);

      expect(result).toEqual(workspaces);
      expect(service.findAllByOrganisation).toHaveBeenCalledWith("user-123", "org-1");
    });
  });

  describe("create", () => {
    it("creates a workspace under the current organisation", async () => {
      const ws = { id: "ws-2", name: "New WS", slug: "new-ws-abc123" };
      jest.spyOn(service, "create").mockResolvedValueOnce(ws as any);

      const result = await controller.create(mockReq, { name: "New WS" });

      expect(result).toEqual(ws);
      expect(service.create).toHaveBeenCalledWith("org-1", "member-1", { name: "New WS" });
    });
  });

  describe("delete", () => {
    it("delegates to service with user, org, and workspace IDs", async () => {
      jest.spyOn(service, "deleteWorkspace").mockResolvedValueOnce({ success: true } as any);

      const result = await controller.delete(mockReq, "ws-1");

      expect(result).toEqual({ success: true });
      expect(service.deleteWorkspace).toHaveBeenCalledWith("user-123", "org-1", "ws-1");
    });
  });

  describe("update", () => {
    it("delegates to service with user, org, workspace ID, and new name", async () => {
      const updated = { id: "ws-1", name: "Renamed" };
      jest.spyOn(service, "updateWorkspace").mockResolvedValueOnce(updated as any);

      const result = await controller.update(mockReq, "ws-1", { name: "Renamed" });

      expect(result).toEqual(updated);
      expect(service.updateWorkspace).toHaveBeenCalledWith("user-123", "org-1", "ws-1", "Renamed");
    });
  });
});
