import { Injectable } from "@nestjs/common";

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
  async embedAndStore(chunks: string[]) {
    const embeddings = await this.createEmbeddings(chunks);
    return embeddings;
  }

  async embedQuery(query: string) {
    const embeddings = await this.createEmbeddings([query]);
    return embeddings;
  }

  private async createEmbeddings(texts: string[]) {
    const response = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.JINA_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: "jina-embeddings-v2-base-en",
      }),
    });
    const data = (await response.json()) as JinaEmbeddingResponse;
    return data.data.map((item) => item.embedding);
  }
}
