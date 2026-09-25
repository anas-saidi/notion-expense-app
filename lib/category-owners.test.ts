import { describe, it, expect } from "vitest";
import { accountOwnerScope, categoryOwnerPeople } from "./category-owners";
const props = (...ids: string[]) => ({ Owner: { type: "people", people: ids.map(id => ({ id, name: "Display name" })) } });
describe("category owners", () => {
  it("persists both joint account identities", () => expect(categoryOwnerPeople(props("anas-id", "salma-id"), "joint")).toEqual([{ id: "anas-id" }, { id: "salma-id" }]));
  it.each(["anas", "salma"])("persists the personal account identity for %s", scope => expect(categoryOwnerPeople(props(scope), scope)).toEqual([{ id: scope }]));
  it("rejects missing or incomplete owners instead of creating an ownerless category", () => {
    expect(() => categoryOwnerPeople({}, "joint")).toThrow();
    expect(() => categoryOwnerPeople(props("one", "one"), "joint")).toThrow();
    expect(() => categoryOwnerPeople(props("one", "two"), "anas")).toThrow();
  });
  it("accepts one or two owners when the account scope is unknown", () => {
    expect(categoryOwnerPeople(props("one"), null)).toEqual([{ id: "one" }]);
    expect(categoryOwnerPeople(props("one", "two"), null)).toHaveLength(2);
    expect(() => categoryOwnerPeople({}, null)).toThrow();
  });
  it("reads the expected scope from the account title", () => {
    const titled = (label: string) => ({ Name: { type: "title", title: [{ plain_text: label }] } });
    expect(accountOwnerScope(titled("Joined Account"))).toBe("joint");
    expect(accountOwnerScope(titled("Wife Account"))).toBe("salma");
    expect(accountOwnerScope(titled("Joint Savings"))).toBeNull();
    expect(accountOwnerScope({})).toBeNull();
  });
});
