// src/__tests__/components/sections.test.tsx
// Component snapshot and behavior tests for OverviewSection, MarketSection,
// and ProtocolCompareSection. Verifies:
//   - Rendered output snapshots (data present vs loading)
//   - Loading skeleton display when isLoading=true
//   - Key data elements appear when loaded

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import OverviewSection from "@/components/sections/OverviewSection";
import MarketSection from "@/components/sections/MarketSection";
import ProtocolCompareSection from "@/components/sections/ProtocolCompareSection";

// ─── Mock data ────────────────────────────────────────────────────────

const MOCK_OVERVIEW_DATA = {
  baseMetrics: { totalTvl: 1_500_000_000, totalProtocols: 8, avgApy: 4.5, change24h: 2.1 },
  tvlHistory: [
    { date: "Apr 1", tvl: 1_450_000_000 },
    { date: "Apr 2", tvl: 1_475_000_000 },
    { date: "Apr 3", tvl: 1_500_000_000 },
  ],
  protocols: [
    { id: "aerodrome", name: "Aerodrome", tvl: 800_000_000, change24h: 1.5, logo: "", category: "DEX" },
    { id: "seamless-protocol", name: "Seamless", tvl: 400_000_000, change24h: -0.3, logo: "", category: "Lending" },
    { id: "moonwell", name: "Moonwell", tvl: 300_000_000, change24h: 5.2, logo: "", category: "Lending" },
  ],
  protocolData: {
    aerodrome: { tvl: 800_000_000, tvlChange: 1.5, totalBorrow: 280_000_000, utilization: 35, feesAnnualized: 12_000_000, revenueAnnualized: 4_000_000, tokenPrice: null },
    "seamless-protocol": { tvl: 400_000_000, tvlChange: -0.3, totalBorrow: 140_000_000, utilization: 35, feesAnnualized: 6_000_000, revenueAnnualized: 2_000_000, tokenPrice: null },
    moonwell: { tvl: 300_000_000, tvlChange: 5.2, totalBorrow: 105_000_000, utilization: 35, feesAnnualized: 4_500_000, revenueAnnualized: 1_500_000, tokenPrice: null },
  },
  timestamp: Date.now(),
};

const MOCK_MARKET_DATA = {
  tokens: [
    { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3500, change24h: 2.5, volume24h: 15_000_000_000, marketCap: 420_000_000_000 },
    { id: "usdc", symbol: "USDC", name: "USD Coin", price: 1.0, change24h: 0.01, volume24h: 5_000_000_000, marketCap: 30_000_000_000 },
    { id: "cbeth", symbol: "cbETH", name: "Coinbase Staked ETH", price: 3600, change24h: 2.4, volume24h: 500_000_000, marketCap: 2_000_000_000 },
  ],
  topGainers: [
    { id: "aerodrome", symbol: "AERO", name: "Aerodrome", price: 1.2, change24h: 15.3, volume24h: 200_000_000, marketCap: 800_000_000 },
  ],
  topLosers: [
    { id: "extra-finance", symbol: "XFI", name: "Extra Finance", price: 0.05, change24h: -8.1, volume24h: 5_000_000, marketCap: 50_000_000 },
  ],
  topByVolume: [
    { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3500, change24h: 2.5, volume24h: 15_000_000_000, marketCap: 420_000_000_000 },
  ],
  summary: { totalTokens: 3, avgChange24h: 1.5, totalVolume24h: 20_500_000_000 },
  timestamp: Date.now(),
};

const MOCK_COMPARE_RESPONSE = {
  protocols: [
    { id: "aerodrome", name: "Aerodrome", tvl: 800_000_000, change_1d: 1.5, change_7d: 3.2, category: "DEX" },
    { id: "seamless-protocol", name: "Seamless", tvl: 400_000_000, change_1d: -0.3, change_7d: 4.1, category: "Lending" },
  ],
  timestamp: Date.now(),
};

// ─── Mocks ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

// Mock Tremor components — avoid heavy charting libs in test env
vi.mock("@tremor/react", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="tremor-card" className={className}>{children}</div>
  ),
  Title: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  Button: ({ children, onClick, className }: AnyRecord) => (
    <button onClick={onClick} className={className}>{children}</button>
  ),
  Select: ({ children, value }: AnyRecord) => (
    <div data-testid="tremor-select" data-value={value}>{children}</div>
  ),
  SelectItem: ({ children, value }: AnyRecord) => (
    <div data-testid="tremor-select-item" data-value={value}>{children}</div>
  ),
  BarChart: () => <div data-testid="tremor-bar-chart" />,
  LineChart: () => <div data-testid="tremor-line-chart" />,
}));

