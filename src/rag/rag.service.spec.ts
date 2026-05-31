import { Test, TestingModule } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { RagService } from "./rag.service";
import { SupabaseService } from "src/supabase/supabase.service";
import { EmbeddingService } from "./embedding/embedding.service";
import { GroqService } from "./groq/groq.service";

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn(),
  delete: jest.fn().mockReturnThis(),
};

const mockQueue = {
  add: jest.fn(),
};

const mockSupabase = {
  getClient: jest.fn().mockReturnValue({
    rpc: jest.fn(),
  }),
};

const mockEmbeddingService = {
  embedQuery: jest.fn(),
};

const mockGroqService = {
  generate: jest.fn(),
};

describe("RagService", () => {
  let service: RagService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        { provide: "DB", useValue: mockDb },
        { provide: getQueueToken("rag-ingestion"), useValue: mockQueue },
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: EmbeddingService, useValue: mockEmbeddingService },
        { provide: GroqService, useValue: mockGroqService },
      ],
    }).compile();

    service = module.get<RagService>(RagService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("indexDocument", () => {
    it("skips if document is already indexed and force=false", async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: "chunk-1" }]);

      const result = await service.indexDocument("doc-1", "some content");

      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(result.message).toBe("Document is already indexed");
    });

    it("deletes existing chunks and re-enqueues when force=true", async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: "chunk-1" }]);
      mockQueue.add.mockResolvedValueOnce(undefined);

      const result = await service.indexDocument("doc-1", "some content", true);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        "ingest-manual-document",
        { documentId: "doc-1", documentContents: "some content" },
        expect.any(Object),
      );
      expect(result.message).toBe("Document indexing job added to Queue");
    });

    it("enqueues job when no existing chunks", async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      mockQueue.add.mockResolvedValueOnce(undefined);

      const result = await service.indexDocument("doc-2", "content");

      expect(mockQueue.add).toHaveBeenCalledWith(
        "ingest-manual-document",
        { documentId: "doc-2", documentContents: "content" },
        expect.any(Object),
      );
      expect(result.status).toBe(true);
    });
  });

  describe("answerQuery", () => {
    it("embeds the query, retrieves chunks, and generates an answer", async () => {
      const embedding = [[0.1, 0.2, 0.3]];
      const chunks = [{ content: "relevant chunk" }];
      const rpcMock = jest.fn().mockResolvedValueOnce({ data: chunks, error: null });

      mockEmbeddingService.embedQuery.mockResolvedValueOnce(embedding);
      mockSupabase.getClient.mockReturnValueOnce({ rpc: rpcMock });
      mockGroqService.generate.mockResolvedValueOnce("The answer");

      const result = await service.answerQuery({
        workspaceId: "ws-1",
        query: "What is X?",
        topK: 3,
      });

      expect(mockEmbeddingService.embedQuery).toHaveBeenCalledWith("What is X?");
      expect(rpcMock).toHaveBeenCalledWith("match_document_chunks", {
        query_embedding: embedding[0],
        match_workspace_id: "ws-1",
        match_count: 3,
      });
      expect(mockGroqService.generate).toHaveBeenCalledWith("What is X?", chunks);
      expect(result).toBe("The answer");
    });

    it("throws when the Supabase RPC returns an error", async () => {
      mockEmbeddingService.embedQuery.mockResolvedValueOnce([[0.1]]);
      const rpcMock = jest.fn().mockResolvedValueOnce({
        data: null,
        error: new Error("RPC failed"),
      });
      mockSupabase.getClient.mockReturnValueOnce({ rpc: rpcMock });

      await expect(
        service.answerQuery({ workspaceId: "ws-1", query: "Q" }),
      ).rejects.toThrow("RPC failed");
    });
  });
});
