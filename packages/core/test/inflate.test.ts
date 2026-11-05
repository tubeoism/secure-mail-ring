import fc from "fast-check";
import { deflateSync } from "fflate";
import { describe, expect, it } from "vitest";
import { MAX_INFLATED_BYTES, inflateCapped } from "../src/codec";

// CL-05E: the output cap must stop the work, not only reject the result. A deflate stream can
// expand about 1000 times, so inflating it in one push would build the whole output first.
describe("inflateCapped", () => {
  it("returns the original bytes, also when the input spans many pieces", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 4000 }), (bytes) => {
        const out = inflateCapped(deflateSync(bytes));
        expect(out && Array.from(out)).toEqual(Array.from(bytes));
      }),
    );
  });

  it("accepts output of exactly the cap and refuses one byte more", () => {
    const exact = inflateCapped(deflateSync(new Uint8Array(MAX_INFLATED_BYTES)));
    expect(exact?.length).toBe(MAX_INFLATED_BYTES);
    expect(() => inflateCapped(deflateSync(new Uint8Array(MAX_INFLATED_BYTES + 1)))).toThrow();
  });

  it("stops a 300 MB expansion early, in little time and with little memory", () => {
    const bomb = deflateSync(new Uint8Array(300 * 1024 * 1024), { level: 9 });
    expect(bomb.length).toBeLessThan(400 * 1024);
    const before = process.memoryUsage().arrayBuffers;
    const started = Date.now();
    expect(() => inflateCapped(bomb)).toThrow();
    expect(Date.now() - started).toBeLessThan(2000);
    expect(process.memoryUsage().arrayBuffers - before).toBeLessThan(40 * 1024 * 1024);
  });

  it("returns null for data that is not deflate and for a truncated stream", () => {
    expect(inflateCapped(Uint8Array.from([0xff, 0xff, 0xff, 0xff]))).toBeNull();
    const whole = deflateSync(new Uint8Array(5000).map((_, i) => (i * 7) & 255));
    expect(inflateCapped(whole.subarray(0, whole.length - 10))).toBeNull();
  });

  it("gives no output for empty input (the caller then fails on the empty JSON)", () => {
    expect(inflateCapped(new Uint8Array(0))).toEqual(new Uint8Array(0));
  });
});
