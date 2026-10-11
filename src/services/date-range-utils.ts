import { NodeMessageInFlow } from "node-red";

export class DateRangeUtils {
  /**
   * Reads the optional msg.startDate / msg.endDate (calendar days,
   * YYYY-MM-DD) used to fetch past data. Neither set means today; only
   * startDate set means startDate until today; only endDate set means just
   * that day.
   */
  static parseDateRange(msg: NodeMessageInFlow): {
    startDate?: string;
    endDate?: string;
  } {
    const startDate = DateRangeUtils.validate("startDate", (msg as any).startDate);
    let endDate = DateRangeUtils.validate("endDate", (msg as any).endDate);
    if (startDate && !endDate) {
      endDate = new Date().toISOString().slice(0, 10);
    }
    if (startDate && endDate && startDate > endDate) {
      throw new Error(
        `msg.startDate (${startDate}) must not be after msg.endDate (${endDate})`,
      );
    }
    return { startDate, endDate };
  }

  private static validate(name: string, value: unknown): string | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    const time =
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? Date.parse(`${value}T00:00:00.000Z`)
        : NaN;
    // the round trip also rejects dates like 2026-02-31
    if (isNaN(time) || new Date(time).toISOString().slice(0, 10) !== value) {
      throw new Error(
        `msg.${name} must be a date in the format YYYY-MM-DD, got "${value}"`,
      );
    }
    return value;
  }
}
