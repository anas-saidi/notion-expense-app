import { describe, expect, it } from "vitest";
import { createCategorySuggester } from "./category-suggest";

const categories = [
  { id: "food", name: "Eating Out" },
  { id: "groceries", name: "Groceries" },
  { id: "travel", name: "Travel" },
];

describe("createCategorySuggester", () => {
  it("uses an exact past description that always went to one category", () => {
    const suggest = createCategorySuggester([{ description: "Pizza", categoryId: "food" }]);
    expect(suggest("pizza", categories)).toBe("food");
  });

  it("ignores exact matches that went to several categories or aren't allowed", () => {
    const suggest = createCategorySuggester([
      { description: "pizza", categoryId: "food" },
      { description: "pizza", categoryId: "travel" },
    ]);
    expect(suggest("pizza", categories)).toBeNull();
    expect(suggest("pizza", [{ id: "groceries", name: "Groceries" }])).toBeNull();
  });

  it("needs two agreeing fuzzy matches", () => {
    const history = [
      { description: "marjane groceries", categoryId: "groceries" },
      { description: "marjane market", categoryId: "groceries" },
    ];
    expect(createCategorySuggester(history)("marjane", categories)).toBe("groceries");
    expect(createCategorySuggester(history.slice(0, 1))("marjane", categories)).toBeNull();
  });

  it("falls back to a category named in the description", () => {
    const suggest = createCategorySuggester([]);
    expect(suggest("groceries at the corner", categories)).toBe("groceries");
    expect(suggest("xy", categories)).toBeNull();
  });
});
