// src/app/api/analytics/route.ts
import { NextResponse } from "next/server";
import { GraphQLClient, gql } from "graphql-request";

const SEAMLESS_SUBGRAPH_ID = "2u4mWUV4xS19ef1MbnxZHWLLMwdPxtVifH46JbonXwXP";

const graphQuery = gql`
  query GetMarketData {
    markets {
      id
      name
      totalDepositBalanceUSD
      totalBorrowBalanceUSD
      inputToken {
        symbol
        id # This is the contract address
      }
    }
  }
`;

export async function GET() {
  const apiKey = process.env.THE_GRAPH_API_KEY;
  if (!apiKey) {
    console.error("Missing THE_GRAPH_API_KEY");
    return NextResponse.json({ error: "API key missing" }, { status: 500 });
  }

  try {
    const graphClient = new GraphQLClient(
      `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${SEAMLESS_SUBGRAPH_ID}`
    );

    const [graphResp, llamaYieldsResp, llamaProtoResp, seamPriceResp, llamaMorphoResp] = await Promise.all([
      graphClient.request<{ markets: any[] }>(graphQuery),
      fetch("https://yields.llama.fi/pools?project=seamless-protocol"),
      fetch("https://api.llama.fi/protocol/seamless-protocol"),
      fetch("https://coins.llama.fi/prices/current/base:0x1c7a460413dd4e964f96d8dfc56e7223ce88cd85"),
      fetch("https://yields.llama.fi/pools?project=morpho-blue&chain=Base")
    ]);

    const subgraphMarkets = graphResp.markets || [];
    const llamaYields = await llamaYieldsResp.json();
    const llamaProto = await llamaProtoResp.json();
    const seamPriceJson = await seamPriceResp.json();
    const llamaMorpho = await llamaMorphoResp.json();

    const yieldsMap = new Map<string, any>();
    if (llamaYields.data) {
      for (const pool of llamaYields.data) {
        const tokenAddress = pool.underlyingTokens?.[0];
        if (tokenAddress) {
          yieldsMap.set(tokenAddress.toLowerCase(), pool);
        }
      }
    }

    const enrichedMarkets = subgraphMarkets.map((m) => {
      const address = m.inputToken.id.toLowerCase();
      const yieldInfo = yieldsMap.get(address);
      return {
        ...m,
        supplyApy: yieldInfo?.apy || null,
        borrowApy: yieldInfo?.apyBorr || null,
      };
    });

    // Get reserve yields for ILM calculations
    const usdcYield = yieldsMap.get('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
    const wethYield = yieldsMap.get('0x4200000000000000000000000000000000000006');
    const wstethYield = yieldsMap.get('0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452');
    const seamYield = yieldsMap.get('0x1c7a460413dd4e964f96d8dfc56e7223ce88cd85');

    // Morpho vaults map (match by underlyingTokens[0])
    const morphoMap = new Map<string, any>();
    if (llamaMorpho.data) {
      for (const pool of llamaMorpho.data) {
        const tokenAddress = pool.underlyingTokens?.[0]?.toLowerCase();
        if (tokenAddress) {
          morphoMap.set(tokenAddress, pool);
        }
      }
    }

    // Custom markets based on your listed tokens (remove old reserves)
    const customMarkets: Market[] = [
      { name: "SEAM (Governance Token)", supplyApy: seamYield?.apy || null, borrowApy: null },
      { name: "EscrowSEAM (esSEAM)", supplyApy: null, borrowApy: null }, // No direct yield
      { name: "wstETH/ETH 3x Loop Strategy", supplyApy: wstethYield?.apy ? (3 * wstethYield.apy - 2 * wethYield?.apyBorr) : null, borrowApy: null },
      { name: "WETH/USDC 1.5x Loop Strategy", supplyApy: wethYield?.apy ? (1.5 * wethYield.apy - 0.5 * usdcYield?.apyBorr) : null, borrowApy: null },
      { name: "WETH/USDC 3x Loop Strategy", supplyApy: wethYield?.apy ? (3 * wethYield.apy - 2 * usdcYield?.apyBorr) : null, borrowApy: null },
      { name: "USDC/WETH 1.5x Loop Strategy", supplyApy: usdcYield?.apy ? (1.5 * usdcYield.apy - 0.5 * wethYield?.apyBorr) : null, borrowApy: null },
      { name: "Seamless USDC Vault (smUSDC)", supplyApy: morphoMap.get('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')?.apy || null, borrowApy: null },
      { name: "Seamless WETH Vault (smWETH)", supplyApy: morphoMap.get('0x4200000000000000000000000000000000000006')?.apy || null, borrowApy: null },
      { name: "Seamless cbBTC Vault (smcbBTC)", supplyApy: morphoMap.get('0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf')?.apy || null, borrowApy: null },
    ];

    const { totalSupply, totalBorrow } = enrichedMarkets.reduce(
      (acc, m) => {
        acc.totalSupply += parseFloat(m.totalDepositBalanceUSD || "0");
        acc.totalBorrow += parseFloat(m.totalBorrowBalanceUSD || "0");
        return acc;
      },
      { totalSupply: 0, totalBorrow: 0 }
    );
    const dailyFees = llamaProto.dailyFees || 0;
    const dailyRevenue = llamaProto.dailyRevenue || 0;
    const feesAnnualized = dailyFees * 365;
    const revenueAnnualized = dailyRevenue * 365;
    const tvl = totalSupply - totalBorrow;
    const utilization = totalSupply > 0 ? (totalBorrow / totalSupply) * 100 : 0;

    const tvlChange = llamaProto.change_1d || 0;
    const seamPrice = seamPriceJson.coins?.[`base:0x1c7a460413dd4e964f96d8dfc56e7223ce88cd85`]?.price || null;

    const analytics = {
      markets: customMarkets, // Use new list
      tvl,
      totalSupply,
      totalBorrow,
      utilization,
      tvlChange,
      seamPrice,
      feesAnnualized,
      revenueAnnualized,
    };

    console.log("Sending analytics data:", analytics);
    return NextResponse.json(analytics);
  } catch (err) {
    console.error("Analytics aggregation failed:", err);
    return NextResponse.json({ error: "Analytics fetch failed" }, { status: 500 });
  }
}

export const revalidate = 120;
