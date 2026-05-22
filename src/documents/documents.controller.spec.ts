import { Test, TestingModule } from "@nestjs/testing";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganisationContextGuard } from "../organisations/guards/organisation-context.guard";
import type { RequestWithJwtAndOrg } from "src/organisations/interfaces/request-with-org.interface";

const mockDocumentsService = {
  listDocuments: jest.fn(),
  getDocumentById: jest.fn(),
  createDocument: jest.fn(),
  updateDocument: jest.fn(),
  archiveDocument: jest.fn(),
  reindexDocument: jest.fn(),
  uploadPdf: jest.fn(),
  search: jest.fn(),
};

const mockReq = {
  user: { userId: "user-1", email: "test@example.com" },
  organisation: { organisationId: "org-1", organisationMemberId: "member-1", role: "owner" as const },
} as unknown as RequestWithJwtAndOrg;

describe("DocumentsController", () => {
  let controller: DocumentsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [{ provide: DocumentsService, useValue: mockDocumentsService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(OrganisationContextGuard).useValue({ canActivate: () => true })
      .compile();
    controller = module.get<DocumentsController>(DocumentsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("listDocuments", () => {
    it("delegates to service and parses limit", async () => {
      const docs = [{ id: "doc-1", title: "Test" }];
      mockDocumentsService.listDocuments.mockResolvedValueOnce(docs);

      const result = await controller.listDocuments("ws-slug", "10", mockReq);

      expect(result).toEqual(docs);
      expect(mockDocumentsService.listDocuments).toHaveBeenCalledWith("ws-slug", "org-1", "member-1", 10);
    });

    it("defaults limit to 20 when not provided", async () => {
      mockDocumentsService.listDocuments.mockResolvedValueOnce([]);

      await controller.listDocuments("ws-slug", undefined as unknown as string, mockReq);

      expect(mockDocumentsService.listDocuments).toHaveBeenCalledWith("ws-slug", "org-1", "member-1", 20);
    });
  });

  describe("createDocument", () => {
    it("delegates to service and returns created document", async () => {
      const doc = { id: "doc-2", title: "New Doc" };
      mockDocumentsService.createDocument.mockResolvedValueOnce(doc);
      const dto = { title: "New Doc", content: "Content", type: "text" as const, source: "manual", isIndexed: false };

      const result = await controller.createDocument("ws-slug", dto, mockReq);

      expect(result).toEqual(doc);
      expect(mockDocumentsService.createDocument).toHaveBeenCalledWith("ws-slug", "org-1", "member-1", dto);
    });
  });

  describe("getDocumentById", () => {
    it("delegates to service with workspace and document ID", async () => {
      const doc = { id: "doc-1", title: "Test", content: "Content" };
      mockDocumentsService.getDocumentById.mockResolvedValueOnce(doc);

      const result = await controller.getDocumentById("ws-slug", "doc-1", mockReq);

      expect(result).toEqual(doc);
      expect(mockDocumentsService.getDocumentById).toHaveBeenCalledWith("ws-slug", "doc-1", "org-1", "member-1");
    });
  });

  describe("search", () => {
    it("delegates to service with query and mode", async () => {
      const results = [{ id: "doc-1", snippet: "relevant content" }];
      mockDocumentsService.search.mockResolvedValueOnce(results);

      const result = await controller.search("ws-slug", "test query", "simple", mockReq);

      expect(result).toEqual(results);
      expect(mockDocumentsService.search).toHaveBeenCalledWith("test query", "simple", "ws-slug", "org-1", "member-1");
    });

    it("returns empty array for blank query", async () => {
      const result = await controller.search("ws-slug", "  ", "simple", mockReq);
      expect(result).toEqual([]);
      expect(mockDocumentsService.search).not.toHaveBeenCalled();
    });
  });

  describe("reindexDocument", () => {
    it("delegates to service and returns 202", async () => {
      mockDocumentsService.reindexDocument.mockResolvedValueOnce(undefined);

      await controller.reindexDocument("ws-slug", "doc-1", mockReq);

      expect(mockDocumentsService.reindexDocument).toHaveBeenCalledWith("ws-slug", "doc-1", "org-1", "member-1");
    });
  });
});
