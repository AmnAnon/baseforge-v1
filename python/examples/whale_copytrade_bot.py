"""
Whale Copy-Trade & Anomaly Agent Bot
Queries BaseForge intelligence and builds automated transactions when whale signals fire.
"""

from baseforge import BaseForgeClient

def run_whale_bot():
    client = BaseForgeClient()
    ctx = client.get_context(include="whales,intent,risk", top=5)

    if not ctx.whales or not ctx.whales.flows:
        print("No recent whale moves detected.")
        return

    for flow in ctx.whales.flows:
        if flow.usd >= 100_000 and flow.type == "swap":
            print(f"🚨 Large Whale Swap Detected: ${flow.usd:,.2f} on {flow.protocol} ({flow.token})")
            print(f"   Generating automated copy-trade calldata...")
            tx = client.build_transaction(
                action="swap",
                params={
                    "tokenIn": "USDC",
                    "tokenOut": flow.token,
                    "amountIn": "100000000",  # $100 USDC in 6 decimals
                    "protocol": flow.protocol,
                }
            )
            print(f"   Ready to execute: Target={tx.to} Value={tx.value} Data={tx.data[:20]}...")

if __name__ == "__main__":
    run_whale_bot()
