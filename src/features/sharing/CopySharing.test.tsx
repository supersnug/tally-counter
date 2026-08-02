import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopySharePrompt, ShareCounterModal } from "./CopySharing";

afterEach(cleanup);

describe("copy sharing prompts", () => {
  it("sends only the selected linked data", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    const counter = { name: "Automated", value: 4 };
    const script = { language: "tallyscript", source: "add 1" };
    const customization = { parts: { count: { scaleX: 1.2 } } };
    render(
      <ShareCounterModal
        counter={counter}
        script={script}
        customization={customization}
        onSend={onSend}
        onClose={vi.fn()}
      />,
    );

    await user.type(
      screen.getByLabelText("Recipient email or username"),
      "friend",
    );
    await user.click(screen.getByText("Include this counter’s script"));
    await user.click(
      screen.getByRole("button", { name: /send counter copy/i }),
    );

    expect(onSend).toHaveBeenCalledWith("friend", counter, null, {
      script,
      customization: null,
    });
  });

  it("requires and forwards the sharing PIN when locked", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    const counter = { name: "Locked counter", value: 3 };
    render(
      <ShareCounterModal
        counter={counter}
        pinRequired
        onSend={onSend}
        onClose={vi.fn()}
      />,
    );

    await user.type(
      screen.getByLabelText("Recipient email or username"),
      "friend",
    );
    await user.type(screen.getByLabelText("Sharing PIN"), "123456");
    await user.click(
      screen.getByRole("button", { name: /send counter copy/i }),
    );

    expect(onSend).toHaveBeenCalledWith("friend", counter, "123456", {
      script: null,
      customization: null,
    });
    expect(
      screen.getByText("Include this counter’s script"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not have a script to include/i),
    ).toBeInTheDocument();
  });

  it("accepts an incoming counter as local when selected", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn().mockResolvedValue(undefined);
    const incoming = {
      id: 4,
      senderUsername: "counter_friend",
      counter_data: { name: "Shared laps", value: 12 },
    };
    render(
      <CopySharePrompt
        incoming={incoming}
        outcome={null}
        onAccept={onAccept}
        onDeny={vi.fn()}
        onAcknowledge={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Accept copy" }));

    expect(onAccept).toHaveBeenCalledWith(incoming, {
      localOnly: true,
      includeScript: true,
      includeCustomization: true,
    });
  });

  it("acknowledges a sender outcome", async () => {
    const user = userEvent.setup();
    const onAcknowledge = vi.fn().mockResolvedValue(undefined);
    const outcome = {
      id: 8,
      accepted: false,
      recipientUsername: "other_user",
    };
    render(
      <CopySharePrompt
        incoming={null}
        outcome={outcome}
        onAccept={vi.fn()}
        onDeny={vi.fn()}
        onAcknowledge={onAcknowledge}
      />,
    );

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(onAcknowledge).toHaveBeenCalledWith(outcome);
  });

  it("distinguishes disabled receiving from an explicit decline", () => {
    render(
      <CopySharePrompt
        incoming={null}
        outcome={{
          id: 9,
          accepted: false,
          response_reason: "sharing_disabled",
          recipientUsername: "private_user",
        }}
        onAccept={vi.fn()}
        onDeny={vi.fn()}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Copy could not be delivered" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/turned off incoming counter copies/i),
    ).toBeInTheDocument();
  });
});