// Mock chart components that depend on Tremor
vi.mock("@/components/charts/BaseTVLChart", () => ({
  default: () => <div data-testid="base-tvl-chart">TVL Chart Mock</div>,
}));

// Mock BaseNetworkMetrics
vi.mock("@/components/sections/BaseNetworkMetrics", () => ({
  default: ({ data, isLoading }: { data: { totalTvl?: number } | null; isLoading: boolean }) => (
    <div data-testid="base-network-metrics">
      {isLoading ? "Loading metrics..." : `TVL: ${data?.totalTvl ?? "N/A"}`}
    </div>
  ),
}));

// Mock ProtocolSwitcher
interface MockProtocol { name: string }
vi.mock("@/components/ui/ProtocolSwitcher", () => ({
  default: ({ protocols, isLoading }: { protocols: MockProtocol[]; isLoading: boolean }) => (
    <div data-testid="protocol-switcher">
      {isLoading ? "Loading protocols..." : `Protocols: ${protocols.map((p) => p.name).join(", ")}`}
    </div>
  ),
}));

// ─── Tests ────────────────────────────────────────────────────────────

describe("OverviewSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeletons when isLoading=true", () => {
    const { container } = render(<OverviewSection data={null} isLoading={true} />);

    // MetricCard skeletons contain animate-pulse elements
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders data correctly when loaded", () => {
    render(<OverviewSection data={MOCK_OVERVIEW_DATA} isLoading={false} />);

    expect(screen.getByText("Base Network Overview")).toBeInTheDocument();
    expect(screen.getByTestId("base-network-metrics")).toHaveTextContent("TVL: 1500000000");
    expect(screen.getByTestId("protocol-switcher")).toHaveTextContent("Aerodrome");
  });

  it("shows freshness indicator when timestamp is present", () => {
    render(<OverviewSection data={MOCK_OVERVIEW_DATA} isLoading={false} />);

    expect(screen.getByText(/Updated/i)).toBeInTheDocument();
  });

  it("matches snapshot with data loaded", () => {
    const { container } = render(<OverviewSection data={MOCK_OVERVIEW_DATA} isLoading={false} />);
    expect(container.innerHTML).toMatchSnapshot("OverviewSection-loaded");
  });

  it("matches snapshot with loading state", () => {
    const { container } = render(<OverviewSection data={null} isLoading={true} />);
    expect(container.innerHTML).toMatchSnapshot("OverviewSection-loading");
  });
});

describe("MarketSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // MarketSection fetches /api/market on mount — mock it
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_MARKET_DATA),
    }));
  });

  it("renders loading skeletons when isLoading=true and no data", () => {
    const { container } = render(<MarketSection isLoading={true} data={null} />);

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders the Market section heading", () => {
    render(<MarketSection data={MOCK_MARKET_DATA} isLoading={false} />);

    expect(screen.getByText("Market Overview")).toBeInTheDocument();
  });

  it("renders token data after fetch resolves", async () => {
    render(<MarketSection data={MOCK_MARKET_DATA} isLoading={false} />);

    // Tokens appear after async fetch resolves
    await waitFor(() => {
      expect(screen.getByText("Ethereum")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("USD Coin")).toBeInTheDocument();
    });
  });

  it("matches snapshot with data loaded", () => {
    const { container } = render(<MarketSection data={MOCK_MARKET_DATA} isLoading={false} />);
    expect(container.innerHTML).toMatchSnapshot("MarketSection-loaded");
  });

  it("matches snapshot with loading state", () => {
    const { container } = render(<MarketSection isLoading={true} data={null} />);
    expect(container.innerHTML).toMatchSnapshot("MarketSection-loading");
  });
});

describe("ProtocolCompareSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_COMPARE_RESPONSE),
    }));
  });

  it("renders and fetches data on mount", () => {
    render(<ProtocolCompareSection />);

    expect(fetch).toHaveBeenCalledWith("/api/analytics");
  });

  it("shows select prompt while data loads", () => {
    render(<ProtocolCompareSection />);
    expect(screen.getByText(/Select two protocols/i)).toBeInTheDocument();
  });

  it("matches snapshot in initial state", () => {
    const { container } = render(<ProtocolCompareSection />);
    expect(container.innerHTML).toMatchSnapshot("ProtocolCompareSection-initial");
  });
});