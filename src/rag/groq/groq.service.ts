import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Groq from "groq-sdk";
import { Chunk, GroundedPromptInput } from "../rag.types";

export type { Chunk, GroundedPromptInput };

@Injectable()
export class GroqService {
  private readonly client: Groq;
  private readonly model: string;
  private readonly logger = new Logger(GroqService.name);

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>("GROQ_API_KEY");
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not defined in the environment");
    }

    this.client = new Groq({ apiKey });
    this.model = this.configService.get<string>(
      "GROQ_MODEL",
      "llama-3.3-70b-versatile",
    );
  }

  async generate(prompt: string, chunks: Chunk[]): Promise<string> {
    try {
      const groundedPrompt = this.buildGroundedPrompt({ query: prompt, chunks });

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: groundedPrompt }],
        temperature: 0.3,
        max_tokens: 1024,
      });

      const text = completion.choices[0]?.message?.content;
      if (!text) {
        throw new Error("Model generated an empty response");
      }

      return text;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error generating content from Groq: ${errorMessage}`,
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
