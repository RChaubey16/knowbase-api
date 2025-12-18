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
});
