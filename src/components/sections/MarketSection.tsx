// src/components/sections/MarketSection.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp } from "lucide-react";

type Market = {
  name: string;
  supplyApy: number;
  borrowApy: number;
};

interface MarketSectionProps {
  data: {
    markets?: Market[];
  } | null;
  isLoading: boolean;
}

const TOKEN_ADDRESSES: { [key: string]: string } = {
  "SEAM (Governance Token)": "0x1C7a460413dD4e964f96D8dFC56E7223cE88CD85",
  "EscrowSEAM (esSEAM)": "0x1C7a460413dD4e964f96D8dFC56E7223cE88CD85",
  "wstETH/ETH 3x Loop Strategy": "0xc1CBa3fCea344f92d9239c08C0568f6F2F0ee452",
  "WETH/USDC 1.5x Loop Strategy": "0x4200000000000000000000000000000000000006",
  "WETH/USDC 3x Loop Strategy": "0x4200000000000000000000000000000000000006",
  "USDC/WETH 1.5x Loop Strategy": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "Seamless USDC Vault (smUSDC)": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "Seamless WETH Vault (smWETH)": "0x4200000000000000000000000000000000000006",
  "Seamless cbBTC Vault (smcbBTC)": "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
};

const getTokenIcon = (name: string) => {
  if (name.includes("SEAM")) {
    return "https://coin-images.coingecko.com/coins/images/33480/large/Seamless_Logo_Black_Transparent.png";
  }
  const address = TOKEN_ADDRESSES[name];
  if (!address) return "/default-token.svg";
  return `https://icons.llama.fi/icons/tokens/base/${address}?w=48&h=48`;
};

const columnHelper = createColumnHelper<Market>();

export default function MarketSection({ data, isLoading }: MarketSectionProps) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    if (data?.markets) {
      setMarkets(data.markets);
    }
  }, [data]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Asset",
        cell: (info) => (
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="relative flex-shrink-0">
              <img
                src={getTokenIcon(info.getValue())}
                alt={info.getValue()}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                onError={(e) => (e.currentTarget.src = "/default-token.svg")}
              />
              <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
            <span className="font-semibold text-white group-hover:text-emerald-100 transition-colors text-sm sm:text-base truncate">
              {info.getValue()}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor("supplyApy", {
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-1 sm:gap-2 justify-end w-full hover:text-emerald-400 transition-colors group"
          >
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-400" />
            <span className="text-xs sm:text-sm">APY</span>
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-400" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-400" />
            ) : (
              <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4 opacity-50 group-hover:opacity-100" />
            )}
          </button>
        ),
        cell: (info) => (
          <div className="text-right">
            <div className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-emerald-900/40 to-emerald-800/30 border border-emerald-500/30 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <span className="font-bold text-emerald-400 text-sm sm:text-base">
                {info.getValue() ? `${info.getValue().toFixed(2)}%` : "N/A"}
              </span>
            </div>
          </div>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: markets,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="space-y-6" aria-labelledby="market-heading">
      {/* Header */}
      <div className="space-y-2">
        <h2 id="market-heading" className="text-2xl sm:text-3xl font-bold text-white">
          Market Overview
        </h2>
        <p className="text-sm sm:text-base text-gray-400">
          Live supply rates across all markets
        </p>
      </div>

      {/* Table Container with neon border */}
      <div className="relative bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-black/95 rounded-2xl shadow-2xl overflow-hidden before:absolute before:inset-0 before:rounded-2xl before:p-[2px] before:bg-gradient-to-br before:from-emerald-500/40 before:via-transparent before:to-emerald-500/20 before:-z-10">
        <div className="relative z-10">
          {isLoading && markets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>
              <p className="mt-4 text-gray-400 text-sm">Loading market data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow
                      key={headerGroup.id}
                      className="border-b border-emerald-500/20 hover:bg-transparent"
                    >
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className="text-gray-300 font-semibold text-sm uppercase tracking-wider py-4 px-6"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-32 text-center"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center">
                            <TrendingUp className="h-8 w-8 text-gray-600" />
                          </div>
                          <p className="text-gray-400">No market data available</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map((row, index) => (
                      <TableRow
                        key={row.id}
                        className="border-b border-gray-800/50 hover:bg-gradient-to-r hover:from-emerald-900/20 hover:to-transparent transition-all duration-300 group"
                        style={{
                          animationDelay: `${index * 50}ms`,
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-3 sm:py-5 px-3 sm:px-6">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Bottom stats bar */}
        {markets.length > 0 && (
          <div className="border-t border-emerald-500/20 bg-black/40 px-3 sm:px-6 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 text-xs sm:text-sm">
              <span className="text-gray-400">
                Total Markets: <span className="text-emerald-400 font-semibold">{markets.length}</span>
              </span>
              <span className="text-gray-400">
                Avg Supply APY:{" "}
                <span className="text-emerald-400 font-semibold">
                  {(
                    markets.reduce((acc, m) => acc + (m.supplyApy || 0), 0) /
                    markets.length
                  ).toFixed(2)}
                  %
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="bg-gradient-to-r from-emerald-900/20 to-blue-900/20 border border-emerald-500/30 rounded-xl p-3 sm:p-4 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
        <p className="text-xs sm:text-sm text-gray-300">
          <span className="text-emerald-400 font-semibold">💡 Tip:</span> Click on the APY column
          header to sort markets by rate
        </p>
      </div>
    </section>
  );
}
