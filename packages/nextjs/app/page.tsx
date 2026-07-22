"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { isAddress } from "viem";
import { EcosystemStats } from "~~/components/portfolio/EcosystemStats";
import { Hero } from "~~/components/portfolio/Hero";
import { HowItWorks } from "~~/components/portfolio/HowItWorks";
import { PortfolioView } from "~~/components/portfolio/PortfolioView";
import { WalletLeaderboard } from "~~/components/portfolio/WalletLeaderboard";
import { useEcosystem } from "~~/lib/leftclaw/useEcosystem";

/**
 * Root page — renders either the landing/hero (no ?wallet= param) or the
 * full portfolio view (?wallet=0x...). We read the query param from
 * `window.location.search` directly because this app is statically exported
 * and `useSearchParams` requires a Suspense boundary that fights the static
 * pipeline.
 */
const Home: NextPage = () => {
  const [walletParam, setWalletParam] = useState<`0x${string}` | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Read wallet param + listen for hash/back navigation.
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      const w = params.get("wallet");
      if (w && isAddress(w)) {
        setWalletParam(w as `0x${string}`);
      } else {
        setWalletParam(null);
      }
      setHydrated(true);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const explore = (address: `0x${string}`) => {
    const url = `${window.location.pathname}?wallet=${address}`;
    window.history.pushState(null, "", url);
    setWalletParam(address);
  };

  const back = () => {
    window.history.pushState(null, "", window.location.pathname);
    setWalletParam(null);
  };

  if (!hydrated) {
    // Match the post-hydration layout (no flash) — empty hero shell.
    return <div className="min-h-[60vh]" />;
  }

  if (walletParam) {
    return <PortfolioView address={walletParam} onBack={back} />;
  }

  return <HomeLanding onExplore={explore} />;
};

/** Landing-only shell so the ecosystem scan mounts once and unmounts on portfolio view. */
const HomeLanding = ({ onExplore }: { onExplore: (address: `0x${string}`) => void }) => {
  const { totalJobs, uniqueWallets, serviceTypeCounts, serviceTypes, wallets, ready, error } = useEcosystem();

  return (
    <>
      <Hero onExplore={onExplore} />
      <EcosystemStats
        totalJobs={totalJobs}
        uniqueWallets={uniqueWallets}
        serviceTypeCounts={serviceTypeCounts}
        serviceTypes={serviceTypes}
        ready={ready}
        error={error}
      />
      <WalletLeaderboard wallets={wallets} ready={ready} error={error} onExplore={onExplore} />
      <HowItWorks />
    </>
  );
};

export default Home;
