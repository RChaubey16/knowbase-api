import { Test, TestingModule } from "@nestjs/testing";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";

describe("WorkspacesController", () => {
  let controller: WorkspacesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        {
          provide: WorkspacesService,
          useValue: {
            create: jest.fn(),
            findAllByUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WorkspacesController>(WorkspacesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll", () => {
    it("should return workspaces for the user", async () => {
      const userId = "user-123";
      const mockWorkspaces = [{ id: "ws-1", name: "Workspace 1" }];
      const service = (controller as any)["workspacesService"];
      jest.spyOn(service, "findAllByUser").mockResolvedValue(mockWorkspaces);

      const result = await controller.findAll({
        user: { userId, email: "test@example.com" },
      } as any);

      expect(result).toEqual(mockWorkspaces);
      expect(service.findAllByUser).toHaveBeenCalledWith(userId);
    });
  });
});
