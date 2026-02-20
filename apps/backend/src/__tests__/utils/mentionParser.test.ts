/**
 * Tests for plain @mention resolution in backend (extractMentionUserIds).
 * Verifies same strict behavior as frontend: @risk, @job do not resolve;
 * exact @Full Name and @email@example.com do (case-insensitive).
 */

const ORG_ID = "test-org-id";
const USERS = [
  { id: "u1", email: "email@example.com", full_name: "Full Name" },
  { id: "u2", email: "other@example.com", full_name: "Risk Manager" },
];

const mockIn = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock("../../lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => {
      mockFrom(table);
      return {
        select: (cols: string) => {
          mockSelect(table, cols);
          return {
            eq: (_key: string, val: string) => {
              mockEq(table, val);
              if (table === "organization_members" && val === ORG_ID) {
                return Promise.resolve({
                  data: [{ user_id: "u1" }, { user_id: "u2" }],
                  error: null,
                });
              }
              if (table === "users" && val === ORG_ID) {
                return Promise.resolve({ data: [], error: null });
              }
              return Promise.resolve({ data: [], error: null });
            },
            in: (_key: string, ids: string[]) => {
              mockIn(table, ids);
              if (table === "users") {
                const data = USERS.filter((u) => ids.includes(u.id));
                return Promise.resolve({ data, error: null });
              }
              return Promise.resolve({ data: [], error: null });
            },
          };
        },
      };
    },
  },
}));

import { extractMentionUserIds } from "../../utils/mentionParser";

describe("mentionParser (plain @mention resolution)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not resolve @risk to any user (substring of Risk Manager)", async () => {
    const ids = await extractMentionUserIds("Please check @risk", ORG_ID);
    expect(ids).toEqual([]);
  });

  it("does not resolve @job to any user", async () => {
    const ids = await extractMentionUserIds("Assign this @job", ORG_ID);
    expect(ids).toEqual([]);
  });

  it("resolves exact @Full Name to user u1 (case-insensitive)", async () => {
    const ids = await extractMentionUserIds("Hi @Full Name", ORG_ID);
    expect(ids).toContain("u1");
    expect(ids).toHaveLength(1);
  });

  it("resolves exact @email@example.com to user u1", async () => {
    const ids = await extractMentionUserIds(
      "Notify @email@example.com",
      ORG_ID
    );
    expect(ids).toContain("u1");
    expect(ids).toHaveLength(1);
  });

  it("resolves @full name (lowercase) to u1 via case-insensitive match", async () => {
    const ids = await extractMentionUserIds("Hi @full name", ORG_ID);
    expect(ids).toContain("u1");
  });
});
