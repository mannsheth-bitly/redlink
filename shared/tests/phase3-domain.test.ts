import { describe, expect, it } from "vitest";
import { haversineKm } from "../src/domain/geo";
import { canSendContactRequest, nextContactStatus, snapToGrid } from "../src/domain/privacy";

describe("snapToGrid", () => {
  it("never returns the exact location", () => {
    const p = { lat: 19.07312, lng: 72.89876 };
    const s = snapToGrid(p);
    expect(s).not.toEqual(p);
    expect(s).toEqual({ lat: 19.075, lng: 72.895 });
  });

  it("is always within ~0.8 km of the real point", () => {
    for (const p of [
      { lat: 19.0, lng: 72.9 },
      { lat: 19.0099, lng: 72.9099 },
      { lat: 18.9071, lng: 72.8151 },
      { lat: 19.30123, lng: 72.85167 },
    ]) {
      expect(haversineKm(p, snapToGrid(p))).toBeLessThan(0.8);
    }
  });

  it("puts neighbours in the same square at the same point", () => {
    expect(snapToGrid({ lat: 19.0711, lng: 72.9012 })).toEqual(snapToGrid({ lat: 19.0789, lng: 72.9088 }));
  });

  it("separates points in different squares", () => {
    expect(snapToGrid({ lat: 19.0711, lng: 72.9012 })).not.toEqual(snapToGrid({ lat: 19.0811, lng: 72.9012 }));
  });
});

describe("contact requests", () => {
  it("only PENDING can be answered", () => {
    expect(nextContactStatus("PENDING", "ACCEPT")).toEqual({ status: "ACCEPTED" });
    expect(nextContactStatus("PENDING", "DECLINE")).toEqual({ status: "DECLINED" });
    expect(nextContactStatus("ACCEPTED", "DECLINE")).toHaveProperty("error");
    expect(nextContactStatus("DECLINED", "ACCEPT")).toHaveProperty("error");
  });

  it("blocks duplicates while pending or accepted, allows after a decline", () => {
    expect(canSendContactRequest([])).toEqual({ ok: true });
    expect(canSendContactRequest(["DECLINED"])).toEqual({ ok: true });
    expect(canSendContactRequest(["DECLINED", "PENDING"])).toHaveProperty("error");
    expect(canSendContactRequest(["ACCEPTED"])).toHaveProperty("error");
  });
});
