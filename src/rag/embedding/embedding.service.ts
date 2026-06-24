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
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>("JINA_AI_API_KEY");
    if (!apiKey) {
      throw new Error("JINA_AI_API_KEY is not defined in the environment");
    }
    // Cache the key at construction time — fails fast on misconfiguration
    this.apiKey = apiKey;
  }

  /**
   * Embed an array of text chunks for storage in the vector database
   *
   * @param chunks - Array of chunk strings to embed
   * @returns Array of embedding vectors in the same order as the input chunks
   */
  async embedAndStore(chunks: string[]) {
    return this.createEmbeddings(chunks);
  }

  /**
   * Embed a single query string for similarity search
   *
   * @param query - The user's search query
   * @returns Array containing a single embedding vector for the query
   */
  async embedQuery(query: string) {
    // Wrap in an array so createEmbeddings can handle both use cases uniformly
    return this.createEmbeddings([query]);
  }

  /**
   * Call the Jina AI embeddings API and return the resulting vectors
   *
   * @param texts - One or more strings to embed
   * @returns Two-dimensional array of embedding vectors (one per input string)
   * @throws Error if the API key is missing or the API returns a non-2xx response
   */
  private async createEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
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

    // Extract embedding arrays in the order they were returned
    const data = (await response.json()) as JinaEmbeddingResponse;
    return data.data.map((item) => item.embedding);
  }
}
