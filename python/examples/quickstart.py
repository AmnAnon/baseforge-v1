"""
BaseForge Python SDK Quickstart
Demonstrates fetching DeFi intelligence, risk scores, and whale signals on Base.
"""

from baseforge import BaseForgeClient

def main():
    client = BaseForgeClient()

    print("⚡ Fetching BaseForge AI Agent Context...")
    context = client.get_context(
        include="protocols,risk,market,whales,intent",
        top=5,
        compact=False,
    )

    print(f"\n🌐 Base Ecosystem Overview:")
    if context.market:
        print(f"  • Total TVL: ${context.market.total_tvl:,.2f}")
        print(f"  • Avg Health Score: {context.market.avg_health}/100")
        print(f"  • 30d Trend: {context.market.tvl_trend.upper()} ({context.market.tvl_trend_pct:+.2f}%)")

    print(f"\n🛡️ Top Protocols & Health:")
    for p in context.protocols:
        print(f"  • {p.name or p.id:<18} | TVL: ${p.tvl:>12,.0f} | Health: {p.health}/100 ({p.level.upper()}) | Audit: {p.audit}")

    if context.whales and context.whales.flows:
        print(f"\n🐋 High-Conviction Whale Flows:")
        for flow in context.whales.flows[:3]:
            print(f"  • [{flow.protocol}] {flow.type.upper()} ${flow.usd:,.2f} of {flow.token} (Tx: {flow.tx})")

if __name__ == "__main__":
    main()
