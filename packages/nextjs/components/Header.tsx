"use client";

import React from "react";
import Link from "next/link";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

/**
 * Site header — Portfolio Explorer.
 * No SE2 branding, no debug/blockexplorer nav, no faucet.
 */
export const Header = () => {
  return (
    <header className="sticky top-0 z-20 navbar bg-base-100/85 backdrop-blur border-b border-base-300/60 min-h-0 px-4 sm:px-6 py-3">
      <div className="navbar-start w-auto">
        <Link href="/" passHref className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
            P
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sm">Portfolio Explorer</span>
            <span className="text-[10px] opacity-60 tracking-wide">for LeftClaw Services</span>
          </div>
        </Link>
      </div>
      <div className="navbar-end grow">
        <RainbowKitCustomConnectButton />
      </div>
    </header>
  );
};
