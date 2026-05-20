import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { GeminiService } from "./gemini.service";
import { GoogleGenerativeAI } from "@google/generative-ai";

jest.mock("@google/generative-ai");

describe("GeminiService", () => {
  let service: GeminiService;
  let configService: ConfigService;

  const mockModel = {
    generateContent: jest.fn(),
  };

  const mockGenAI = {
    getGenerativeModel: jest.fn().mockReturnValue(mockModel),
  };

  beforeEach(async () => {
    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => mockGenAI);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("test-api-key"),
          },
        },
      ],
    }).compile();

    service = module.get<GeminiService>(GeminiService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("buildGroundedPrompt", () => {
    it("should build a prompt with chunks", () => {
      const input = {
        query: "What is AI?",
        chunks: [
          { content: "AI stands for Artificial Intelligence." },
          { content: "It is a field of computer science." },
        ],
      };

      const prompt = service.buildGroundedPrompt(input);

      expect(prompt).toContain("What is AI?");
      expect(prompt).toContain(
        "Context 1:\nAI stands for Artificial Intelligence.",
      );
      expect(prompt).toContain(
        "Context 2:\nIt is a field of computer science.",
      );
      expect(prompt).toContain("You are an assistant");
    });
  });

  describe("generate", () => {
    it("should return generated text on success", async () => {
      const mockResult = {
        response: {
          text: jest.fn().mockReturnValue("This is the answer."),
        },
      };
      mockModel.generateContent.mockResolvedValue(mockResult);

      const result = await service.generate("query", [{ content: "chunk" }]);

      expect(result).toBe("This is the answer.");
      expect(mockModel.generateContent).toHaveBeenCalled();
    });

    it("should throw error if model returns empty response", async () => {
      const mockResult = {
        response: {
          text: jest.fn().mockReturnValue(""),
        },
      };
      mockModel.generateContent.mockResolvedValue(mockResult);

      await expect(
        service.generate("query", [{ content: "chunk" }]),
      ).rejects.toThrow("Model generated an empty response");
    });

    it("should log and throw error on failure", async () => {
      const error = new Error("API Failure");
      mockModel.generateContent.mockRejectedValue(error);

      await expect(
        service.generate("query", [{ content: "chunk" }]),
      ).rejects.toThrow("API Failure");
    });
  });
});
