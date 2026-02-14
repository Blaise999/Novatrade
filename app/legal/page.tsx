'use client';

import { AlertTriangle } from 'lucide-react';

export default function RiskPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-loss/10 rounded-xl flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-loss" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-cream">Risk Disclosure</h1>
          <p className="text-sm text-cream/50">Last updated: January 2026</p>
        </div>
      </div>

      <div className="p-4 bg-loss/10 border border-loss/20 rounded-xl mb-8">
        <p className="text-loss font-medium">
          ⚠️ Trading financial instruments carries significant risk and may not be suitable for all investors.
        </p>
      </div>
      
      <div className="prose prose-invert max-w-none">
        <div className="space-y-6 text-cream/70">
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">General Risk Warning</h2>
            <p>
              Trading Contracts for Difference (CFDs), Forex, Cryptocurrencies, and other financial instruments 
              involves a high level of risk and may not be suitable for all investors. Before deciding to trade, 
              you should carefully consider your investment objectives, level of experience, and risk appetite.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Leverage Risk</h2>
            <p>
              The use of leverage means that you can place trades that are significantly larger than your deposited 
              funds. While this can amplify profits, it can also amplify losses. You could lose more than your 
              initial investment.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Market Volatility</h2>
            <p>
              Financial markets can be highly volatile. Prices can change rapidly, and gaps in pricing can occur, 
              especially during market openings or news events. Stop-loss orders may not be executed at the 
              expected price during volatile conditions.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Cryptocurrency Risks</h2>
            <p>
              Cryptocurrencies are particularly volatile and carry additional risks including:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Extreme price volatility (potential 10%+ daily moves)</li>
              <li>Regulatory uncertainty</li>
              <li>Technology risks (hacks, bugs)</li>
              <li>Limited historical data for analysis</li>
              <li>Market manipulation risks</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">No Guarantee of Profits</h2>
            <p>
              Past performance is not indicative of future results. There is no guarantee that you will make 
              profits or that you will not incur losses. Trading systems, signals, and automated strategies 
              can fail and should not be relied upon exclusively.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Only Risk Capital</h2>
            <p>
              You should only trade with money that you can afford to lose. Do not trade with funds needed for 
              essential living expenses, retirement, or emergency savings. Trading should never be viewed as 
              a primary source of income.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">Seek Professional Advice</h2>
            <p>
              If you do not fully understand the risks involved, please seek independent financial, legal, 
              and tax advice before trading. NOVATrADE does not provide investment advice.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-cream mb-4">By Using Our Services</h2>
            <p>
              By using NOVATrADE, you acknowledge that you have read, understood, and accept these risks. 
              You confirm that you are trading at your own risk and that you take full responsibility for 
              any trading decisions.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
