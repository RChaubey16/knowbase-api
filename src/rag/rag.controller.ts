import { Body, Controller, Post } from "@nestjs/common";
import { RagService } from "./rag.service";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

@Controller("rag")
export class RagController {
  constructor(
    @InjectQueue("rag-ingestion") private readonly ragQueue: Queue,
    private readonly ragService: RagService,
  ) {}

  @Post("ingest")
  async ingestDocument() {
    const DOC_ID = "0a731eb4-5a15-442a-a32c-065f58fa0753";
    const DOC_CONTENT =
      "Mount Everest (known locally as Sagarmāthā[a] in Nepal and Qomolangma[b] in Tibet) is Earth's highest mountain above sea level. It lies in the Mahalangur Himal sub-range of the Himalayas and marks part of the China–Nepal border at its summit.Its height was most recently measured in 2020 by Chinese and Nepali authorities as 8,848.86 m (29,031 ft 8+1⁄2 in). Mount Everest attracts many climbers, including highly experienced mountaineers. There are two main climbing routes, one approaching the summit from the southeast in Nepal (known as the standard route) and the other from the north in Tibet. While not posing substantial technical climbing challenges on the standard route, Everest presents dangers such as altitude sickness, weather, and wind, as well as hazards from avalanches and the Khumbu Icefall. As of May 2024, 340 people have died on Everest. Over 200 bodies remain on the mountain and have not been removed due to the dangerous conditions.";

    await this.ragService.indexDocument(DOC_ID, DOC_CONTENT);

    // await this.ragQueue.add(
    //   "ingest-web-scraping-document",
    //   {
    //     documentId: "999",
    //   },
    //   {
    //     attempts: 3,
    //     backoff: { type: "exponential", delay: 2000 },
    //   },
    // );

    return {
      message: "Document indexing job added to Queue",
    };
  }

  @Post("query")
  async query(
    @Body() body: { workspaceId: string; query: string; topK?: number },
  ) {
    // const testBody = {
    //   workspaceId: "c1db1c61-db6d-4cb8-9922-9a42cac278ec",
    //   query: "What is the height of Mount Everest?",
    //   topK: 3,
    // };
    return {
      answer: await this.ragService.answerQuery(body),
    };
  }
}
