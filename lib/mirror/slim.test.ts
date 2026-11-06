import { expect, it } from "vitest";
import { slimMirrorPage } from "./slim";

it("drops page metadata and rich-text styling the app never reads", () => {
  const page = {
    object: "page", id: "p1", created_time: "2026-11-01T10:00:00.000Z", last_edited_time: "2026-11-02T10:00:00.000Z",
    created_by: { object: "user", id: "u1" }, last_edited_by: { object: "user", id: "u1" },
    cover: null, icon: { type: "emoji", emoji: "🛒" }, parent: { type: "database_id", database_id: "db" },
    archived: false, in_trash: false, url: "https://www.notion.so/p1", public_url: null, request_id: "r1",
    properties: {
      Name: { id: "title", type: "title", title: [{ type: "text", text: { content: "Groceries", link: null }, annotations: { bold: false }, plain_text: "Groceries", href: null }] },
      Amount: { id: "a", type: "number", number: 120 },
      Who: { id: "m", type: "rich_text", rich_text: [{ type: "mention", mention: { type: "page", page: { id: "x" } }, annotations: {}, plain_text: "Salma", href: "https://www.notion.so/x" }] },
      Account: { id: "r", type: "relation", relation: [{ id: "acc" }], has_more: false },
    },
  };
  expect(slimMirrorPage(page)).toEqual({
    object: "page", id: "p1", created_time: "2026-11-01T10:00:00.000Z", last_edited_time: "2026-11-02T10:00:00.000Z",
    icon: { type: "emoji", emoji: "🛒" }, parent: { type: "database_id", database_id: "db" }, archived: false, in_trash: false,
    properties: {
      Name: { id: "title", type: "title", title: [{ type: "text", text: { content: "Groceries" }, plain_text: "Groceries" }] },
      Amount: { id: "a", type: "number", number: 120 },
      Who: { id: "m", type: "rich_text", rich_text: [{ type: "mention", mention: { type: "page", page: { id: "x" } }, plain_text: "Salma" }] },
      Account: { id: "r", type: "relation", relation: [{ id: "acc" }], has_more: false },
    },
  });
});
