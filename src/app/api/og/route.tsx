// src/app/api/og/route.tsx

import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

interface Market {
  name: string;
  totalValueLockedUSD: string;
  inputToken: {
    symbol: string;
  };
}

export async function GET(req: NextRequest) {
  try {
    const host = req.nextUrl.protocol + req.nextUrl.host;
    const dataResponse = await fetch(`${host}/api/seamless-data`);
    
    if (!dataResponse.ok) {
      throw new Error('Failed to fetch data');
    }
    
    const markets: Market[] = await dataResponse.json();
    const topMarket = markets[0];
    const tvl = parseFloat(topMarket.totalValueLockedUSD);
    
    const formattedTvl = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2
    }).format(tvl);

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#171717',
            color: 'white',
            fontFamily: '"SF Pro Display", "Helvetica", "Arial", sans-serif',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
            <img src="https://i.imgur.com/83T2I4i.png" width="60" height="60" alt="logo" />
            <div style={{ fontSize: 48, fontWeight: 700 }}>Seamless Protocol Stats</div>
          </div>
          <div style={{
            fontSize: 72,
            fontWeight: 800,
            background: 'linear-gradient(to right, #a855f7, #6366f1)',
            backgroundClip: 'text',
            color: 'transparent',
          }}>
            {formattedTvl}
          </div>
          <div style={{ fontSize: 36, color: '#a1a1aa' }}>
            {`Total Value Locked in ${topMarket.inputToken.symbol} Market`}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (error) {
    console.error(error);
    return new Response(`Failed to generate image`, { status: 500 });
  }
}

