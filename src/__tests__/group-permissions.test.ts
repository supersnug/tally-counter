import { describe, expect, it } from "vitest";
import {
  GROUP_PERMISSION_OPTIONS,
  presetPermissions,
} from "../features/groups/permissions";

describe("shared group permission presets", () => {
  it("grants every permission to full access", () => {
    expect(presetPermissions("full_access")).toEqual(
      GROUP_PERMISSION_OPTIONS.map(([key]) => key),
    );
  });

  it("keeps counting-only access limited to counter actions", () => {
    expect(presetPermissions("count_only")).toEqual([
      "add",
      "subtract",
      "reset",
    ]);
  });

  it("distinguishes indicators from quick settings", () => {
    const permissions = presetPermissions("cosmetic_only");
    expect(permissions).toContain("superedit_min_indicator");
    expect(permissions).toContain("superedit_min_setting");
    expect(permissions).toContain("superedit_max_indicator");
    expect(permissions).toContain("superedit_max_setting");
  });

  it("returns only explicitly selected custom permissions", () => {
    expect(presetPermissions("custom", ["add", "scripting_ts"])).toEqual([
      "add",
      "scripting_ts",
    ]);
  });
});
