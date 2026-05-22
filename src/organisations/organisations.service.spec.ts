import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { OrganisationsService } from "./organisations.service";

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  transaction: jest.fn(),
};

describe("OrganisationsService", () => {
  let service: OrganisationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.innerJoin.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.delete.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganisationsService,
        { provide: "DB", useValue: mockDb },
      ],
    }).compile();

    service = module.get<OrganisationsService>(OrganisationsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createOrganisation", () => {
    it("throws ForbiddenException when user already owns 3 orgs", async () => {
      mockDb.where.mockResolvedValueOnce([{ id: "m1" }, { id: "m2" }, { id: "m3" }]);

      await expect(
        service.createOrganisation("user-1", "My Org", "my-org"),
      ).rejects.toThrow(ForbiddenException);

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("creates organisation and owner membership in a transaction", async () => {
      const org = { id: "org-1", name: "My Org", slug: "my-org" };
      mockDb.where.mockResolvedValueOnce([]); // no owned orgs

      mockDb.transaction.mockImplementationOnce(async (fn: (tx: typeof mockDb) => Promise<unknown>) => {
        mockDb.returning.mockResolvedValueOnce([org]);
        return fn(mockDb);
      });

      const result = await service.createOrganisation("user-1", "My Org", "my-org");
      expect(result).toEqual(org);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("listUserOrganisations", () => {
    it("returns organisations for a user", async () => {
      const orgs = [{ id: "org-1", name: "My Org", slug: "my-org", role: "owner" }];
      mockDb.where.mockResolvedValueOnce(orgs);

      const result = await service.listUserOrganisations("user-1");
      expect(result).toEqual(orgs);
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe("deleteOrganisation", () => {
    it("throws ForbiddenException when user is not the owner", async () => {
      mockDb.where.mockResolvedValueOnce([]); // no owner membership found

      await expect(
        service.deleteOrganisation("user-1", "org-1"),
      ).rejects.toThrow(ForbiddenException);

      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it("deletes the organisation when user is the owner", async () => {
      mockDb.where
        .mockResolvedValueOnce([{ id: "member-1" }]) // owner check passes
        .mockResolvedValueOnce([]);                   // delete where clause

      const result = await service.deleteOrganisation("user-1", "org-1");
      expect(result).toEqual({ success: true });
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe("updateOrganisation", () => {
    it("throws ForbiddenException when user is not the owner", async () => {
      mockDb.where.mockResolvedValueOnce([]); // no owner membership

      await expect(
        service.updateOrganisation("user-1", "org-1", "New Name"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("updates and returns the organisation", async () => {
      const updated = { id: "org-1", name: "New Name", slug: "my-org" };
      mockDb.where.mockResolvedValueOnce([{ id: "member-1" }]); // owner check passes
      mockDb.returning.mockResolvedValueOnce([updated]);

      const result = await service.updateOrganisation("user-1", "org-1", "New Name");
      expect(result).toEqual(updated);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
