import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GroupSettings } from "../features/groups/SharedGroups";

describe("group account settings", () => {
  afterEach(cleanup);

  it("renders safely before any groups have loaded", () => {
    render(<GroupSettings session={{ user: { id: "user-1" } }} />);

    expect(screen.getByPlaceholderText("New group name")).toBeVisible();
    expect(screen.getByRole("button", { name: /create group/i })).toBeVisible();
  });
});
