"use client";

import { useState, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
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

type Market = {
  name: string;
  supplyApy: number;
  borrowApy: number;
};

const TOKEN_ADDRESSES: { [key: string]: string } = {
  "SEAM (Governance Token)": "0x1C7a460413dD4e964f96D8dFC56E7223cE88CD85",
  "EscrowSEAM (esSEAM)": "0x1C7a460413dD4e964f96D8dFC56E7223cE88CD85", 
  "wstETH/ETH 3x Loop Strategy": "0xc1CBa3fCea344f92d9239c08C0568f6F2F0ee452",
  "WETH/USDC 1.5x Loop Strategy": "0x4200000000000000000000000000000000000006",
  "WETH/USDC 3x Loop Strategy": "0x4200000000000000000000000000000000000006", 
  "USDC/WETH 1.5x Loop Strategy": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "Seamless USDC Vault (smUSDC)": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
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

const columns = [
  columnHelper.accessor("name", {
    header: "Asset",
    cell: (info) => (
      <div className="flex items-center space-x-3">
        <img
          src={getTokenIcon(info.getValue())}
          alt={info.getValue()}
          className="w-8 h-8 rounded-full"
          onError={(e) => (e.currentTarget.src = "/default-token.svg")}
        />
        <span className="font-medium text-white">{info.getValue()}</span>
      </div>
    ),
  }),
  columnHelper.accessor("supplyApy", {
    header: () => <div className="text-right">Supply APY</div>,
    cell: (info) => (
      <div className="text-right font-semibold text-green-400">
        {info.getValue() ? `${info.getValue().toFixed(2)}%` : 'N/A'}
      </div>
    ),
  }),
  columnHelper.accessor("borrowApy", {
    header: () => <div className="text-right">Borrow APY</div>,
    cell: (info) => (
      <div className="text-right font-semibold text-red-400">
        {info.getValue() ? `${info.getValue().toFixed(2)}%` : 'N/A'}
      </div>
    ),
  }),
];


export default function MarketSection({ data, isLoading: initialIsLoading }: any) {
  const [markets, setMarkets] = useState<Market[]>([]);

   useEffect(() => {
    if (data?.markets) {
      setMarkets(data.markets);
    }
  }, [data]);

  const table = useReactTable({
    data: markets,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="bg-gray-900/50 rounded-2xl shadow-lg p-6 mt-8 border border-gray-800">
      <h2 className="text-xl font-bold mb-6 text-white">Market Overview</h2>

      {(initialIsLoading && markets.length === 0) ? (
        <div className="text-center py-10 text-gray-400">Loading Market Data...</div>
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-gray-700 hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-gray-400">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-gray-400">
                  No market data available.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-gray-800 hover:bg-gray-800/50 transition-colors duration-150"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}                                                                                                                                 </div>
  );
}
