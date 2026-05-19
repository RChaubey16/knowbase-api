import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface JinaEmbeddingData {
  embedding: number[];
  index: number;
  object: string;
}

interface JinaEmbeddingResponse {
  model: string;
  object: string;
  data: JinaEmbeddingData[];
  usage: {
    total_tokens: number;
    prompt_tokens: number;
  };
}

@Injectable()
export class EmbeddingService {
  constructor(private readonly configService: ConfigService) {}

  async embedAndStore(chunks: string[]) {
    return this.createEmbeddings(chunks);
  }

  async embedQuery(query: string) {
    return this.createEmbeddings([query]);
  }

  private async createEmbeddings(texts: string[]): Promise<number[][]> {
    const apiKey = this.configService.get<string>("JINA_AI_API_KEY");
    if (!apiKey) {
      throw new Error("JINA_AI_API_KEY is not defined in the environment");
    }

    const response = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: "jina-embeddings-v2-base-en",
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Jina embedding API error ${response.status}: ${body}`,
      );
    }

    const data = (await response.json()) as JinaEmbeddingResponse;
    return data.data.map((item) => item.embedding);
  }
}
