import { wagmiConnectors } from "./wagmiConnectors";
import { Chain, createClient, fallback, http } from "viem";
import { base, hardhat, mainnet } from "viem/chains";
import { createConfig } from "wagmi";
import scaffoldConfig, { DEFAULT_ALCHEMY_API_KEY, ScaffoldConfig } from "~~/scaffold.config";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";

const { targetNetworks } = scaffoldConfig;

const BASE_PUBLIC_RPC = "https://mainnet.base.org";

// We always want to have mainnet enabled (ENS resolution, ETH price, etc). But only once.
export const enabledChains = targetNetworks.find((network: Chain) => network.id === 1)
  ? targetNetworks
  : ([...targetNetworks, mainnet] as const);

export const wagmiConfig = createConfig({
  chains: enabledChains,
  connectors: wagmiConnectors(),
  ssr: true,
  client: ({ chain }) => {
    // Mainnet always gets the BuidlGuidl public RPC as a backstop for ENS /
    // ETH-price lookups. Base also gets mainnet.base.org after Alchemy so a
    // dead/rate-limited Alchemy key (403) does not freeze ecosystem reads.
    const mainnetFallbackWithDefaultRPC = chain.id === mainnet.id ? [http("https://mainnet.rpc.buidlguidl.com")] : [];

    let rpcFallbacks: ReturnType<typeof http>[] = [...mainnetFallbackWithDefaultRPC];

    const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as ScaffoldConfig["rpcOverrides"])?.[chain.id];
    if (rpcOverrideUrl) {
      rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks];
    } else {
      const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
      if (alchemyHttpUrl) {
        const isUsingDefaultKey = scaffoldConfig.alchemyApiKey === DEFAULT_ALCHEMY_API_KEY;
        rpcFallbacks = isUsingDefaultKey
          ? [...rpcFallbacks, http(alchemyHttpUrl)]
          : [http(alchemyHttpUrl), ...rpcFallbacks];
      }
    }

    // Prefer public Base first when using the shared/default Alchemy key —
    // that key returns 403 and only wastes latency before fallback.
    if (chain.id === base.id) {
      const isDefaultAlchemy = scaffoldConfig.alchemyApiKey === DEFAULT_ALCHEMY_API_KEY;
      rpcFallbacks = isDefaultAlchemy
        ? [http(BASE_PUBLIC_RPC), ...rpcFallbacks]
        : [...rpcFallbacks, http(BASE_PUBLIC_RPC)];
    }

    return createClient({
      chain,
      transport: fallback(rpcFallbacks),
      ...(chain.id !== (hardhat as Chain).id ? { pollingInterval: scaffoldConfig.pollingInterval } : {}),
    });
  },
});
