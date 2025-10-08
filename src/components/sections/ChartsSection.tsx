"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { Card, CardContent } from "@/components/ui/card";

const tvlData = [
  { date: "Day 1", tvl: 5_000_000 },
  { date: "Day 2", tvl: 5_200_000 },
  { date: "Day 3", tvl: 5_500_000 },
  { date: "Day 4", tvl: 5_300_000 },
  { date: "Day 5", tvl: 5_800_000 },
];

const feeData = [
  { date: "Day 1", fees: 15000 },
  { date: "Day 2", fees: 12000 },
  { date: "Day 3", fees: 18000 },
  { date: "Day 4", fees: 22000 },
  { date: "Day 5", fees: 19500 },
];

const supplyBorrowData = [
  { date: "Day 1", supply: 4_000_000, borrow: 2_000_000 },
  { date: "Day 2", supply: 4_200_000, borrow: 2_100_000 },
  { date: "Day 3", supply: 4_400_000, borrow: 2_400_000 },
  { date: "Day 4", supply: 4_300_000, borrow: 2_200_000 },
  { date: "Day 5", supply: 4_600_000, borrow: 2_500_000 },
];

const pegData = [
  { date: "Day 1", price: 1.0 },
  { date: "Day 2", price: 0.99 },
  { date: "Day 3", price: 1.01 },
  { date: "Day 4", price: 1.0 },
  { date: "Day 5", price: 0.98 },
];

export default function ChartsSection() {
  return (
    <div className="space-y-8">
      {/* TVL Trend */}
      <Card className="bg-gray-900/60 border-gray-800">
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold mb-4">Total Value Locked (TVL)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={tvlData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#aaa" />
              <YAxis stroke="#aaa" />
              <Tooltip />
              <Line type="monotone" dataKey="tvl" stroke="#8b5cf6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Fees */}
      <Card className="bg-gray-900/60 border-gray-800">
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold mb-4">Daily Fees</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={feeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#aaa" />
              <YAxis stroke="#aaa" />
              <Tooltip />
              <Bar dataKey="fees" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Supply vs Borrow */}
      <Card className="bg-gray-900/60 border-gray-800">
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold mb-4">Supply vs Borrow</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={supplyBorrowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#aaa" />
              <YAxis stroke="#aaa" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="supply" stroke="#22c55e" strokeWidth={2} />
              <Line type="monotone" dataKey="borrow" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Stablecoin Peg */}
      <Card className="bg-gray-900/60 border-gray-800">
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold mb-4">Stablecoin Peg (USDC)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={pegData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#aaa" />
              <YAxis domain={[0.95, 1.05]} stroke="#aaa" />
              <Tooltip />
              <Line type="monotone" dataKey="price" stroke="#facc15" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
