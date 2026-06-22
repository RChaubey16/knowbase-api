import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { GroqService } from "./groq.service";
import Groq from "groq-sdk";

jest.mock("groq-sdk");

describe("GroqService", () => {
  let service: GroqService;

  const mockCreate = jest.fn();

  beforeEach(async () => {
    (Groq as jest.Mock).mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroqService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("test-api-key"),
          },
        },
      ],
    }).compile();

    service = module.get<GroqService>(GroqService);
  });

  afterEach(() => jest.clearAllMocks());

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
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "This is the answer." } }],
      });

      const result = await service.generate("query", [{ content: "chunk" }]);

      expect(result).toBe("This is the answer.");
      expect(mockCreate).toHaveBeenCalled();
    });

    it("should throw error if model returns empty response", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "" } }],
      });

      await expect(
        service.generate("query", [{ content: "chunk" }]),
      ).rejects.toThrow("Model generated an empty response");
    });

    it("should log and throw error on failure", async () => {
      const error = new Error("API Failure");
      mockCreate.mockRejectedValue(error);

      await expect(
        service.generate("query", [{ content: "chunk" }]),
      ).rejects.toThrow("API Failure");
    });
  });
});
