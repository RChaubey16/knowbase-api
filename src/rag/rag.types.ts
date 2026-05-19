export interface Chunk {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface GroundedPromptInput {
  query: string;
  chunks: Chunk[];
}
