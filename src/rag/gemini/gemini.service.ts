import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerateContentResult,
} from "@google/generative-ai";
import { Chunk, GroundedPromptInput } from "../rag.types";

export type { Chunk, GroundedPromptInput };

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

    // Instantiate the model once at startup to avoid per-request SDK overhead
    this.model = genAI.getGenerativeModel({
      model: this.configService.get<string>("GEMINI_MODEL", "gemini-2.0-flash"),
    });
  }

  /**
   * Generate an answer grounded in the provided document chunks
   *
   * @param prompt - The user's original query
   * @param chunks - Retrieved document chunks used as context for generation
   * @returns The model's text response
   * @throws Error if the model returns an empty response or if the API call fails
   */
  async generate(prompt: string, chunks: Chunk[]): Promise<string> {
    try {
      // Build a system prompt that restricts the model to the provided context
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

  /**
   * Assemble a retrieval-augmented prompt that constrains the model to the given chunks
   *
   * @param input - Object containing the query and the retrieved chunks
   * @returns Formatted prompt string ready to send to the Gemini API
   */
  buildGroundedPrompt(input: GroundedPromptInput): string {
    // Format each chunk with a numbered label so the model can reference them clearly
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
