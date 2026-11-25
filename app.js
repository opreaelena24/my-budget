{
  // ---------- Settings ----------
  const KEY = 'my-budget-v1';
  const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
  const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
  const shortDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const CATEGORIES = {
    bill: ['Rent', 'Utilities', 'Council Tax', 'Phone & internet', 'Subscriptions', 'Transport', 'Credit / loan', 'Insurance', 'Other'],
    income: ['Wages', 'Salary', 'Benefits', 'Freelance', 'Other'],
  };
  const REPEAT_LABEL = { weekly: 'weekly', fortnightly: 'every 2 weeks', monthly: 'monthly', once: 'one-off' };
  const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const CAL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v4M10 15h4"/></svg>';
  const EDIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';

  // ---------- State ----------
  let state = load();
  let view = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let editingId = null, editingBudget = null, editingSpend = null;

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.items)) return normalise(s);
    } catch (e) { /* storage unavailable */ }
    return normalise({});
  }
  function normalise(s) {
    return {
      items: Array.isArray(s.items) ? s.items : [],
      paid: s.paid || {},
      budgets: Array.isArray(s.budgets) ? s.budgets : [],
      spends: Array.isArray(s.spends) ? s.spends : [],
    };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast("Couldn't save on this device"); }
  }

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
  const daysBetween = (a, b) => Math.round((b - a) / 86400000);
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const parseMoney = (v) => parseFloat(String(v).replace(',', '.').replace(/[£\s]/g, ''));
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  // All dates an item falls due in a given month.
  function occurrences(item, monthStart) {
    const y = monthStart.getFullYear(), m = monthStart.getMonth();
    const monthEnd = new Date(y, m + 1, 0);
    if (item.repeat === 'monthly') {
      if (item.start && monthKey(monthStart) < item.start) return [];
      return [new Date(y, m, Math.min(item.day, monthEnd.getDate()))];
    }
    if (!item.date) return [];
    const first = parseDate(item.date);
    if (item.repeat === 'once') return monthKey(first) === monthKey(monthStart) ? [first] : [];
    const step = item.repeat === 'fortnightly' ? 14 : 7;
    if (first > monthEnd) return [];
    let d = first;
    if (d < monthStart) d = addDays(first, Math.ceil(daysBetween(first, monthStart) / step) * step);
    const out = [];
    for (; d <= monthEnd; d = addDays(d, step)) out.push(d);
    return out;
  }

  // Paid/received status is stored per month, per occurrence.
  const occKey = (item, date) => (item.repeat === 'monthly' || item.repeat === 'once' ? item.id : `${item.id}:${isoDate(date)}`);
  const isPaid = (key) => (state.paid[monthKey(view)] || []).includes(key);
  function togglePaid(key) {
    const k = monthKey(view);
    const list = state.paid[k] || [];
    state.paid[k] = list.includes(key) ? list.filter((x) => x !== key) : [...list, key];
    save(); render();
  }

  // ---------- Render ----------
  function render() {
    $('month').textContent = monthName.format(view);

    const entries = state.items
      .flatMap((item) => occurrences(item, view).map((date) => ({ item, date, key: occKey(item, date) })))
      .sort((a, b) => a.date - b.date);
    const bills = entries.filter((e) => e.item.type === 'bill');
    const incomes = entries.filter((e) => e.item.type === 'income');

    const sum = (arr) => arr.reduce((t, e) => t + Number(e.item.amount), 0);
    const incomeTotal = sum(incomes);
    const billTotal = sum(bills);
    const paidBills = bills.filter((e) => isPaid(e.key));
    const unpaidTotal = billTotal - sum(paidBills);

    const mk = monthKey(view);
    const budgets = state.budgets.filter((b) => !b.start || b.start <= mk);
    const spends = state.spends.filter((s) => s.date && s.date.slice(0, 7) === mk).sort((a, b) => b.date.localeCompare(a.date));
    const spentTotal = spends.reduce((t, s) => t + Number(s.amount), 0);
    const plannedTotal = budgets.reduce((t, b) => t + Number(b.amount), 0);
    const left = incomeTotal - billTotal - spentTotal;
    const unallocated = incomeTotal - billTotal - plannedTotal;

    $('income').textContent = money.format(incomeTotal);
    $('bills').textContent = money.format(billTotal);
    $('spent').textContent = money.format(spentTotal);
    $('left').textContent = money.format(left);
    $('left').classList.toggle('neg', left < 0);

    const pct = bills.length ? Math.round((paidBills.length / bills.length) * 100) : 0;
    $('meter').style.width = pct + '%';
    $('meterText').textContent = bills.length
      ? `${paidBills.length} of ${plural(bills.length, 'bill')} paid · ${money.format(unpaidTotal)} still to pay`
      : 'No bills this month';
    $('planText').textContent = budgets.length
      ? (unallocated >= 0
          ? `Plan: ${money.format(plannedTotal)} budgeted · ${money.format(unallocated)} unallocated (savings)`
          : `Heads up: your budgets are ${money.format(-unallocated)} more than your income`)
      : '';

    $('billList').innerHTML = bills.length
      ? bills.map((e) => row(e)).join('')
      : '<li class="empty">No bills yet. Tap “+ Bill” to add rent, energy or your phone.</li>';
    $('incomeList').innerHTML = incomes.length
      ? incomes.map((e) => row(e)).join('')
      : '<li class="empty">No income yet. Tap “+ Wage” to add your weekly pay.</li>';

    renderBudgets(budgets, spends);
  }

  function row({ item, date, key }) {
    const isBill = item.type === 'bill';
    const done = isPaid(key);
    let cls = '', status;
    if (done) {
      cls = 'done'; status = isBill ? 'Paid' : 'Received';
    } else {
      const d = daysBetween(today(), date);
      if (!isBill) status = d === 0 ? 'Today' : shortDate.format(date);
      else if (d < 0) { cls = 'late'; status = `${plural(-d, 'day')} overdue`; }
      else if (d === 0) { cls = 'late'; status = 'Due today'; }
      else if (d <= 3) { cls = 'soon'; status = `Due in ${plural(d, 'day')}`; }
      else status = `Due ${shortDate.format(date)}`;
    }
    const meta = [status, REPEAT_LABEL[item.repeat], item.category && item.category !== item.name ? esc(item.category) : '']
      .filter(Boolean).join(' · ');
    const label = isBill ? 'Mark as paid' : 'Mark as received';
    return `<li class="row ${cls}">
      <button class="check" data-act="toggle" data-key="${esc(key)}" aria-pressed="${done}" aria-label="${label}: ${esc(item.name)}">${CHECK_ICON}</button>
      <button class="main" data-act="edit" data-id="${esc(item.id)}">
        <span class="name">${esc(item.name)}</span>
        <span class="meta">${meta}</span>
      </button>
      <span class="amt">${money.format(item.amount)}</span>
      ${isBill ? `<button class="cal" data-act="cal" data-id="${esc(item.id)}" data-date="${isoDate(date)}" aria-label="Add reminder to Calendar: ${esc(item.name)}">${CAL_ICON}</button>` : ''}
    </li>`;
  }

  function renderBudgets(budgets, spends) {
    const spentBy = {};
    spends.forEach((s) => { spentBy[s.budgetId] = (spentBy[s.budgetId] || 0) + Number(s.amount); });

    $('budgetList').innerHTML = budgets.length
      ? budgets.map((b) => {
          const spent = spentBy[b.id] || 0;
          const ratio = b.amount > 0 ? spent / b.amount : 0;
          const rest = b.amount - spent;
          const cls = ratio > 1 ? 'over' : ratio >= 0.8 ? 'warn' : '';
          const restText = rest >= 0 ? `<strong>${money.format(rest)}</strong> left` : `<strong>${money.format(-rest)}</strong> over budget`;
          return `<li class="env ${cls}">
            <button class="env-main" data-act="budget-spend" data-id="${esc(b.id)}" aria-label="Add payment to ${esc(b.name)}">
              <span class="env-top"><span class="name">${esc(b.name)}</span><span class="amt">${money.format(spent)} of ${money.format(b.amount)}</span></span>
              <span class="bar"><span style="width:${Math.min(100, Math.round(ratio * 100))}%"></span></span>
              <span class="meta">${restText}</span>
            </button>
            <button class="edit-btn" data-act="budget-edit" data-id="${esc(b.id)}" aria-label="Edit ${esc(b.name)}">${EDIT_ICON}</button>
          </li>`;
        }).join('')
      : '<li class="empty">No budget categories yet. Tap “+ Category” and add, for example, Food £250 or Transport £80.</li>';

    const names = Object.fromEntries(state.budgets.map((b) => [b.id, b.name]));
    $('spendTitle').hidden = !spends.length;
    $('spendList').innerHTML = spends.map((s) => `<li><button class="spend" data-act="spend-edit" data-id="${esc(s.id)}">
        <span class="main-col">
          <span class="name">${esc(s.note || names[s.budgetId] || 'Payment')}</span>
          <span class="meta">${esc(names[s.budgetId] || 'No category')} · ${shortDate.format(parseDate(s.date))}</span>
        </span>
        <span class="amt">${money.format(s.amount)}</span>
      </button></li>`).join('');
  }

  // ---------- Bill / income form ----------
  const form = $('form');

  function fillCategories(type, selected) {
    $('fCat').innerHTML = CATEGORIES[type].map((c) => `<option${c === selected ? ' selected' : ''}>${esc(c)}</option>`).join('');
  }
  function syncRepeat() {
    const r = $('fRepeat').value;
    $('dayField').hidden = r !== 'monthly';
    $('dateField').hidden = r === 'monthly';
    const income = form.elements.type.value === 'income';
    $('dateLabel').textContent = r === 'once' ? 'Date' : income ? 'Next payday' : 'Next due date';
  }

  // kind: 'bill' | 'income' | 'wage' (weekly wage shortcut)
  function openForm(kind, item) {
    editingId = item ? item.id : null;
    form.reset();
    $('formError').textContent = '';
    const type = item ? item.type : kind === 'bill' ? 'bill' : 'income';
    form.elements.type.value = type;
    fillCategories(type, item ? item.category : kind === 'wage' ? 'Wages' : undefined);
    $('dlgTitle').textContent = item ? 'Edit' : kind === 'wage' ? 'Add wage' : type === 'bill' ? 'New bill' : 'New income';
    $('fName').value = item ? item.name : kind === 'wage' ? 'Wages' : '';
    $('fAmount').value = item ? Number(item.amount).toFixed(2) : '';
    $('fRepeat').value = item ? item.repeat : kind === 'bill' ? 'monthly' : 'weekly';
    $('fDay').value = item && item.day ? item.day : new Date().getDate();
    $('fDate').value = item && item.date ? item.date : isoDate(today());
    $('delBtn').hidden = !item;
    syncRepeat();
    $('dlg').showModal();
    (kind === 'wage' && !item ? $('fAmount') : $('fName')).focus();
  }

  form.addEventListener('change', (e) => {
    if (e.target.name === 'type') { fillCategories(e.target.value); syncRepeat(); }
    if (e.target.id === 'fRepeat') syncRepeat();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('fName').value.trim();
    const amount = parseMoney($('fAmount').value);
    const repeat = $('fRepeat').value;
    const day = parseInt($('fDay').value, 10);
    const date = $('fDate').value;
    const err = (m) => { $('formError').textContent = m; };

    if (!name) return err('Please enter a name.');
    if (!(amount > 0)) return err('Please enter an amount above £0.');
    if (repeat === 'monthly' && !(day >= 1 && day <= 31)) return err('Day must be between 1 and 31.');
    if (repeat !== 'monthly' && !date) return err('Please pick a date.');

    const data = {
      type: form.elements.type.value, name,
      amount: Math.round(amount * 100) / 100,
      category: $('fCat').value, repeat,
      day: repeat === 'monthly' ? day : null,
      date: repeat === 'monthly' ? null : date,
    };
    if (editingId) {
      state.items = state.items.map((it) => (it.id === editingId ? { ...it, ...data } : it));
      toast('Saved');
    } else {
      state.items.push({ id: newId(), start: monthKey(view), ...data });
      toast(data.type === 'bill' ? 'Bill added' : 'Income added');
    }
    save(); $('dlg').close(); render();
  });

  $('delBtn').addEventListener('click', () => {
    const item = state.items.find((it) => it.id === editingId);
    if (!item || !confirm(`Delete “${item.name}”?`)) return;
    state.items = state.items.filter((it) => it.id !== editingId);
    Object.keys(state.paid).forEach((k) => {
      state.paid[k] = state.paid[k].filter((key) => key !== editingId && !key.startsWith(editingId + ':'));
    });
    save(); $('dlg').close(); render(); toast('Deleted');
  });

  // ---------- Budget categories ----------
  function openBudget(b) {
    editingBudget = b ? b.id : null;
    $('budgetTitle').textContent = b ? 'Edit category' : 'New category';
    $('bName').value = b ? b.name : '';
    $('bAmount').value = b ? Number(b.amount).toFixed(2) : '';
    $('bDel').hidden = !b;
    $('budgetError').textContent = '';
    $('budgetDlg').showModal();
    if (!b) $('bName').focus();
  }

  $('budgetForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('bName').value.trim();
    const amount = parseMoney($('bAmount').value);
    if (!name) return ($('budgetError').textContent = 'Please enter a name.');
    if (!(amount >= 0)) return ($('budgetError').textContent = 'Please enter a valid amount.');
    const data = { name, amount: Math.round(amount * 100) / 100 };
    if (editingBudget) state.budgets = state.budgets.map((b) => (b.id === editingBudget ? { ...b, ...data } : b));
    else state.budgets.push({ id: newId(), start: monthKey(view), ...data });
    save(); $('budgetDlg').close(); render(); toast('Saved');
  });

  $('bDel').addEventListener('click', () => {
    const b = state.budgets.find((x) => x.id === editingBudget);
    if (!b || !confirm(`Delete “${b.name}” and its payments?`)) return;
    state.budgets = state.budgets.filter((x) => x.id !== b.id);
    state.spends = state.spends.filter((s) => s.budgetId !== b.id);
    save(); $('budgetDlg').close(); render(); toast('Deleted');
  });

  // ---------- Payments (spending) ----------
  function openSpend(spend, budgetId) {
    if (!state.budgets.length) { toast('Add a budget category first'); return openBudget(); }
    editingSpend = spend ? spend.id : null;
    $('spendDlgTitle').textContent = spend ? 'Edit payment' : 'New payment';
    const selected = spend ? spend.budgetId : budgetId;
    $('sBudget').innerHTML = state.budgets
      .map((b) => `<option value="${esc(b.id)}"${b.id === selected ? ' selected' : ''}>${esc(b.name)}</option>`).join('');
    $('sAmount').value = spend ? Number(spend.amount).toFixed(2) : '';
    $('sNote').value = spend ? spend.note || '' : '';
    const t = today();
    $('sDate').value = spend ? spend.date : monthKey(view) === monthKey(t) ? isoDate(t) : `${monthKey(view)}-01`;
    $('sDel').hidden = !spend;
    $('spendError').textContent = '';
    $('spendDlg').showModal();
    if (!spend) $('sAmount').focus();
  }

  $('spendForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseMoney($('sAmount').value);
    const date = $('sDate').value;
    if (!(amount > 0)) return ($('spendError').textContent = 'Please enter an amount above £0.');
    if (!date) return ($('spendError').textContent = 'Please pick a date.');
    const data = { budgetId: $('sBudget').value, amount: Math.round(amount * 100) / 100, note: $('sNote').value.trim(), date };
    if (editingSpend) state.spends = state.spends.map((s) => (s.id === editingSpend ? { ...s, ...data } : s));
    else state.spends.push({ id: newId(), ...data });
    save(); $('spendDlg').close(); render(); toast('Payment saved');
  });

  $('sDel').addEventListener('click', () => {
    if (!confirm('Delete this payment?')) return;
    state.spends = state.spends.filter((s) => s.id !== editingSpend);
    save(); $('spendDlg').close(); render(); toast('Deleted');
  });

  // ---------- Calendar reminder (.ics) ----------
  function icsText(item, date) {
    const ymd = (d) => isoDate(d).replace(/-/g, '');
    const icsEsc = (s) => String(s).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const title = icsEsc(`Pay ${item.name} (${money.format(item.amount)})`);
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//My Budget//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${item.id}@my-budget`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(date)}`,
      `DTEND;VALUE=DATE:${ymd(addDays(date, 1))}`,
      `SUMMARY:${title}`,
    ];
    if (item.repeat === 'monthly') {
      if (item.day > 28) {
        // Days 29–31 fall back to the last day of shorter months.
        const days = []; for (let d = 28; d <= item.day; d++) days.push(d);
        lines.push(`RRULE:FREQ=MONTHLY;BYMONTHDAY=${days.join(',')};BYSETPOS=-1`);
      } else {
        lines.push(`RRULE:FREQ=MONTHLY;BYMONTHDAY=${item.day}`);
      }
    }
    if (item.repeat === 'weekly') lines.push('RRULE:FREQ=WEEKLY;INTERVAL=1');
    if (item.repeat === 'fortnightly') lines.push('RRULE:FREQ=WEEKLY;INTERVAL=2');
    // Alerts at 9am the day before and 9am on the day.
    lines.push(
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'TRIGGER:-PT15H', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'TRIGGER:PT9H', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    );
    return lines.join('\r\n');
  }

  function addToCalendar(id, dateStr) {
    const item = state.items.find((it) => it.id === id);
    if (!item) return;
    const a = document.createElement('a');
    a.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsText(item, parseDate(dateStr)));
    a.download = `${item.name.replace(/[^\w-]+/g, '-') || 'bill'}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- Backup ----------
  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `my-budget-backup-${isoDate(today())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.items)) throw new Error('format');
      if (!confirm('Restore this backup? Your current data will be replaced.')) return;
      state = normalise(data);
      save(); render(); toast('Backup restored');
    } catch (err) {
      toast("That file isn't a valid backup");
    }
  });

  // ---------- Events ----------
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) return openForm(add.dataset.add);
    const close = e.target.closest('[data-close]');
    if (close) return close.closest('dialog').close();
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    switch (btn.dataset.act) {
      case 'toggle': togglePaid(btn.dataset.key); break;
      case 'edit': openForm(null, state.items.find((it) => it.id === id)); break;
      case 'cal': addToCalendar(id, btn.dataset.date); break;
      case 'budget-spend': openSpend(null, id); break;
      case 'budget-edit': openBudget(state.budgets.find((b) => b.id === id)); break;
      case 'spend-edit': openSpend(state.spends.find((s) => s.id === id)); break;
    }
  });
  $('addBudget').addEventListener('click', () => openBudget());
  $('addSpend').addEventListener('click', () => openSpend());
  $('prev').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); });
  $('next').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); });

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
  }

  render();
}
