import { Test, TestingModule } from "@nestjs/testing";
import { OrganisationsController } from "./organisations.controller";
import { OrganisationsService } from "./organisations.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganisationContextGuard } from "./guards/organisation-context.guard";
import type { RequestWithJwtUser } from "../auth/interfaces/request-with-jwt-user.interface";
import type { RequestWithJwtAndOrg } from "./interfaces/request-with-org.interface";

const mockOrgService = {
  createOrganisation: jest.fn(),
  listUserOrganisations: jest.fn(),
  getOrganisationBySlug: jest.fn(),
  getUserOrgDetails: jest.fn(),
  addOrganisationMembers: jest.fn(),
  listOrganisationMembers: jest.fn(),
  removeOrganisationMember: jest.fn(),
  updateOrganisationMemberRole: jest.fn(),
  updateOrganisation: jest.fn(),
  deleteOrganisation: jest.fn(),
};

const mockUserReq = {
  user: { userId: "user-1", email: "test@example.com" },
  params: { slug: "my-org" },
} as unknown as RequestWithJwtUser;

const mockOrgReq = {
  ...mockUserReq,
  organisation: { organisationId: "org-1", organisationMemberId: "member-1", role: "owner" },
} as unknown as RequestWithJwtAndOrg;

describe("OrganisationsController", () => {
  let controller: OrganisationsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganisationsController],
      providers: [{ provide: OrganisationsService, useValue: mockOrgService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(OrganisationContextGuard).useValue({ canActivate: () => true })
      .compile();
    controller = module.get<OrganisationsController>(OrganisationsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("createOrganisation", () => {
    it("delegates to service and returns created org", async () => {
      const org = { id: "org-1", name: "My Org", slug: "my-org" };
      mockOrgService.createOrganisation.mockResolvedValueOnce(org);

      const result = await controller.createOrganisation(mockUserReq, { name: "My Org", slug: "my-org" });

      expect(result).toEqual(org);
      expect(mockOrgService.createOrganisation).toHaveBeenCalledWith("user-1", "My Org", "my-org");
    });
  });

  describe("listMyOrganisations", () => {
    it("returns organisations for the current user", async () => {
      const orgs = [{ id: "org-1", name: "My Org", slug: "my-org", role: "owner" }];
      mockOrgService.listUserOrganisations.mockResolvedValueOnce(orgs);

      const result = await controller.listMyOrganisations(mockUserReq);

      expect(result).toEqual(orgs);
      expect(mockOrgService.listUserOrganisations).toHaveBeenCalledWith("user-1");
    });
  });

  describe("update", () => {
    it("delegates to service with user ID, org ID, and new name", async () => {
      const updated = { id: "org-1", name: "Renamed" };
      mockOrgService.updateOrganisation.mockResolvedValueOnce(updated);

      const result = await controller.update(mockUserReq, "org-1", { name: "Renamed" });

      expect(result).toEqual(updated);
      expect(mockOrgService.updateOrganisation).toHaveBeenCalledWith("user-1", "org-1", "Renamed");
    });
  });

  describe("delete", () => {
    it("delegates to service with user ID and org ID", async () => {
      mockOrgService.deleteOrganisation.mockResolvedValueOnce({ success: true });

      const result = await controller.delete(mockUserReq, "org-1");

      expect(result).toEqual({ success: true });
      expect(mockOrgService.deleteOrganisation).toHaveBeenCalledWith("user-1", "org-1");
    });
  });

  describe("addOrgMembers", () => {
    it("delegates to service with org context", async () => {
      mockOrgService.addOrganisationMembers.mockResolvedValueOnce({ added: 1, skipped: [] });

      const result = await controller.addOrgMembers(mockOrgReq, { emails: ["a@example.com"] });

      expect(result).toEqual({ added: 1, skipped: [] });
      expect(mockOrgService.addOrganisationMembers).toHaveBeenCalledWith(
        "org-1", "member-1", { emails: ["a@example.com"] },
      );
    });
  });

  describe("listOrgMembers", () => {
    it("returns org members for the given slug", async () => {
      const members = [{ id: "m-1", email: "a@example.com", role: "member" }];
      mockOrgService.listOrganisationMembers.mockResolvedValueOnce(members);

      const result = await controller.listOrgMembers(mockUserReq);

      expect(result).toEqual(members);
      expect(mockOrgService.listOrganisationMembers).toHaveBeenCalledWith("my-org", "user-1");
    });
  });

  describe("removeOrgMember", () => {
    it("delegates to service with user ID and member ID", async () => {
      mockOrgService.removeOrganisationMember.mockResolvedValueOnce({ success: true });

      const result = await controller.removeOrgMember(mockUserReq, "member-99");

      expect(result).toEqual({ success: true });
      expect(mockOrgService.removeOrganisationMember).toHaveBeenCalledWith("user-1", "member-99");
    });
  });

  describe("updateOrgMemberRole", () => {
    it("delegates to service with user ID, member ID, and new role", async () => {
      const updated = { id: "member-99", role: "admin" };
      mockOrgService.updateOrganisationMemberRole.mockResolvedValueOnce(updated);

      const result = await controller.updateOrgMemberRole(mockUserReq, "member-99", { role: "admin" });

      expect(result).toEqual(updated);
      expect(mockOrgService.updateOrganisationMemberRole).toHaveBeenCalledWith("user-1", "member-99", "admin");
    });
  });
});
