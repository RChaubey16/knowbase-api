import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { RagService } from "../rag/rag.service";

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn(),
  orderBy: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  transaction: jest.fn(),
  execute: jest.fn(),
};

const mockRagService = {
  indexDocument: jest.fn().mockResolvedValue({ status: true, message: "queued" }),
  answerQuery: jest.fn(),
};

describe("DocumentsService", () => {
  let service: DocumentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.innerJoin.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.orderBy.mockReturnThis();
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.delete.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: "DB", useValue: mockDb },
        { provide: RagService, useValue: mockRagService },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    jest.spyOn(service as any, "assertWorkspaceAccess").mockResolvedValue("ws-id");
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("listDocuments", () => {
    it("returns documents for a workspace", async () => {
      const docs = [{ id: "doc-1", title: "Test", snippet: "snip", status: "ready" }];
      mockDb.limit.mockResolvedValueOnce(docs);

      const result = await service.listDocuments("ws-slug", "org-1", "member-1", 20);

      expect(result).toEqual(docs);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(20);
    });
  });

  describe("getDocumentById", () => {
    it("returns a document when found", async () => {
      const doc = { id: "doc-1", title: "Test", content: "Content" };
      mockDb.limit.mockResolvedValueOnce([doc]);

      const result = await service.getDocumentById("ws-slug", "doc-1", "org-1", "member-1");

      expect(result).toEqual(doc);
    });

    it("throws NotFoundException when document does not exist", async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.getDocumentById("ws-slug", "missing-id", "org-1", "member-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createDocument", () => {
    it("creates a text document without indexing when isIndexed=false", async () => {
      const doc = { id: "doc-1", title: "Test", status: "ready" };
      mockDb.transaction.mockImplementationOnce(async (fn: (tx: typeof mockDb) => Promise<unknown>) => {
        mockDb.returning.mockResolvedValueOnce([doc]);
        return fn(mockDb);
      });

      const result = await service.createDocument("ws-slug", "org-1", "member-1", {
        title: "Test",
        content: "Content",
        type: "text",
        source: "manual",
        isIndexed: false,
      });

      expect(result).toEqual(doc);
      expect(mockRagService.indexDocument).not.toHaveBeenCalled();
    });

    it("calls ragService.indexDocument when isIndexed=true", async () => {
      const doc = { id: "doc-2", title: "Indexed", status: "processing" };
      mockDb.transaction.mockImplementationOnce(async (fn: (tx: typeof mockDb) => Promise<unknown>) => {
        mockDb.returning.mockResolvedValueOnce([doc]);
        return fn(mockDb);
      });

      await service.createDocument("ws-slug", "org-1", "member-1", {
        title: "Indexed",
        content: "Some content",
        type: "text",
        source: "manual",
        isIndexed: true,
      });

      expect(mockRagService.indexDocument).toHaveBeenCalledWith("doc-2", "Some content");
    });

    it("throws BadRequestException when neither content nor url is provided", async () => {
      await expect(
        service.createDocument("ws-slug", "org-1", "member-1", {
          title: "Test",
          type: "text",
          source: "manual",
          isIndexed: false,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  describe("archiveDocument", () => {
    it("archives a document by setting archivedAt", async () => {
      mockDb.returning.mockResolvedValueOnce([{ id: "doc-1", archivedAt: new Date() }]);

      await expect(
        service.archiveDocument("ws-slug", "doc-1", "org-1", "member-1"),
      ).resolves.not.toThrow();

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
    });

    it("throws NotFoundException when document does not exist or is already archived", async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(
        service.archiveDocument("ws-slug", "missing", "org-1", "member-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateDocument", () => {
    it("updates document and calls ragService when isIndexed=true", async () => {
      const updated = { id: "doc-1", title: "Updated", status: "processing" };
      mockDb.transaction.mockImplementationOnce(async (fn: (tx: typeof mockDb) => Promise<unknown>) => {
        mockDb.returning.mockResolvedValueOnce([updated]);
        return fn(mockDb);
      });

      const result = await service.updateDocument("ws-slug", "doc-1", "org-1", "member-1", {
        title: "Updated",
        content: "New content",
        isIndexed: true,
      });

      expect(result).toEqual(updated);
      expect(mockRagService.indexDocument).toHaveBeenCalledWith("doc-1", "New content", true);
    });

    it("does not call ragService when isIndexed=false", async () => {
      const updated = { id: "doc-1", title: "Updated", status: "ready" };
      mockDb.transaction.mockImplementationOnce(async (fn: (tx: typeof mockDb) => Promise<unknown>) => {
        mockDb.returning.mockResolvedValueOnce([updated]);
        return fn(mockDb);
      });

      await service.updateDocument("ws-slug", "doc-1", "org-1", "member-1", {
        title: "Updated",
        content: "Content",
        isIndexed: false,
      });

      expect(mockRagService.indexDocument).not.toHaveBeenCalled();
    });
  });
});
