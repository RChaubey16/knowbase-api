import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerateContentResult,
} from "@google/generative-ai";

export interface Chunk {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface GroundedPromptInput {
  query: string;
  chunks: Chunk[];
}

@Injectable()
export class GeminiService {
  private readonly model: GenerativeModel;
  private readonly logger = new Logger(GeminiService.name);

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment");
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    this.model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
    });
  }

  async generate(prompt: string, chunks: Chunk[]): Promise<string> {
    try {
      const groundedPrompt = this.buildGroundedPrompt({
        query: prompt,
        chunks,
      });

      const result: GenerateContentResult =
        await this.model.generateContent(groundedPrompt);
      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new Error("Model generated an empty response");
      }

      return text;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error generating content from Gemini: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  buildGroundedPrompt(input: GroundedPromptInput): string {
    const context = input.chunks
      .map((c, i) => `Context ${i + 1}:\n${c.content}`)
      .join("\n\n");

    return `
      You are an assistant that answers questions using ONLY the provided context.

      Rules:
      - Use only the context below
      - If the answer is not in the context, say: "I don't know based on the provided information."
      - Do not use prior knowledge.

      Context:
      ${context}

      Question:
      ${input.query}

      Answer:
      `;
  }
}
