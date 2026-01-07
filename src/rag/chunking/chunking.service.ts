import { Injectable } from "@nestjs/common";

// chunking.service.ts
@Injectable()
export class ChunkingService {
  chunk(text: string, maxChars = 300, overlapChars = 50): string[] {
    if (overlapChars >= maxChars) {
      throw new Error("overlapChars must be smaller than maxChars");
    }

    const clean = text.replace(/\s+/g, " ").trim();
    const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];

    const chunks: string[] = [];
    let current = "";

    for (const sentence of sentences) {
      if ((current + " " + sentence).length <= maxChars) {
        current = current ? `${current} ${sentence}` : sentence;
      } else {
        chunks.push(current);

        // Create overlap from the end of the previous chunk
        const overlap = current.slice(
          Math.max(0, current.length - overlapChars),
        );

        current = `${overlap} ${sentence}`.trim();
      }
    }

    if (current) chunks.push(current);

    return chunks;
  }
}
