import { Test, TestingModule } from "@nestjs/testing";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";
import type { RequestWithJwtUser } from "../auth/interfaces/request-with-jwt-user.interface";

describe("WorkspacesController", () => {
  let controller: WorkspacesController;
  let service: WorkspacesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        {
          provide: WorkspacesService,
          useValue: {
            create: jest.fn(),
            findAllWorkspacesByUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WorkspacesController>(WorkspacesController);
    service = module.get<WorkspacesService>(WorkspacesService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll", () => {
    it("should return workspaces for the user", async () => {
      const userId = "user-123";
      const mockWorkspaces = [
        { id: "ws-1", name: "Workspace 1" },
      ] as unknown as Awaited<
        ReturnType<WorkspacesService["findAllWorkspacesByUser"]>
      >;
      jest
        .spyOn(service, "findAllWorkspacesByUser")
        .mockResolvedValue(mockWorkspaces);

      const result = await controller.findAll({
        user: { userId, email: "test@example.com" },
      } as RequestWithJwtUser);

      expect(result).toEqual(mockWorkspaces);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findAllWorkspacesByUser).toHaveBeenCalledWith(userId);
    });
  });
});
