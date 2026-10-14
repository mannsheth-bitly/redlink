import { describe, expect, it } from "vitest";
import { boundingBox, formatPublicDistance, haversineKm, roundToHalfKm } from "../src/domain/geo";

const CSMT = { lat: 18.9398, lng: 72.8355 };
const GHATKOPAR = { lat: 19.0863, lng: 72.9081 };

describe("haversineKm", () => {
  it("is 0 for the same point", () => {
    expect(haversineKm(CSMT, CSMT)).toBe(0);
  });

  it("CSMT -> Ghatkopar station is ~18 km in a straight line", () => {
    // The spec quoted 12–13 km; the straight-line distance is ~18.0 km (see docs/DECISIONS.md).
    const d = haversineKm(CSMT, GHATKOPAR);
    expect(d).toBeGreaterThan(17.5);
    expect(d).toBeLessThan(18.5);
  });

  it("is symmetric", () => {
    expect(haversineKm(CSMT, GHATKOPAR)).toBeCloseTo(haversineKm(GHATKOPAR, CSMT), 10);
  });

  it("one degree of latitude is ~111 km", () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
  });
});

describe("boundingBox", () => {
  it("contains every point within the radius (sampled around the circle)", () => {
    const center = { lat: 19.07, lng: 72.9 };
    const radiusKm = 25;
    const box = boundingBox(center, radiusKm);
    // Walk outward along 72 bearings until just past the radius; the last point inside must be in the box.
    for (let deg = 0; deg < 360; deg += 5) {
      const b = (deg * Math.PI) / 180;
      let inside = center;
      for (let step = 0.01; ; step += 0.01) {
        const p = {
          lat: center.lat + (step * Math.cos(b)) / 111.195,
          lng: center.lng + (step * Math.sin(b)) / (111.195 * Math.cos((center.lat * Math.PI) / 180)),
        };
        if (haversineKm(center, p) > radiusKm) break;
        inside = p;
      }
      expect(inside.lat).toBeGreaterThanOrEqual(box.minLat);
      expect(inside.lat).toBeLessThanOrEqual(box.maxLat);
      expect(inside.lng).toBeGreaterThanOrEqual(box.minLng);
      expect(inside.lng).toBeLessThanOrEqual(box.maxLng);
    }
  });
});

describe("public distance rounding", () => {
  it.each([
    [3.24, 3],
    [3.26, 3.5],
    [3.74, 3.5],
    [3.76, 4],
    [0.2, 0],
  ])("%d km rounds to %d", (input, expected) => {
    expect(roundToHalfKm(input)).toBe(expected);
  });

  it("formats for display", () => {
    expect(formatPublicDistance(3.4)).toBe("~3.5 km");
    expect(formatPublicDistance(0.1)).toBe("< 0.5 km");
  });
});
