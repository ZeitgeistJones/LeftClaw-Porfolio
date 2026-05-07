import React from "react";
import { Address } from "@scaffold-ui/components";
import { base } from "viem/chains";
import { SwitchTheme } from "~~/components/SwitchTheme";

const V2_ADDRESS = "0xb2fb486a9569ad2c97d9c73936b46ef7fdaa413a" as `0x${string}`;
const V1_ADDRESS = "0x103c5FAfd8734AE9Ec4Cc2f116eD03Ff6cc2Ca5F" as `0x${string}`;
const REPO_URL = "https://github.com/clawdbotatg/leftclaw-service-job-94";

/**
 * Site footer — Portfolio Explorer disclosures + project links.
 * No SE2 branding, no nativeCurrencyPrice badge, no localhost faucet.
 */
export const Footer = () => {
  return (
    <footer className="w-full mt-20 border-t border-base-300/60 bg-base-100">
      <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-6">
        <p className="text-sm leading-relaxed opacity-80 my-0">
          <strong>LeftClaw Portfolio Explorer</strong> — a community tool built by a CLAWD community member using
          LeftClaw Services beta.
        </p>
        <p className="text-sm leading-relaxed opacity-70 my-0">
          To the CLAWD core team: if you like this idea and want to build a production-grade version, consider this a
          proof of concept — take it and run with it. Would love to see it done right.
        </p>
        <p className="text-sm leading-relaxed opacity-60 my-0">
          What this version doesn&apos;t do: relies on a manually maintained list of historical contract addresses and a
          third-party API for AI-generated job summaries. A production version could auto-discover new deployments via
          an ENS text record and generate summaries natively within the LeftClaw pipeline so every job ships with a
          plain-English description from day one. That&apos;s the version this community deserves.
        </p>
        <div className="flex flex-col gap-3 pt-4 border-t border-base-300/40">
          <p className="text-xs uppercase tracking-wider text-base-content/45 my-0">Contracts</p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-base-content/55 font-mono">V2</span>
              <Address address={V2_ADDRESS} chain={base} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-base-content/55 font-mono">V1</span>
              <Address address={V1_ADDRESS} chain={base} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm mt-2">
            <a
              href={`https://basescan.org/address/${V2_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="link link-hover opacity-80 hover:opacity-100"
            >
              V2 on Basescan
            </a>
            <span className="opacity-30">·</span>
            <a
              href={`https://basescan.org/address/${V1_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="link link-hover opacity-80 hover:opacity-100"
            >
              V1 on Basescan
            </a>
            <span className="opacity-30">·</span>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="link link-hover opacity-80 hover:opacity-100"
            >
              GitHub
            </a>
            <span className="opacity-30">·</span>
            <a
              href="https://leftclaw.services"
              target="_blank"
              rel="noreferrer"
              className="link link-hover opacity-80 hover:opacity-100"
            >
              LeftClaw Services
            </a>
            <span className="opacity-30">·</span>
            <SwitchTheme />
          </div>
        </div>
      </div>
    </footer>
  );
};
