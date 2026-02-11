// lib/fx-math.ts
export type FxSide = 'long' | 'short';
export const FX_CONTRACT_SIZE = 100_000;

export function parseFxSymbol(symbol: string) {
  const parts = String(symbol || '').trim().toUpperCase().split('/').map(s => s.trim());
  if (parts.length !== 2) return null;
  return { base: parts[0], quote: parts[1] };
}

export function fxPipSize(symbol: string) {
  const p = parseFxSymbol(symbol);
  return p?.quote === 'JPY' ? 0.01 : 0.0001;
}

export function fxNotionalInAccount({
  symbol, baseUnits, price, accountCurrency,
}: { symbol: string; baseUnits: number; price: number; accountCurrency: string }) {
  const pair = parseFxSymbol(symbol);
  if (!pair || !Number.isFinite(price) || price <= 0) return 0;

  const acct = accountCurrency.toUpperCase();
  if (acct === pair.base) return baseUnits;          // USD/JPY on USD acct
  if (acct === pair.quote) return baseUnits * price; // EUR/USD on USD acct

  // fallback (extend later with cross conversion)
  if (pair.base === 'USD') return baseUnits;
  if (pair.quote === 'USD') return baseUnits * price;
  return baseUnits * price;
}

export function fxPnlInAccount({
  symbol, baseUnits, entryPrice, exitPrice, side, accountCurrency,
}: {
  symbol: string; baseUnits: number; entryPrice: number; exitPrice: number;
  side: FxSide; accountCurrency: string;
}) {
  const pair = parseFxSymbol(symbol);
  if (!pair || !Number.isFinite(exitPrice) || exitPrice <= 0) return 0;

  const diff = side === 'long' ? (exitPrice - entryPrice) : (entryPrice - exitPrice);
  const pnlQuote = diff * baseUnits;

  const acct = accountCurrency.toUpperCase();
  if (acct === pair.quote) return pnlQuote;
  if (acct === pair.base) return pnlQuote / exitPrice; // convert QUOTE -> BASE

  if (pair.quote === 'USD') return pnlQuote;
  if (pair.base === 'USD') return pnlQuote / exitPrice;
  return pnlQuote;
}

export function fxPipValueInAccount({
  symbol, baseUnits, price, accountCurrency,
}: { symbol: string; baseUnits: number; price: number; accountCurrency: string }) {
  const pip = fxPipSize(symbol);
  const pipValueQuote = pip * baseUnits;
  const pair = parseFxSymbol(symbol);
  if (!pair || !Number.isFinite(price) || price <= 0) return pipValueQuote;

  const acct = accountCurrency.toUpperCase();
  if (acct === pair.quote) return pipValueQuote;
  if (acct === pair.base) return pipValueQuote / price;

  if (pair.quote === 'USD') return pipValueQuote;
  if (pair.base === 'USD') return pipValueQuote / price;
  return pipValueQuote;
}
