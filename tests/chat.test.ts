import { describe, expect, it } from "vitest";
import { detectGrade, detectPart, isGreeting, isRepairIntent, isShopInfo, matchDevice, type DeviceLite } from "@/lib/chat/parse";

const D = (id: string, brand: string, name: string, models: string[] = []): DeviceLite => ({ id, brand, name, model_numbers: models });
const devices = [
  D("i15", "Apple", "iPhone 15"), D("i15pm", "Apple", "iPhone 15 Pro Max"), D("i13", "Apple", "iPhone 13"), D("i13p", "Apple", "iPhone 13 Pro"),
  D("a54", "Samsung", "Galaxy A54", ["SM-A546E"]), D("rn12", "Xiaomi", "Redmi Note 12"), D("a78", "Oppo", "A78"), D("n30", "Infinix", "Note 30"),
];

describe("chat: phone model matching", () => {
  it("finds exact models, longest name wins", () => {
    expect(matchDevice("iphone 15 pro max original lcd price", devices).device?.id).toBe("i15pm");
    expect(matchDevice("iPhone13 battery", devices).device?.id).toBe("i13");
    expect(matchDevice("iphone 13 pro screen", devices).device?.id).toBe("i13p");
    expect(matchDevice("a54 ka pannel kitne ka hai", devices).device?.id).toBe("a54");
    expect(matchDevice("SM-A546E battery", devices).device?.id).toBe("a54");
    expect(matchDevice("redmi note 12 lcd", devices).device?.id).toBe("rn12");
    expect(matchDevice("oppo a78 battery", devices).device?.id).toBe("a78");
  });
  it("never guesses a model we don't list", () => {
    const r = matchDevice("iphone 15 pro original lcd price", devices);
    expect(r.device).toBeUndefined();
    expect(r.near).toBe("iPhone 15 Pro");
    expect(r.suggestions?.map((d) => d.id)).toContain("i15pm");
  });
});

describe("chat: part, grade and intent", () => {
  it("understands parts incl. Roman Urdu spellings", () => {
    expect(detectPart("original lcd price")).toBe("displays");
    expect(detectPart("pannel kitne ka")).toBe("displays");
    expect(detectPart("bettery available?")).toBe("batteries");
    expect(detectPart("back glass broken")).toBe("back-glass");
    expect(detectPart("charging port issue")).toBe("charging-ports");
    expect(detectPart("20w charger")).toBe("chargers");
    expect(detectPart("power bank price")).toBe("power-banks");
  });
  it("understands grades", () => {
    expect(detectGrade("original lcd")).toBe("ORIG_NEW");
    expect(detectGrade("orignal panel")).toBe("ORIG_NEW");
    expect(detectGrade("oem battery")).toBe("OEM");
    expect(detectGrade("copy screen")).toBe("PREMIUM");
    expect(detectGrade("lcd price")).toBeUndefined();
  });
  it("detects greetings, repairs and shop-info questions", () => {
    expect(isGreeting("Assalam o alaikum")).toBe(true);
    expect(isRepairIntent("screen toot gayi hai change karni hai")).toBe(true);
    expect(isRepairIntent("lcd price")).toBe(false);
    expect(isShopInfo("shop kahan hai")).toBe(true);
    expect(isShopInfo("sunday ko open ho?")).toBe(true);
  });
});
