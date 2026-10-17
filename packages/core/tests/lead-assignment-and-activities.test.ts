import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assignSiteLead,
  addSiteLeadActivityNote,
  listSiteLeadActivities,
  updateSiteLeadStatus,
} from "../src/site/leads";
import { ForbiddenError, ValidationError } from "../src/errors";
import type { StaffActor } from "../src/permissions";

const mockLead = {
  id: "lead_test_01",
  tenantId: "tenant_biz_01",
  name: "Tanvir Ahmed",
  phone: "01712345678",
  status: "NEW" as const,
  assignedToUserId: null as string | null,
  privateNotes: null as string | null,
};

const activitiesStore: any[] = [];

const mockTx = {
  siteLead: {
    findFirst: vi.fn().mockImplementation(async ({ where }) => {
      if (where.id === "lead_test_01") return { ...mockLead };
      return null;
    }),
    update: vi.fn().mockImplementation(async ({ data }) => {
      Object.assign(mockLead, data);
      return { ...mockLead };
    }),
  },
  siteLeadActivity: {
    create: vi.fn().mockImplementation(async ({ data }) => {
      const activity = { id: `act_${Date.now()}`, ...data, createdAt: new Date() };
      activitiesStore.push(activity);
      return activity;
    }),
    findMany: vi.fn().mockImplementation(async ({ where }) => {
      return activitiesStore.filter(
        (a) => a.tenantId === where.tenantId && a.leadId === where.leadId
      );
    }),
  },
  platformAuditLog: {
    create: vi.fn().mockResolvedValue({ id: "audit_1" }),
  },
  auditLog: {
    create: vi.fn().mockResolvedValue({ id: "audit_2" }),
  },
};

vi.mock("@biztrackbd/db", () => ({
  withTenant: vi.fn().mockImplementation(async (_tenantId, fn) => fn(mockTx)),
}));

vi.mock("../src/audit/service", () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

describe("Lead Assignment & Activity Timeline Engine (Phase 1)", () => {
  const ownerActor: StaffActor = {
    userId: "user_owner_01",
    email: "owner@bistro.com",
    name: "Owner Tanvir",
    role: "STORE_OWNER",
  };

  const telemarketerActor: StaffActor = {
    userId: "user_tele_01",
    email: "reception@bistro.com",
    name: "Receptionist Sadia",
    role: "TELEMARKETER",
  };

  const editorActor: StaffActor = {
    userId: "user_editor_01",
    email: "editor@bistro.com",
    name: "Content Editor",
    role: "CONTENT_EDITOR",
  };

  beforeEach(() => {
    mockLead.status = "NEW";
    mockLead.assignedToUserId = null;
    mockLead.privateNotes = null;
    activitiesStore.length = 0;
    vi.clearAllMocks();
  });

  describe("assignSiteLead", () => {
    it("assigns lead to staff member and writes ASSIGNED activity", async () => {
      const updated = await assignSiteLead(
        "tenant_biz_01",
        ownerActor,
        "lead_test_01",
        "user_staff_02",
        "Staff Member Kamal"
      );

      expect(updated.assignedToUserId).toBe("user_staff_02");
      expect(mockTx.siteLeadActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant_biz_01",
          leadId: "lead_test_01",
          activityType: "ASSIGNED",
          note: "Assigned to Staff Member Kamal",
          metadata: {
            assignedToUserId: "user_staff_02",
            assignedToUserName: "Staff Member Kamal",
          },
        }),
      });
    });

    it("allows support/receptionist to reassign lead", async () => {
      const updated = await assignSiteLead(
        "tenant_biz_01",
        telemarketerActor,
        "lead_test_01",
        "user_staff_03",
        "Dr. Tariqul"
      );

      expect(updated.assignedToUserId).toBe("user_staff_03");
    });

    it("denies content editor from assigning leads (403 Forbidden)", async () => {
      await expect(
        assignSiteLead("tenant_biz_01", editorActor, "lead_test_01", "user_staff_02")
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("addSiteLeadActivityNote", () => {
    it("appends internal note to activity timeline and updates privateNotes", async () => {
      const activity = await addSiteLeadActivityNote(
        "tenant_biz_01",
        telemarketerActor,
        "lead_test_01",
        "Spoke with customer on WhatsApp. Requested evening reservation for 4."
      );

      expect(activity).toBeDefined();
      expect(activity.note).toBe(
        "Spoke with customer on WhatsApp. Requested evening reservation for 4."
      );
      expect(activity.actorName).toBe("Receptionist Sadia");
      expect(mockLead.privateNotes).toBe(
        "Spoke with customer on WhatsApp. Requested evening reservation for 4."
      );
    });

    it("rejects empty notes with ValidationError", async () => {
      await expect(
        addSiteLeadActivityNote("tenant_biz_01", telemarketerActor, "lead_test_01", "   ")
      ).rejects.toThrow(ValidationError);
    });

    it("blocks content editor from adding lead notes", async () => {
      await expect(
        addSiteLeadActivityNote("tenant_biz_01", editorActor, "lead_test_01", "Some note")
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("updateSiteLeadStatus with Activity Timeline", () => {
    it("transitions status and writes STATUS_CHANGED activity with before/after state", async () => {
      const updated = await updateSiteLeadStatus(
        "tenant_biz_01",
        ownerActor,
        "lead_test_01",
        "CONTACTED",
        "Called customer, awaiting confirmation."
      );

      expect(updated.status).toBe("CONTACTED");
      expect(mockTx.siteLeadActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          activityType: "STATUS_CHANGED",
          beforeStatus: "NEW",
          afterStatus: "CONTACTED",
          note: "Called customer, awaiting confirmation.",
        }),
      });
    });
  });

  describe("listSiteLeadActivities", () => {
    it("returns chronological list of activities for a lead", async () => {
      activitiesStore.push(
        {
          id: "act_1",
          tenantId: "tenant_biz_01",
          leadId: "lead_test_01",
          activityType: "STATUS_CHANGED",
          note: "Initial lead created",
          createdAt: new Date("2026-10-17T10:00:00Z"),
        },
        {
          id: "act_2",
          tenantId: "tenant_biz_01",
          leadId: "lead_test_01",
          activityType: "ASSIGNED",
          note: "Assigned to Sadia",
          createdAt: new Date("2026-10-17T10:15:00Z"),
        }
      );

      const list = await listSiteLeadActivities(
        "tenant_biz_01",
        telemarketerActor,
        "lead_test_01"
      );
      expect(list).toHaveLength(2);
      expect(list[0].activityType).toBe("STATUS_CHANGED");
      expect(list[1].activityType).toBe("ASSIGNED");
    });

    it("blocks content editor from viewing lead activities", async () => {
      await expect(
        listSiteLeadActivities("tenant_biz_01", editorActor, "lead_test_01")
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
