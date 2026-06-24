import { Injectable } from "@nestjs/common";

@Injectable()
export class ChunkingService {
  /**
   * Split a long text into overlapping chunks suitable for embedding
   *
   * @param text - Raw document text to chunk
   * @param maxChars - Maximum character length of each chunk (default: 1500)
   * @param overlapChars - Number of characters to carry over from the previous chunk (default: 150)
   * @returns Ordered array of text chunks
   * @throws Error if overlapChars is not smaller than maxChars
   */
  chunk(text: string, maxChars = 1500, overlapChars = 150): string[] {
    if (overlapChars >= maxChars) {
      throw new Error("overlapChars must be smaller than maxChars");
    }

    // Normalise whitespace so chunk sizes are predictable
    const clean = text.replace(/\s+/g, " ").trim();

    // Split on sentence boundaries to avoid cutting mid-sentence
    const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];

    const chunks: string[] = [];
    let current = "";

    for (const sentence of sentences) {
      if ((current + " " + sentence).length <= maxChars) {
        // Sentence fits in the current chunk — keep accumulating
        current = current ? `${current} ${sentence}` : sentence;
      } else {
        // Current chunk is full — save it and start the next with an overlap window
        chunks.push(current);

        // Carry the tail of the previous chunk forward to preserve context across boundaries
        const overlap = current.slice(
          Math.max(0, current.length - overlapChars),
        );

        current = `${overlap} ${sentence}`.trim();
      }
    }

    // Push the final partial chunk if any text remains
    if (current) chunks.push(current);

    return chunks;
  }
}
