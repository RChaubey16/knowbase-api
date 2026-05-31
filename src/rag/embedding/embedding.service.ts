import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type HFEmbeddingResponse = number[][] | number[][][];

@Injectable()
export class EmbeddingService {
  private readonly model = "sentence-transformers/all-mpnet-base-v2";

  constructor(private readonly configService: ConfigService) {}

  async embedAndStore(chunks: string[]) {
    return this.createEmbeddings(chunks);
  }

  async embedQuery(query: string) {
    return this.createEmbeddings([query]);
  }

  private async createEmbeddings(texts: string[]): Promise<number[][]> {
    const apiKey = this.configService.get<string>("HUGGINGFACE_API_KEY");
    if (!apiKey) {
      throw new Error("HUGGINGFACE_API_KEY is not defined in the environment");
    }

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${this.model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: texts }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `HuggingFace embedding API error ${response.status}: ${body}`,
      );
    }

    const data = (await response.json()) as HFEmbeddingResponse;

    // Sentence-transformer models return number[][] (pooled).
    // Non-pooled models return number[][][] (tokens × dims per input); take mean over tokens.
    if (Array.isArray(data[0][0])) {
      return (data as number[][][]).map((tokenEmbeddings) => {
        const dims = tokenEmbeddings[0].length;
        return tokenEmbeddings
          .reduce(
            (acc, vec) => acc.map((v, i) => v + vec[i]),
            new Array<number>(dims).fill(0),
          )
          .map((v) => v / tokenEmbeddings.length);
      });
    }

    return data as number[][];
  }
}
