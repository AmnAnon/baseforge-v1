# Risk Scoring Methodology

BaseForge assigns every Base protocol a **Health Score** (0–100, higher = safer) and a **Risk Score** (100 − Health). This document explains exactly how scores are calculated, what factors are considered, and what the thresholds mean.

## Philosophy

Risk scoring is not prediction — it's a structured assessment of observable signals. BaseForge combines off-chain metadata (audit count, fork lineage, TVL size) with on-chain activity data (swap volume, net flows, trader count) to produce a composite score.

**What it measures:** How much evidence exists that a protocol is safe to interact with.

**What it does NOT measure:** Future price movements, exploit probability, or investment returns.

---

## Scoring Algorithm

Every protocol starts at a **baseline of 50 points** (neutral). Points are added for positive signals and subtracted for risk indicators. The final score is clamped to 0–100.

### Factor Breakdown

#### 1. Security Audit Status

| Condition | Points | Risk Factor |
|---|---|---|
| ≥ 2 audits | +10 | — |
| 1 audit | +5 | — |
| 0 audits | −15 | `"No audits"` |

**Weight: High.** Audits are the strongest off-chain signal of code quality. Multiple independent audits compound confidence.

#### 2. Category Trust Baseline

Different protocol categories have different inherent risk profiles based on the maturity of their design patterns.

| Category | Points |
|---|---|
| Liquid Staking | +20 |
| Lending | +15 |
| Dexes | +15 |
| CDP | +15 |
| Derivatives | +10 |
| Options | +8 |
| Yield | +5 |
| Bridge | +0 |
| Other / Unknown | +5 |

**Rationale:** Lending and DEX patterns (Aave, Uniswap) are battle-tested across hundreds of deployments. Bridges have the worst historical track record for exploits.

#### 3. TVL Size

| TVL | Points | Risk Factor |
|---|---|---|
| > $100M | +15 | — |
| $10M – $100M | +10 | — |
| $1M – $10M | +5 | — |
| < $1M | −10 | `"Low TVL"` |

**Rationale:** Higher TVL means more capital at stake, which usually correlates with more scrutiny, audits, and battle-testing. Very low TVL protocols may be abandoned or experimental.

#### 4. TVL Stability (7-day)

| Condition | Points | Risk Factor |
|---|---|---|
| \|change_7d\| > 25% | −15 | `"High TVL volatility"` |
| change_7d < −10% | −8 | `"TVL declining"` |
| Stable (< 10% swing) | 0 | — |

#### 5. TVL Stability (24-hour)

| Condition | Points | Risk Factor |
|---|---|---|
| \|change_24h\| > 10% | −10 | `"Extreme 24h TVL swing"` |
| Normal | 0 | — |

**Rationale:** Rapid TVL changes often precede or follow security events. A 25%+ weekly swing is abnormal for established protocols.

#### 6. Oracle Diversity

| Condition | Points | Risk Factor |
|---|---|---|
| ≥ 2 oracle sources | 0 | — |
| < 2 oracle sources | −5 | `"Limited oracle diversity"` |

**Rationale:** Oracle manipulation is a top exploit vector. Protocols using multiple price feeds (e.g., Chainlink + Pyth) are more resilient.

#### 7. Fork Lineage

| Condition | Points |
|---|---|
| Forked from established protocol | +3 |
| Original codebase | 0 |

**Rationale:** Forks of Aave, Uniswap, Compound inherit code that has been audited and battle-tested. This is a modest positive signal.

#### 8. APY Sanity Check

| Condition | Points | Risk Factor |
|---|---|---|
| APY > 1000% | −10 | `"Suspiciously high APY"` |
| Normal APY | 0 | — |

**Rationale:** Extreme yields are almost always unsustainable and often indicate Ponzi-like tokenomics or an imminent rug.

#### 9. On-Chain Activity — Swap Volume (from Indexer)

| Condition | Points | Risk Factor |
|---|---|---|
| Volume/TVL > 1% daily | +5 | — (active protocol) |
| Volume/TVL < 0.1% (DEX) | −5 | `"Very low trading volume relative to TVL"` |
| No data | 0 | — |

