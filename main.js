// --- Ticker ---
const tickers = [
  ['AAPL','$218.40','+0.9%',true],['NVDA','$134.70','+2.4%',true],['TSLA','$178.20','-1.2%',false],
  ['MSFT','$424.80','+0.6%',true],['AMZN','$198.60','+1.1%',true],['META','$556.30','+0.3%',true],
  ['GOOG','$184.90','-0.4%',false],['AMD','$162.40','+3.1%',true],['INTC','$21.80','-0.8%',false],
  ['SPY','$548.20','+0.5%',true]
];
const tickerEl = document.getElementById('ticker');
if (tickerEl) {
  [...tickers,...tickers].forEach(([sym,price,chg,up]) => {
    const el = document.createElement('span');
    el.className = 'ticker-item';
    el.innerHTML = `<span class="ticker-sym">${sym}</span><span class="ticker-price">${price}</span><span class="${up?'up':'down'}">${chg}</span>`;
    tickerEl.appendChild(el);
  });
}

// --- Recent Picks (homepage only) ---
const grid = document.getElementById('picks-grid');
if (grid) {
  const picks = [
    {sym:'NVDA',name:'Nvidia Corp',price:'$134.70',chg:'+24.1%',up:true,bar:82},
    {sym:'MSFT',name:'Microsoft',price:'$424.80',chg:'+11.3%',up:true,bar:67},
    {sym:'PLTR',name:'Palantir Tech',price:'$85.20',chg:'+38.6%',up:true,bar:91},
    {sym:'TSLA',name:'Tesla Inc',price:'$178.20',chg:'-8.4%',up:false,bar:35},
    {sym:'AMZN',name:'Amazon',price:'$198.60',chg:'+15.7%',up:true,bar:74},
    {sym:'INTC',name:'Intel Corp',price:'$21.80',chg:'-18.2%',up:false,bar:22},
  ];
  picks.forEach(p => {
    grid.innerHTML += `<div class="pick-card"><div class="pick-top"><span class="pick-sym display">${p.sym}</span><span class="pick-change ${p.up?'up':'down'}">${p.chg}</span></div><div class="pick-name">${p.name}</div><div class="pick-price display">${p.price}</div><div class="pick-bar-wrap"><div class="pick-bar ${p.up?'':'red-bar'}" style="width:${p.bar}%"></div></div></div>`;
  });
}

// --- Formspree Email Signup (homepage only) ---
const joinForm = document.getElementById('join-form');
if (joinForm) {
  const joinBtn = document.getElementById('join-btn');
  const formMsg = document.getElementById('form-msg');

  joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('join-email').value.trim();
    if (!email) return;

    joinBtn.textContent = 'Sending...';
    joinBtn.disabled = true;
    formMsg.textContent = '';
    formMsg.className = 'form-msg';

    try {
      const res = await fetch('https://formspree.io/f/xvznowpr', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        formMsg.textContent = '✓ You\'re in! We\'ll be in touch before the next meeting.';
        formMsg.className = 'form-msg success';
        joinForm.reset();
      } else {
        throw new Error('Server error');
      }
    } catch {
      formMsg.textContent = '✗ Something went wrong. Try again or email us directly.';
      formMsg.className = 'form-msg error';
    } finally {
      joinBtn.textContent = 'Join Now';
      joinBtn.disabled = false;
    }
  });
}
