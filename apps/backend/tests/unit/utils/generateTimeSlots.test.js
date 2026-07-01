import { generateTimeSlots } from "../../../src/utils/generateTimeSlots.js";

describe("generateTimeSlots", () => {
  test("generates correct slots with hourly interval", () => {
    const slots = generateTimeSlots("09:00", "12:00", 60);
    expect(slots).toEqual(["09:00:00", "10:00:00", "11:00:00"]);
  });

  test("generates correct slots with half-hourly interval", () => {
    const slots = generateTimeSlots("09:00", "10:30", 30);
    expect(slots).toEqual(["09:00:00", "09:30:00", "10:00:00"]);
  });

  test("returns empty array if start time + interval exceeds end time", () => {
    const slots = generateTimeSlots("09:00", "09:15", 30);
    expect(slots).toEqual([]);
  });

  test("handles interval that matches the duration exactly", () => {
    const slots = generateTimeSlots("09:00", "10:00", 60);
    expect(slots).toEqual(["09:00:00"]);
  });
});
