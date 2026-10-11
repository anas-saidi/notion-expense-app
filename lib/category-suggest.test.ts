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

it("maps veggies to one available groceries category without inventing one", () => {
  const suggest = createCategorySuggester([]);
  expect(suggest("veggies", categories)).toBe("groceries");
  expect(suggest("this morning got vegetables for 300", categories)).toBe("groceries");
  expect(suggest("veggies", [{ id: "food", name: "Eating Out" }])).toBeNull();
  expect(suggest("veggies", [...categories, { id: "other", name: "Groceries personal" }])).toBeNull();
});
