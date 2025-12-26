import { Test, TestingModule } from "@nestjs/testing";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";

describe("DocumentsController", () => {
  let controller: DocumentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        {
          provide: DocumentsService,
          useValue: {
            listDocuments: jest.fn(),
            getDocumentById: jest.fn(),
            createDocument: jest.fn(),
            updateDocument: jest.fn(),
            archiveDocument: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
