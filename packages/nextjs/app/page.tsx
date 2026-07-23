"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { isAddress } from "viem";
import { EcosystemStats } from "~~/components/portfolio/EcosystemStats";
import { Hero } from "~~/components/portfolio/Hero";
import { HowItWorks } from "~~/components/portfolio/HowItWorks";
import { type GalleryView, JobGallery } from "~~/components/portfolio/JobGallery";
import { PortfolioView } from "~~/components/portfolio/PortfolioView";
import { WalletLeaderboard } from "~~/components/portfolio/WalletLeaderboard";
import { useEcosystem } from "~~/lib/leftclaw/useEcosystem";

/**
 * Root page — landing, gallery (?view=builds|audits), or portfolio (?wallet=0x…).
 * Query params are read from `window.location.search` because this app is
 * statically exported and `useSearchParams` needs a Suspense boundary that
 * fights that pipeline. Wallet wins when both params are present.
 */
const Home: NextPage = () => {
  const [walletParam, setWalletParam] = useState<`0x${string}` | null>(null);
  const [viewParam, setViewParam] = useState<GalleryView | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      const w = params.get("wallet");
      const v = params.get("view");
      if (w && isAddress(w)) {
        setWalletParam(w as `0x${string}`);
        setViewParam(null);
      } else {
        setWalletParam(null);
        setViewParam(v === "builds" || v === "audits" ? v : null);
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
    setViewParam(null);
  };

  const openView = (view: GalleryView) => {
    const url = `${window.location.pathname}?view=${view}`;
    window.history.pushState(null, "", url);
    setViewParam(view);
    setWalletParam(null);
  };

  const backToLanding = () => {
    window.history.pushState(null, "", window.location.pathname);
    setWalletParam(null);
    setViewParam(null);
  };

  if (!hydrated) {
    return <div className="min-h-[60vh]" />;
  }

  if (walletParam) {
    return <PortfolioView address={walletParam} onBack={backToLanding} />;
  }

  return <HomeLanding onExplore={explore} view={viewParam} onBrowse={openView} onBackFromView={backToLanding} />;
};

/** Landing shell — ecosystem scan stays mounted when switching to the gallery. */
const HomeLanding = ({
  onExplore,
  view,
  onBrowse,
  onBackFromView,
}: {
  onExplore: (address: `0x${string}`) => void;
  view: GalleryView | null;
  onBrowse: (view: GalleryView) => void;
  onBackFromView: () => void;
}) => {
  const { totalJobs, uniqueWallets, serviceTypeCounts, serviceTypes, wallets, jobs, ready, error } = useEcosystem();

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
        onBrowse={onBrowse}
      />
      {view ? (
        <JobGallery
          view={view}
          jobs={jobs}
          serviceTypes={serviceTypes}
          ready={ready}
          error={error}
          onBack={onBackFromView}
          onExplore={onExplore}
          onViewChange={onBrowse}
        />
      ) : (
        <>
          <WalletLeaderboard
            wallets={wallets}
            jobs={jobs}
            serviceTypes={serviceTypes}
            ready={ready}
            error={error}
            onExplore={onExplore}
          />
          <HowItWorks />
        </>
      )}
    </>
  );
};

export default Home;
