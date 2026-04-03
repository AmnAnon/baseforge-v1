// src/components/ui/MetricCard.tsx
"use client";

import { Card, Badge, AreaChart } from "@tremor/react";
import { motion } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react"; 

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  chartData?: any[];
  tooltip?: string;
  icon?: React.ReactElement;
  isLoading: boolean;
}

export default function MetricCard({ title, value, change, chartData = [], tooltip, icon, isLoading }: MetricCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl shadow-lg hover:shadow-lg transition-shadow duration-300 cursor-help">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              {icon}
              <p className="text-sm text-gray-400">{title}</p>
            </div>
            {tooltip && <Info className="h-3 w-3 text-gray-500" />}
          </div>
          {isLoading ? (
            <div className="h-7 w-24 bg-gray-700 rounded-md animate-pulse"></div>
          ) : (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-semibold text-white"
            >
              {value}
            </motion.p>
          )}
          {change != null && !isLoading && (
            <Badge className="mt-2" color={isPositive ? "emerald" : "red"}>
              {isPositive ? '+' : ''}{change.toFixed(2)}% 24h
            </Badge>
          )}
          {chartData.length > 0 && !isLoading && (
            <AreaChart
              data={chartData.slice(-30)}
              index="date"
              categories={[title.split(' ')[1] || "Value"]}
              colors={[isPositive ? "emerald" : "red"]}
              showXAxis={false}
              showYAxis={false}
              showGridLines={false}
              showLegend={false}
              showTooltip={true}
              className="h-16 w-full mt-4"
            />
          )}
        </Card>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="bg-gray-800 text-white p-2 rounded shadow-lg max-w-xs z-50" side="top" sideOffset={5}>
          {tooltip}
          <Tooltip.Arrow className="fill-gray-800" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
