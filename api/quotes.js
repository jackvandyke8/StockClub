const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://aegbhutfgyyzukferxnz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const AV_KEY = process.env.ALPHA_VANTAGE_KEY;
const CACHE_TTL_MINUTES = 15;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols param required' });

  const syms = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  if (syms.length === 0) return res.status(400).json({ error: 'no valid symbols' });

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Return cached rows that are still fresh
  const cutoff = new Date(Date.now() - CACHE_TTL_MINUTES * 60 * 1000).toISOString();
  const { data: cached } = await sb
    .from('quotes_cache')
    .select('*')
    .in('symbol', syms)
    .gte('fetched_at', cutoff);

  const cachedSyms = new Set((cached || []).map(r => r.symbol));
  const stale = syms.filter(s => !cachedSyms.has(s));

  let fresh = [];
  if (stale.length > 0 && AV_KEY) {
    const url = `https://www.alphavantage.co/query?function=BATCH_STOCK_QUOTES&symbols=${stale.join(',')}&apikey=${AV_KEY}`;
    try {
      const avRes = await fetch(url);
      const avData = await avRes.json();
      const quotes = avData['Stock Quotes'] || [];

      fresh = quotes.map(q => ({
        symbol: q['1. symbol'],
        price: parseFloat(q['2. price']),
        change: parseFloat(q['4. price change'] || 0),
        change_pct: q['5. change percent'] || '0%',
        volume: parseInt(q['3. volume'] || 0, 10),
        fetched_at: new Date().toISOString(),
      }));

      if (fresh.length > 0) {
        await sb.from('quotes_cache').upsert(fresh, { onConflict: 'symbol' });
      }
    } catch (err) {
      console.error('Alpha Vantage fetch failed:', err);
    }
  }

  const all = [...(cached || []), ...fresh];
  const bySymbol = Object.fromEntries(all.map(r => [r.symbol, r]));
  res.status(200).json(bySymbol);
};