**Rationale:** A DEX with high TVL but near-zero trading activity may have inflated TVL (e.g., through incentivized liquidity that nobody uses).

#### 10. On-Chain Activity — Net Flows (from Indexer)

| Condition | Points | Risk Factor |
|---|---|---|
| Net inflows (positive) | +3 | — |
| Net outflows > 10% of TVL | −10 | `"Significant net outflows (>10% TVL)"` |
| Neutral | 0 | — |

**Rationale:** Large net outflows often precede or accompany security events, governance crises, or yield farm rotations.

#### 11. On-Chain Activity — Unique Traders (from Indexer)

| Condition | Points | Risk Factor |
|---|---|---|
| > 100 traders/24h | +3 | — |
| 10–100 traders/24h | +1 | — |
| 0 traders (DEX only) | −5 | `"Zero unique traders in 24h"` |

---

## Score Interpretation

| Health Score | Risk Level | Badge | Meaning |
|---|---|---|---|
| 80–100 | Low | 🟢 | Well-audited, large TVL, stable, active |
| 50–79 | Medium | 🟡 | Mixed signals — some risk factors present |
| 0–49 | High | 🔴 | Multiple risk factors — exercise caution |

## Concentration Analysis

Beyond individual protocol scores, BaseForge computes ecosystem-level concentration risk:

### Dominance Score
Each protocol's share of total Base TVL as a percentage. When a single protocol holds >30% of total TVL, concentration risk is flagged as `HIGH`.

### Herfindahl-Hirschman Index (HHI)
The sum of squared market shares (×10000) for the top 20 protocols.

| HHI | Interpretation |
|---|---|
| < 1000 | Competitive — well-distributed TVL |
| 1000–2500 | Moderately concentrated |
| > 2500 | Highly concentrated — ecosystem depends on a few protocols |

---

## Anomaly Detection

Separate from health scores, BaseForge flags anomalies that warrant human attention:

| Anomaly | Trigger | Severity |
|---|---|---|
| `sharp_tvl_decline` | 7d TVL change < −20% | High |
| `rapid_tvl_growth` | 7d TVL change > +50% | Medium |
| `high_risk_high_tvl` | Risk > 50 AND TVL > $5M | High |

---

## Intent Signals

The agent context endpoint also detects behavioral patterns in whale activity:

| Signal | Detection Logic | Confidence Range |
|---|---|---|
| `accumulation` | Net inflows > $100K AND inflows > 2× outflows AND TVL rising | 0.3–0.9 |
| `distribution` | Net outflows > $100K AND outflows > 2× inflows AND TVL falling | 0.3–0.9 |
| `yield_rotation` | APY > 20% AND 7d TVL growth > 10% AND low risk | Fixed 0.5 |
| `risk_escalation` | 7d TVL < −20% AND high risk score | Fixed 0.7 |

Intent confidence scales with the ratio of flow volume to protocol TVL. Higher flow-to-TVL ratio = higher confidence in the signal.

---

## Limitations

1. **Audit quality is not assessed** — we count audits but don't evaluate whether they were thorough. A 1-page audit counts the same as a 50-page Trail of Bits review.
2. **TVL can be manipulated** — recursive borrowing, self-deposits, and bridge loops can inflate TVL without real user activity.
3. **On-chain data coverage is partial** — the indexer tracks Aerodrome, Uniswap V3, and Seamless. Other protocols get scores based only on DefiLlama metadata.
4. **No contract analysis** — we don't read or analyze smart contract code, bytecode, or upgrade patterns.
5. **Historical data is limited** — risk-history tracks scores over time but doesn't model time-series risk trajectories.

---

## Source Code

The scoring algorithm is implemented in:
- [`src/lib/protocol-aggregator.ts`](../src/lib/protocol-aggregator.ts) — `calculateHealthScore()` function
- [`src/app/api/risk/route.ts`](../src/app/api/risk/route.ts) — risk API endpoint
- [`src/app/api/agents/context/route.ts`](../src/app/api/agents/context/route.ts) — `computeRisk()` for agent context
