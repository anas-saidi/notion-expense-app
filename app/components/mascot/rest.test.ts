import { describe, expect, it, vi } from "vitest";
import Matter from "matter-js";
import { MascotEngine } from "./engine";
import { MatterCoinSim } from "./coinSimMatter";
import { coinSlots } from "./coins";
import { jarShape } from "./poses";
const items = [{ id: "a", glyph: "🚨", radius: 0.38 }, { id: "b", glyph: "😎", radius: 0.18 }, { id: "c", glyph: "🧾", radius: 0.22 }];
describe("resting jar contents", () => {
  it("keeps settled contents fixed through idle breathing", () => {
    const engine = new MascotEngine({ scope: "anas", gap: 0, mood: "idle", outline: "partner", items });
    for (let i = 0; i < 1200; i++) engine.sample(i / 60);
    const rest = engine.sample(20).coins;
    for (let i = 1201; i < 1440; i++) expect(engine.sample(i / 60).coins).toEqual(rest);
  });
  it("skips sleeping physics and wakes for tilt, resize, removal, arrival and shake", () => {
    const sim = new MatterCoinSim();
    const jar = jarShape("partner", "anas");
    sim.setOutline(jar.radii); sim.seedItems(items, coinSlots(jar));
    const settle = () => { for (let i = 0; i < 1200; i++) sim.step(1 / 60); };
    settle();
    const update = vi.spyOn(Matter.Engine, "update");
    try {
      sim.step(1 / 60); expect(update).not.toHaveBeenCalled();
      for (const wake of [() => { sim.tilt = 0.3; }, () => sim.resizeItem("a", 0.3), () => sim.removeItem("b"), () => sim.addItem({ id: "d", glyph: "🏠", radius: 0.15 }, 0.1), () => sim.kick(1, -1)]) {
        update.mockClear(); wake();
        for (let i = 0; i < 30; i++) sim.step(1 / 60);
        expect(update).toHaveBeenCalled(); settle();
      }
    } finally { update.mockRestore(); }
  });
});
