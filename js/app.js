/* CartShare - collaborative shared cart.
   Data lives in localStorage (one key per room). The "storage" event tells
   every other open tab when a room changes, which is how tabs stay in sync.
   The signed-in user lives in sessionStorage so each tab can be a different person. */
(() => {
  const THRESHOLD = 75; // free-delivery minimum ($)
  const $ = (s) => document.querySelector(s);
  const KEY = (c) => `cartshare:room:${c}`;
  const SESSION = 'cartshare:session';
  let session = null; // { name, room }

  const load = (c) => { try { return JSON.parse(localStorage.getItem(KEY(c))); } catch { return null; } };
  const save = (r) => localStorage.setItem(KEY(r.code), JSON.stringify(r));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const money = (n) => '$' + n.toFixed(2);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const time = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const genCode = () => {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s; do { s = Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join(''); } while (load(s));
    return s;
  };

  /* Read the room, change it, save it, redraw. Re-reading first avoids overwriting other tabs' edits. */
  function update(fn) {
    const r = load(session.room);
    if (!r) return leave();
    fn(r);
    save(r);
    render();
  }
  const log = (r, text) => r.log.push({ id: uid(), who: session.name, text, at: Date.now() });

  /* ---------- Login / join ---------- */
  $('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const action = e.submitter ? e.submitter.value : 'create';
    const name = $('#name').value.trim();
    const code = $('#code').value.trim().toUpperCase();
    const err = $('#login-error');
    err.textContent = '';
    if (!name) return (err.textContent = 'Enter your name to continue.');

    if (action === 'create') {
      const room = { code: genCode(), created: Date.now(), members: [name], items: [], log: [] };
      session = { name, room: room.code };
      save(room);
      log(room, 'created the room'); save(room);
    } else {
      if (!/^[A-Z0-9]{6}$/.test(code)) return (err.textContent = 'Enter the 6-character room code to join.');
      const room = load(code);
      if (!room) return (err.textContent = `No room found with code ${code}. Check the code or create a new room.`);
      session = { name, room: code };
      if (!room.members.includes(name)) room.members.push(name);
      log(room, 'joined the room'); save(room);
    }
    sessionStorage.setItem(SESSION, JSON.stringify(session));
    render();
  });

  function leave() {
    if (session && load(session.room)) update((r) => log(r, 'left the room'));
    session = null;
    sessionStorage.removeItem(SESSION);
    render();
  }

  /* ---------- Cart actions ---------- */
  $('#add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#item-name').value.trim();
    const price = parseFloat($('#item-price').value);
    const qty = parseInt($('#item-qty').value, 10);
    const err = $('#add-error');
    err.textContent = '';
    if (!name) return (err.textContent = 'Enter an item name.');
    if (!(price > 0)) return (err.textContent = 'Enter a price greater than 0.');
    if (!(qty >= 1 && qty <= 99)) return (err.textContent = 'Quantity must be between 1 and 99.');
    update((r) => {
      r.items.push({ id: uid(), name, price: Math.round(price * 100) / 100, qty, by: session.name, at: Date.now() });
      log(r, `added ${qty} x ${name} (${money(price * qty)})`);
    });
    e.target.reset();
    $('#item-qty').value = 1;
    $('#item-name').focus();
  });

  $('#items').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    update((r) => {
      const i = r.items.findIndex((x) => x.id === btn.dataset.remove);
      if (i < 0) return;
      const [it] = r.items.splice(i, 1);
      log(r, `removed ${it.name}` + (it.by !== session.name ? ` (added by ${it.by})` : ''));
    });
  });

  $('#copy-btn').addEventListener('click', () => {
    const btn = $('#copy-btn');
    const done = () => { btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = 'Copy code'), 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(session.room).then(done, done); else done();
  });
  $('#tab-btn').addEventListener('click', () => window.open(location.href, '_blank'));
  $('#leave-btn').addEventListener('click', leave);
  $('#print-btn').addEventListener('click', () => { renderReceipt(load(session.room)); window.print(); });

  /* ---------- Calculations ---------- */
  function totals(r) {
    const total = r.items.reduce((s, i) => s + i.price * i.qty, 0);
    const people = [...new Set([...r.members, ...r.items.map((i) => i.by)])];
    const share = people.length ? total / people.length : 0;
    const rows = people.map((p) => {
      const added = r.items.filter((i) => i.by === p).reduce((s, i) => s + i.price * i.qty, 0);
      return { p, added, balance: added - share }; // + = is owed money, - = owes money
    });
    return { total, share, rows };
  }
  const bal = (b) => (Math.abs(b) < 0.005 ? '$0.00' : (b > 0 ? '+' : '-') + money(Math.abs(b)));

  /* ---------- Rendering ---------- */
  function render() {
    const inRoom = !!session && !!load(session.room);
    if (!inRoom) session = null;
    $('#login-view').hidden = inRoom;
    $('#room-view').hidden = !inRoom;
    const chip = $('#session-chip');
    chip.hidden = !inRoom;
    if (!inRoom) return;

    const r = load(session.room);
    const t = totals(r);
    chip.textContent = session.name;
    $('#room-code').textContent = r.code;

    $('#items').innerHTML = r.items.length
      ? r.items.map((i) => `<li class="item"><div><strong>${esc(i.name)}</strong><span class="meta">${i.qty} x ${money(i.price)}, added by ${esc(i.by)}</span></div>
          <div class="item-end"><span class="amt">${money(i.price * i.qty)}</span>
          <button class="btn btn-sm btn-outline-danger" data-remove="${i.id}" aria-label="Remove ${esc(i.name)}">Remove</button></div></li>`).join('')
      : '<li class="empty">Nothing here yet. Add the first item above.</li>';

    $('#total').textContent = money(t.total);
    const pct = Math.min(100, (t.total / THRESHOLD) * 100);
    $('#goal-fill').style.width = pct + '%';
    $('#goal').classList.toggle('done', t.total >= THRESHOLD);
    $('#goal').setAttribute('aria-valuenow', Math.round(pct));
    $('#goal-text').textContent = t.total >= THRESHOLD
      ? `Free delivery unlocked (minimum ${money(THRESHOLD)}).`
      : `${money(THRESHOLD - t.total)} more to reach free delivery at ${money(THRESHOLD)}.`;

    $('#split').innerHTML = t.rows.map((x) => `<tr><td>${esc(x.p)}</td><td class="text-end">${money(x.added)}</td>
      <td class="text-end ${x.balance > 0.004 ? 'pos' : x.balance < -0.004 ? 'neg' : ''}">${bal(x.balance)}</td></tr>`).join('');
    $('#share-note').textContent = `Equal share: ${money(t.share)} each. + means the person is owed money, - means they owe.`;

    $('#log').innerHTML = r.log.slice(-50).reverse()
      .map((l) => `<li><time>${time(l.at)}</time><strong>${esc(l.who)}</strong> ${esc(l.text)}</li>`).join('');
    $('#sync').textContent = 'Live, updated ' + time(Date.now());
  }

  function renderReceipt(r) {
    const t = totals(r);
    $('#receipt').innerHTML = `
      <h1>CartShare</h1><p class="c">Group receipt<br>Room ${esc(r.code)}<br>${new Date().toLocaleString()}</p><hr>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Added by</th><th class="r">Amount</th></tr></thead><tbody>
      ${r.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${i.qty} x ${money(i.price)}</td><td>${esc(i.by)}</td><td class="r">${money(i.price * i.qty)}</td></tr>`).join('') || '<tr><td colspan="4">No items</td></tr>'}
      </tbody></table><hr>
      <table><tr><td><strong>TOTAL</strong></td><td class="r"><strong>${money(t.total)}</strong></td></tr>
      <tr><td>Free delivery (${money(THRESHOLD)} min)</td><td class="r">${t.total >= THRESHOLD ? 'Yes' : 'No'}</td></tr>
      <tr><td>Participants</td><td class="r">${t.rows.length}</td></tr>
      <tr><td>Equal share each</td><td class="r">${money(t.share)}</td></tr></table><hr>
      <table><thead><tr><th>Person</th><th class="r">Added</th><th class="r">Balance</th></tr></thead><tbody>
      ${t.rows.map((x) => `<tr><td>${esc(x.p)}</td><td class="r">${money(x.added)}</td><td class="r">${bal(x.balance)}</td></tr>`).join('')}
      </tbody></table><hr>
      <p class="c">Activity log (${r.log.length} entries)</p>
      <table>${r.log.map((l) => `<tr><td>${time(l.at)}</td><td>${esc(l.who)} ${esc(l.text)}</td></tr>`).join('')}</table>
      <hr><p class="c">+ is owed money, - owes money<br>Thank you for shopping together!</p>`;
  }

  /* ---------- Cross-tab sync ---------- */
  window.addEventListener('storage', (e) => {
    if (session && e.key === KEY(session.room)) render();
  });

  /* ---------- Restore session on refresh ---------- */
  try { session = JSON.parse(sessionStorage.getItem(SESSION)); } catch { session = null; }
  render();
})();
