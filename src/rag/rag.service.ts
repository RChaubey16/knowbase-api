import { Injectable } from "@nestjs/common";

@Injectable()
export class RagService {
  indexDocument(documentId: string, documentContents: string) {
    console.log(`Indexing document ${documentId}`);
    console.log(`Document contents: ${documentContents}`);

    return true;
  }
}
