"use client";

import { useEffect, useState } from "react";
import { AddressInput } from "@scaffold-ui/components";
import { useAddressInput } from "@scaffold-ui/hooks";
import { isAddress } from "viem";
import { useAccount } from "wagmi";

export const Hero = ({ onExplore }: { onExplore: (address: `0x${string}`) => void }) => {
  const { address: connectedAddress } = useAccount();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Pre-fill input when wallet connects, but only if user hasn't typed yet.
  useEffect(() => {
    if (connectedAddress && !input) setInput(connectedAddress);
  }, [connectedAddress, input]);

  // Resolve ENS → address so users can paste e.g. `vitalik.eth` and explore.
  const { ensAddress } = useAddressInput({ value: input });

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Enter a wallet address to start");
      return;
    }
    // If the input is a 0x address, use it directly. Otherwise, try the
    // resolved ENS address from useAddressInput.
    const candidate = isAddress(trimmed) ? trimmed : ensAddress && isAddress(ensAddress) ? ensAddress : null;
    if (!candidate) {
      setError("That doesn't look like a valid Ethereum address or ENS name");
      return;
    }
    setError(null);
    onExplore(candidate as `0x${string}`);
  };

  return (
    <section className="px-6 pt-12 pb-16">
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 ring-1 ring-primary/20 text-primary text-[11px] uppercase tracking-wider mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          LeftClaw community tool
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
          See what any wallet has built with <span className="text-primary">LeftClaw</span>.
        </h1>
        <p className="text-base text-base-content/65 max-w-xl mx-auto mb-8 my-0 leading-relaxed">
          Paste any Ethereum address — or connect your wallet — to see every build, audit, and consult shipped through
          LeftClaw Services. Each job is summarized in plain English.
        </p>

        <form
          onSubmit={e => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col sm:flex-row items-stretch gap-2 max-w-2xl mx-auto"
        >
          <div className="flex-1">
            <AddressInput
              value={input}
              onChange={(v: string) => setInput(v)}
              placeholder="0x... or ENS name"
              name="wallet"
            />
          </div>
          <button type="submit" className="btn btn-primary h-12 min-h-12 px-6 text-sm font-medium">
            Explore →
          </button>
        </form>
        {error && <p className="text-error text-xs mt-2 my-0">{error}</p>}

        <p className="mt-4 text-xs text-base-content/50 my-0">
          or connect your wallet (top right) to autofill your address
        </p>
      </div>
    </section>
  );
};
