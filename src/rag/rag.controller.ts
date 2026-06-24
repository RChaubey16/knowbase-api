import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { RagService } from "./rag.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganisationContextGuard } from "../organisations/guards/organisation-context.guard";
import type { RequestWithJwtAndOrg } from "../organisations/interfaces/request-with-org.interface";
import { QueryRagDto } from "./dto/query-rag.dto";

@Controller("rag")
@UseGuards(JwtAuthGuard, OrganisationContextGuard)
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post("query")
  async query(
    @Body() dto: QueryRagDto,
    @Req() _req: RequestWithJwtAndOrg,
  ) {
    return {
      answer: await this.ragService.answerQuery(dto),
    };
  }
}
