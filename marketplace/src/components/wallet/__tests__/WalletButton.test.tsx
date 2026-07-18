import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import WalletButton from "@/components/wallet/WalletButton";

const hookMocks = vi.hoisted(() => ({
  useWalletConnection: vi.fn(),
}));

vi.mock("@solana/react-hooks", () => ({
  useBalance: () => ({ lamports: null }),
  useWalletConnection: hookMocks.useWalletConnection,
}));

describe("WalletButton", () => {
  it("turns an unconfigured wallet rejection into an actionable message", async () => {
    const connect = vi
      .fn()
      .mockRejectedValue(new Error("You must first set up your wallet to interact with apps."));

    hookMocks.useWalletConnection.mockReturnValue({
      connect,
      connectors: [{ id: "test-wallet", name: "Test Wallet" }],
      currentConnector: undefined,
      disconnect: vi.fn(),
      error: undefined,
      status: "disconnected",
      wallet: undefined,
    });

    const user = userEvent.setup();
    render(<WalletButton />);

    await user.click(screen.getByRole("button", { name: /connect wallet/i }));
    await user.click(screen.getByRole("menuitem", { name: /test wallet/i }));

    expect(connect).toHaveBeenCalledWith("test-wallet", {
      allowInteractiveFallback: true,
    });
    expect(
      await screen.findByText(
        "Open your wallet extension and finish setup, then try again.",
      ),
    ).toBeInTheDocument();
  });
});
