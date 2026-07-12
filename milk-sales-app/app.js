(function () {
  "use strict";

  /* ============ Storage layer (localStorage) ============ */
  const LS = { customers: "dk_customers", sales: "dk_sales", payments: "dk_payments", adjustments: "dk_adjustments", seq: "dk_seq" };

  function load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function persist() {
    localStorage.setItem(LS.customers, JSON.stringify(customers));
    localStorage.setItem(LS.sales, JSON.stringify(sales));
    localStorage.setItem(LS.payments, JSON.stringify(payments));
    localStorage.setItem(LS.adjustments, JSON.stringify(adjustments));
    localStorage.setItem(LS.seq, JSON.stringify(seq));
  }

  let customers = load(LS.customers, []);
  let sales = load(LS.sales, []);
  let payments = load(LS.payments, []);
  let adjustments = load(LS.adjustments, {}); // key: `${customerId}_${YYYY-MM}` -> {discount, extra, override}
  let seq = load(LS.seq, { c: customers.length });

  function nextCustomerCode() {
    seq.c = (seq.c || 0) + 1;
    return "C" + pad(seq.c, 3);
  }
  function pad(n, len) {
    len = len || 2;
    return String(n).padStart(len, "0");
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function money(n) {
    n = Number(n) || 0;
    return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function niceDate(s) {
    const d = new Date(s + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function custById(id) {
    return customers.find((c) => c.id === id);
  }

  /* ============ Business calculations ============ */
  function monthSummary(customerId, year, month) {
    const mk = `${year}-${pad(month)}`;
    const monthSales = sales.filter((s) => s.customerId === customerId && s.date.slice(0, 7) === mk);
    const litres = monthSales.reduce((a, s) => a + Number(s.qty), 0);
    const computedAmount = monthSales.reduce((a, s) => a + Number(s.qty) * Number(s.rate), 0);
    const adj = adjustments[customerId + "_" + mk] || { discount: 0, extra: 0, override: null };
    const finalAmount = adj.override != null && adj.override !== "" ? Number(adj.override) : computedAmount - Number(adj.discount || 0) + Number(adj.extra || 0);
    const monthPayments = payments.filter((p) => p.customerId === customerId && p.date.slice(0, 7) === mk);
    const paid = monthPayments.reduce((a, p) => a + Number(p.amount), 0);
    return { litres, computedAmount, discount: Number(adj.discount || 0), extra: Number(adj.extra || 0), override: adj.override != null ? adj.override : null, finalAmount, paid, balance: finalAmount - paid };
  }
  function customerAllMonths(customerId) {
    const months = new Set();
    sales.filter((s) => s.customerId === customerId).forEach((s) => months.add(s.date.slice(0, 7)));
    Object.keys(adjustments).forEach((k) => {
      if (k.startsWith(customerId + "_")) months.add(k.slice(customerId.length + 1));
    });
    return Array.from(months);
  }
  function customerTotalDue(customerId) {
    return customerAllMonths(customerId).reduce((total, mk) => {
      const [y, m] = mk.split("-").map(Number);
      return total + monthSummary(customerId, y, m).finalAmount;
    }, 0);
  }
  function customerTotalPaid(customerId) {
    return payments.filter((p) => p.customerId === customerId).reduce((a, p) => a + Number(p.amount), 0);
  }
  function customerBalance(customerId) {
    return customerTotalDue(customerId) - customerTotalPaid(customerId);
  }

  /* ============ Icons ============ */
  const ICONS = {
    edit: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 20h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4.8c0-.4.3-.8.8-.8h4.4c.5 0 .8.4.8.8V7m-9 0 .7 12.1c0 .6.5 1 1 1h6.6c.5 0 1-.4 1-1L17 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };
  function emptyState(title, sub) {
    return `<div class="empty-state"><svg width="46" height="46" viewBox="0 0 24 24" fill="none"><path d="M4 12 12 4l8 8M6 10.5V20h12v-9.5" stroke="currentColor" stroke-width="1.4"/></svg><div class="empty-title">${escapeHtml(title)}</div><p>${escapeHtml(sub)}</p></div>`;
  }

  /* ============ Row templates ============ */
  function saleRowHTML(s, opts) {
    opts = opts || {};
    const cust = custById(s.customerId);
    const total = Number(s.qty) * Number(s.rate);
    return `<div class="list-row">
      <div>
        <div class="cust-name">${opts.showCustomer ? escapeHtml(cust ? cust.name : "Unknown customer") : niceDate(s.date)}</div>
        <div class="cust-meta">${opts.showCustomer ? niceDate(s.date) + " · " : ""}${s.qty} L × ${money(s.rate)} = <strong class="tabular">${money(total)}</strong></div>
      </div>
      <div class="row-actions">
        <button data-action="edit-sale" data-id="${s.id}" aria-label="Edit sale">${ICONS.edit}</button>
        <button data-action="delete-sale" data-id="${s.id}" aria-label="Delete sale">${ICONS.trash}</button>
      </div>
    </div>`;
  }
  function paymentRowHTML(p, opts) {
    opts = opts || {};
    const cust = custById(p.customerId);
    return `<div class="list-row">
      <div>
        <div class="cust-name">${opts.showCustomer ? escapeHtml(cust ? cust.name : "Unknown customer") : niceDate(p.date)}</div>
        <div class="cust-meta">${opts.showCustomer ? niceDate(p.date) : ""}${p.note ? " · " + escapeHtml(p.note) : ""}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <strong class="tabular" style="color:var(--good)">${money(p.amount)}</strong>
        <div class="row-actions"><button data-action="delete-payment" data-id="${p.id}" aria-label="Delete payment">${ICONS.trash}</button></div>
      </div>
    </div>`;
  }

  /* ============ Forms ============ */
  function customerFormHTML(existing) {
    return `<form id="customerForm" data-id="${existing ? existing.id : ""}">
      <div class="form-group"><label>Customer Name</label><input required name="name" value="${existing ? escapeHtml(existing.name) : ""}" placeholder="e.g. Ramesh Patel" autofocus></div>
      <div class="form-group"><label>Phone Number</label><input name="phone" type="tel" inputmode="tel" value="${existing ? escapeHtml(existing.phone || "") : ""}" placeholder="10-digit mobile number"></div>
      <div class="form-group"><label>Address</label><textarea name="address" rows="2" placeholder="House / street / area">${existing ? escapeHtml(existing.address || "") : ""}</textarea></div>
      ${existing ? `<div class="form-group"><label>Customer ID</label><input disabled value="${existing.code}"></div>` : ""}
      <div class="sheet-actions">
        <button type="button" class="btn btn-ghost" data-action="close-sheet">Cancel</button>
        <button type="submit" class="btn btn-primary">${existing ? "Save changes" : "Add customer"}</button>
      </div>
    </form>`;
  }
  function saleFormHTML(existing) {
    const sorted = customers.slice().sort((a, b) => a.name.localeCompare(b.name));
    const options = sorted.map((c) => `<option value="${c.id}" ${existing && existing.customerId === c.id ? "selected" : ""}>${escapeHtml(c.name)} (${c.code})</option>`).join("");
    const qty = existing ? existing.qty : "";
    const rate = existing ? existing.rate : "";
    const date = existing ? existing.date : todayStr();
    const total = existing ? Number(existing.qty) * Number(existing.rate) : 0;
    return `<form id="saleForm" data-id="${existing ? existing.id : ""}">
      <div class="form-group"><label>Customer</label><select required name="customerId">${options}</select></div>
      <div class="form-group"><label>Date</label><input required type="date" name="date" value="${date}" max="${todayStr()}"></div>
      <div class="form-row">
        <div class="form-group"><label>Quantity (Litres)</label><input required id="saleQty" name="qty" type="number" step="0.01" min="0.01" value="${qty}" placeholder="0.00" inputmode="decimal"></div>
        <div class="form-group"><label>Rate / Litre (₹)</label><input required id="saleRate" name="rate" type="number" step="0.01" min="0.01" value="${rate}" placeholder="0.00" inputmode="decimal"></div>
      </div>
      <div class="calc-box"><span class="calc-label">Total Amount</span><span class="calc-value tabular" id="saleTotalPreview">${money(total)}</span></div>
      <div class="sheet-actions">
        <button type="button" class="btn btn-ghost" data-action="close-sheet">Cancel</button>
        <button type="submit" class="btn btn-primary">${existing ? "Save changes" : "Add sale"}</button>
      </div>
    </form>`;
  }
  function paymentFormHTML(customerId) {
    const sorted = customers.slice().sort((a, b) => a.name.localeCompare(b.name));
    const options = sorted.map((c) => `<option value="${c.id}" ${c.id === customerId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("");
    const bal = customerBalance(customerId);
    return `<form id="paymentForm">
      <div class="form-group"><label>Customer</label><select required name="customerId" id="paySelect">${options}</select></div>
      <div class="calc-box"><span class="calc-label">Current Balance</span><span class="calc-value tabular" id="payBalancePreview">${money(bal)}</span></div>
      <div class="form-row">
        <div class="form-group"><label>Amount (₹)</label><input required type="number" step="0.01" min="0.01" name="amount" placeholder="0.00" inputmode="decimal" autofocus></div>
        <div class="form-group"><label>Date</label><input required type="date" name="date" value="${todayStr()}" max="${todayStr()}"></div>
      </div>
      <div class="form-group"><label>Note (optional)</label><input name="note" placeholder="e.g. Cash, UPI, partial payment"></div>
      <div class="sheet-actions">
        <button type="button" class="btn btn-ghost" data-action="close-sheet">Cancel</button>
        <button type="submit" class="btn btn-amber">Add payment</button>
      </div>
    </form>`;
  }
  function reportAdjustFormHTML(customerId, year, month) {
    const s = monthSummary(customerId, year, month);
    return `<form id="adjustForm" data-cid="${customerId}" data-y="${year}" data-m="${month}">
      <div class="form-group"><label>Litres this month</label><input disabled value="${s.litres.toFixed(2)} L"></div>
      <div class="form-group"><label>Computed Amount (auto)</label><input disabled value="${money(s.computedAmount)}"></div>
      <div class="form-row">
        <div class="form-group"><label>Discount (₹)</label><input type="number" step="0.01" min="0" name="discount" value="${s.discount || 0}"></div>
        <div class="form-group"><label>Extra Charge (₹)</label><input type="number" step="0.01" min="0" name="extra" value="${s.extra || 0}"></div>
      </div>
      <div class="form-group"><label>Manual Total Override (optional)</label><input type="number" step="0.01" min="0" name="override" placeholder="Leave blank to auto-calculate" value="${s.override != null ? s.override : ""}"></div>
      <div class="sheet-actions">
        <button type="button" class="btn btn-ghost" data-action="close-sheet">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>`;
  }

  /* ============ Sheet / modal ============ */
  const modalRoot = document.getElementById("modalRoot");
  function openSheet(title, html) {
    modalRoot.innerHTML = `<div class="sheet-overlay">
      <div class="sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-title">${title}<button class="sheet-close" data-action="close-sheet" aria-label="Close">&times;</button></div>
        ${html}
      </div>
    </div>`;
  }
  function closeSheet() {
    modalRoot.innerHTML = "";
  }

  function openCustomerDetail(id) {
    const c = custById(id);
    if (!c) return;
    const bal = customerBalance(id);
    const custSales = sales.filter((s) => s.customerId === id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5);
    const custPayments = payments.filter((p) => p.customerId === id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5);
    openSheet(escapeHtml(c.name), `
      <div class="cust-meta" style="margin-bottom:10px;">${c.code}${c.phone ? " · " + escapeHtml(c.phone) : ""}</div>
      ${c.address ? `<div class="cust-meta" style="margin-bottom:10px;">${escapeHtml(c.address)}</div>` : ""}
      <div class="calc-box"><span class="calc-label">Current Balance</span><span class="calc-value tabular">${money(bal)}</span></div>
      <div class="sheet-actions" style="margin-bottom:8px;">
        <button class="btn btn-amber" data-action="add-payment" data-id="${id}">Add Payment</button>
        <button class="btn btn-ghost" data-action="edit-customer" data-id="${id}">Edit</button>
      </div>
      <button class="btn btn-danger btn-block btn-sm" data-action="delete-customer" data-id="${id}" style="margin-bottom:6px;">Delete Customer</button>
      <div class="divider-label">Recent Sales</div>
      ${custSales.length ? custSales.map((s) => saleRowHTML(s, { showCustomer: false })).join("") : '<div class="cust-meta">No sales recorded yet.</div>'}
      <div class="divider-label">Recent Payments</div>
      ${custPayments.length ? custPayments.map((p) => paymentRowHTML(p, { showCustomer: false })).join("") : '<div class="cust-meta">No payments recorded yet.</div>'}
    `);
  }
  function openSaleForm(id) {
    const existing = id ? sales.find((s) => s.id === id) : null;
    openSheet(existing ? "Edit Sale" : "Add Sale", saleFormHTML(existing));
  }
  function openPaymentForm(customerId) {
    const cid = customerId || (customers[0] && customers[0].id);
    if (!cid) return;
    openSheet("Add Payment", paymentFormHTML(cid));
  }
  function openReportAdjust(id) {
    const c = custById(id);
    openSheet("Edit Total — " + escapeHtml(c ? c.name : ""), reportAdjustFormHTML(id, reportYear, reportMonth));
  }
  function openSettings() {
    openSheet("Settings &amp; Backup", `
      <div class="section-title" style="margin-top:0">Backup your data</div>
      <p style="color:var(--ink-soft);font-size:0.86rem;margin-top:-6px;">Save all customers, sales and payments as a JSON file. Keep it safe — you can restore it any time, even on a new phone.</p>
      <button class="btn btn-amber btn-block" data-action="backup">⬇ Download backup (.json)</button>
      <div class="divider-label">Restore from backup</div>
      <p style="color:var(--ink-soft);font-size:0.86rem;margin-top:-6px;">Restoring replaces all current data on this device.</p>
      <input type="file" id="restoreFile" accept="application/json,.json" style="display:none">
      <button class="btn btn-ghost btn-block" data-action="trigger-restore">Choose backup file</button>
      <div class="divider-label">Danger zone</div>
      <button class="btn btn-danger btn-block" data-action="clear-data">Erase all data on this device</button>
      <p style="color:var(--ink-soft);font-size:0.76rem;margin-top:16px;text-align:center;">Dudh Khata · All data stays on this device</p>
    `);
  }

  /* ============ Views ============ */
  let currentView = "dashboard";
  let salesFilter = "all";
  let customerSearch = "";
  const now0 = new Date();
  let reportYear = now0.getFullYear();
  let reportMonth = now0.getMonth() + 1;

  function renderDashboard() {
    const today = todayStr();
    const todaySales = sales.filter((s) => s.date === today);
    const todayAmt = todaySales.reduce((a, s) => a + Number(s.qty) * Number(s.rate), 0);
    const todayLitres = todaySales.reduce((a, s) => a + Number(s.qty), 0);
    const mk = today.slice(0, 7);
    const monthSalesArr = sales.filter((s) => s.date.slice(0, 7) === mk);
    const monthAmt = monthSalesArr.reduce((a, s) => a + Number(s.qty) * Number(s.rate), 0);
    const pending = customers.reduce((a, c) => a + customerBalance(c.id), 0);
    const recent = sales.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5);

    if (customers.length === 0) {
      return `
        ${emptyState("Welcome to KATHIRAVAN", "Add your first customer, then start recording daily milk sales.")}
        <button class="btn btn-primary btn-block" data-action="add-customer">${ICONS.plus} Add Customer</button>
      `;
    }

    return `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Today's Sales</div><div class="stat-value tabular">${money(todayAmt)}</div><div class="stat-sub">${todayLitres.toFixed(1)} L today</div></div>
        <div class="stat-card"><div class="stat-label">This Month</div><div class="stat-value tabular">${money(monthAmt)}</div><div class="stat-sub">${monthSalesArr.length} entries</div></div>
        <div class="stat-card"><div class="stat-label">Total Customers</div><div class="stat-value tabular">${customers.length}</div></div>
        <div class="stat-card warn"><div class="stat-label">Pending Amount</div><div class="stat-value tabular">${money(pending)}</div></div>
      </div>
      <div class="quick-actions">
        <button class="btn btn-primary" data-action="add-sale">${ICONS.plus} Add Sale</button>
        <button class="btn btn-amber" data-action="add-customer">${ICONS.plus} Add Customer</button>
      </div>
      <div class="section-title">Recent Sales</div>
      ${recent.length ? `<div class="card">${recent.map((s) => saleRowHTML(s, { showCustomer: true })).join("")}</div>` : emptyState("No sales yet", 'Tap "Add Sale" to record your first milk sale.')}
    `;
  }

  function renderCustomers() {
    const q = customerSearch.trim().toLowerCase();
    const filtered = customers.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone || "").includes(q));
    const listHtml = filtered.length
      ? filtered
          .map((c) => {
            const bal = customerBalance(c.id);
            const due = bal > 0.004;
            return `<div class="card" data-action="view-customer" data-id="${c.id}" style="cursor:pointer;">
          <div class="list-row">
            <div>
              <div class="cust-name">${escapeHtml(c.name)}</div>
              <div class="cust-meta">${c.code}${c.phone ? " · " + escapeHtml(c.phone) : ""}</div>
            </div>
            <span class="balance-pill ${due ? "due" : "clear"}">${due ? money(bal) + " due" : "Settled"}</span>
          </div>
        </div>`;
          })
          .join("")
      : emptyState("No customers found", q ? "Try a different search term." : "Add your first customer to start recording sales.");

    return `
      <div class="search-wrap">${ICONS.search}<input id="customerSearchInput" placeholder="Search by name or phone" value="${escapeHtml(customerSearch)}"></div>
      <button class="btn btn-primary btn-block" data-action="add-customer">${ICONS.plus} Add Customer</button>
      <div class="fab-space"></div>
      ${listHtml}
    `;
  }

  function renderSales() {
    if (customers.length === 0) {
      return emptyState("Add a customer first", "You need at least one customer before recording sales.") + `<button class="btn btn-primary btn-block" data-action="add-customer" style="margin-top:10px;">${ICONS.plus} Add Customer</button>`;
    }
    const today = todayStr();
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekAgoStr = `${weekAgo.getFullYear()}-${pad(weekAgo.getMonth() + 1)}-${pad(weekAgo.getDate())}`;
    const monthStr = today.slice(0, 7);
    let filtered = sales.slice();
    if (salesFilter === "today") filtered = filtered.filter((s) => s.date === today);
    else if (salesFilter === "week") filtered = filtered.filter((s) => s.date >= weekAgoStr);
    else if (salesFilter === "month") filtered = filtered.filter((s) => s.date.slice(0, 7) === monthStr);
    filtered.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const listHtml = filtered.length ? `<div class="card">${filtered.map((s) => saleRowHTML(s, { showCustomer: true })).join("")}</div>` : emptyState("No sales in this range", 'Tap "Add Sale" to record a milk sale.');
    const filters = [
      ["all", "All"],
      ["today", "Today"],
      ["week", "Last 7 days"],
      ["month", "This month"],
    ];
    return `
      <button class="btn btn-primary btn-block" data-action="add-sale">${ICONS.plus} Add Sale</button>
      <div class="chip-row" style="margin-top:14px;">
        ${filters.map(([f, label]) => `<button class="chip ${salesFilter === f ? "active" : ""}" data-action="sales-filter" data-filter="${f}">${label}</button>`).join("")}
      </div>
      ${listHtml}
    `;
  }

  function renderPayments() {
    if (customers.length === 0) {
      return emptyState("Add a customer first", "You need at least one customer before recording payments.") + `<button class="btn btn-primary btn-block" data-action="add-customer" style="margin-top:10px;">${ICONS.plus} Add Customer</button>`;
    }
    const list = payments.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const listHtml = list.length ? `<div class="card">${list.map((p) => paymentRowHTML(p, { showCustomer: true })).join("")}</div>` : emptyState("No payments yet", 'Tap "Add Payment" to record a customer payment.');
    return `
      <button class="btn btn-amber btn-block" data-action="add-payment">${ICONS.plus} Add Payment</button>
      <div class="section-title">Payment History</div>
      ${listHtml}
    `;
  }

  function renderReports() {
    if (customers.length === 0) {
      return emptyState("No customers yet", "Add customers and record sales to see monthly reports.");
    }
    const mk = `${reportYear}-${pad(reportMonth)}`;
    const rows = customers
      .map((c) => {
        const s = monthSummary(c.id, reportYear, reportMonth);
        const due = s.balance > 0.004;
        return `<div class="card report-card" data-action="edit-report" data-id="${c.id}" style="cursor:pointer;">
        <div class="list-row">
          <span class="r-name">${escapeHtml(c.name)}</span>
          <span class="balance-pill ${due ? "due" : "clear"}">${due ? money(s.balance) + " due" : "Settled"}</span>
        </div>
        <div class="report-grid">
          <div><div class="r-label">Litres</div><div class="r-value tabular">${s.litres.toFixed(1)} L</div></div>
          <div><div class="r-label">Amount</div><div class="r-value tabular">${money(s.finalAmount)}</div></div>
          <div><div class="r-label">Paid</div><div class="r-value tabular" style="color:var(--good)">${money(s.paid)}</div></div>
          <div><div class="r-label">Balance</div><div class="r-value tabular" style="color:${due ? "var(--bad)" : "var(--good)"}">${money(s.balance)}</div></div>
        </div>
      </div>`;
      })
      .join("");
    const totals = customers.reduce(
      (acc, c) => {
        const s = monthSummary(c.id, reportYear, reportMonth);
        acc.litres += s.litres;
        acc.amount += s.finalAmount;
        acc.paid += s.paid;
        acc.balance += s.balance;
        return acc;
      },
      { litres: 0, amount: 0, paid: 0, balance: 0 }
    );
    return `
      <div class="form-group"><label>Select Month</label><input type="month" id="reportMonthInput" value="${mk}"></div>
      <div class="stat-grid" style="margin-bottom:14px;">
        <div class="stat-card"><div class="stat-label">Total Litres</div><div class="stat-value tabular">${totals.litres.toFixed(1)} L</div></div>
        <div class="stat-card"><div class="stat-label">Total Amount</div><div class="stat-value tabular">${money(totals.amount)}</div></div>
        <div class="stat-card"><div class="stat-label">Total Paid</div><div class="stat-value tabular" style="color:var(--good)">${money(totals.paid)}</div></div>
        <div class="stat-card warn"><div class="stat-label">Total Pending</div><div class="stat-value tabular">${money(totals.balance)}</div></div>
      </div>
      <div class="section-title" style="margin-top:0;">Tap a customer to adjust discount, extra charge or total</div>
      ${rows}
    `;
  }

  const views = { dashboard: renderDashboard, customers: renderCustomers, sales: renderSales, payments: renderPayments, reports: renderReports };

  function render() {
    document.getElementById("app").innerHTML = views[currentView]();
  }
  function setView(v) {
    currentView = v;
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
    render();
    window.scrollTo(0, 0);
  }

  /* ============ Mutations ============ */
  function handleCustomerSubmit(form) {
    const id = form.dataset.id;
    const name = form.name.value.trim();
    if (!name) return;
    const phone = form.phone.value.trim();
    const address = form.address.value.trim();
    if (id) {
      const c = custById(id);
      c.name = name;
      c.phone = phone;
      c.address = address;
      toast("Customer updated");
    } else {
      customers.push({ id: uid(), code: nextCustomerCode(), name, phone, address, createdAt: Date.now() });
      toast("Customer added");
    }
    persist();
    closeSheet();
    render();
  }
  function deleteCustomer(id) {
    customers = customers.filter((c) => c.id !== id);
    sales = sales.filter((s) => s.customerId !== id);
    payments = payments.filter((p) => p.customerId !== id);
    Object.keys(adjustments).forEach((k) => {
      if (k.startsWith(id + "_")) delete adjustments[k];
    });
    persist();
    closeSheet();
    render();
    toast("Customer deleted");
  }
  function handleSaleSubmit(form) {
    const id = form.dataset.id;
    const customerId = form.customerId.value;
    const date = form.date.value;
    const qty = parseFloat(form.qty.value);
    const rate = parseFloat(form.rate.value);
    if (!customerId || !date || isNaN(qty) || isNaN(rate) || qty <= 0 || rate <= 0) {
      toast("Please fill all fields correctly");
      return;
    }
    if (id) {
      const s = sales.find((x) => x.id === id);
      s.customerId = customerId;
      s.date = date;
      s.qty = qty;
      s.rate = rate;
      toast("Sale updated");
    } else {
      sales.push({ id: uid(), customerId, date, qty, rate, createdAt: Date.now() });
      toast("Sale added");
    }
    persist();
    closeSheet();
    render();
  }
  function deleteSale(id) {
    sales = sales.filter((s) => s.id !== id);
    persist();
    render();
    closeSheet();
    toast("Sale deleted");
  }
  function handlePaymentSubmit(form) {
    const customerId = form.customerId.value;
    const amount = parseFloat(form.amount.value);
    const date = form.date.value;
    const note = form.note.value.trim();
    if (!customerId || isNaN(amount) || amount <= 0 || !date) {
      toast("Please fill all fields correctly");
      return;
    }
    payments.push({ id: uid(), customerId, amount, date, note, createdAt: Date.now() });
    persist();
    closeSheet();
    render();
    toast("Payment recorded");
  }
  function deletePayment(id) {
    payments = payments.filter((p) => p.id !== id);
    persist();
    render();
    closeSheet();
    toast("Payment deleted");
  }
  function handleAdjustSubmit(form) {
    const cid = form.dataset.cid;
    const y = Number(form.dataset.y);
    const m = Number(form.dataset.m);
    const mk = `${y}-${pad(m)}`;
    const discount = parseFloat(form.discount.value) || 0;
    const extra = parseFloat(form.extra.value) || 0;
    const overrideRaw = form.override.value;
    const override = overrideRaw === "" ? null : parseFloat(overrideRaw);
    adjustments[cid + "_" + mk] = { discount, extra, override };
    persist();
    closeSheet();
    render();
    toast("Monthly total updated");
  }
  function doBackup() {
    const data = { app: "dudh-khata", version: 1, exportedAt: new Date().toISOString(), customers, sales, payments, adjustments, seq };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dudh-khata-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Backup downloaded");
  }
  function handleRestoreFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || !Array.isArray(data.customers) || !Array.isArray(data.sales) || !Array.isArray(data.payments)) {
          toast("Invalid backup file");
          return;
        }
        if (!confirm("This will replace all current data on this device with the backup. Continue?")) return;
        customers = data.customers || [];
        sales = data.sales || [];
        payments = data.payments || [];
        adjustments = data.adjustments || {};
        seq = data.seq || { c: customers.length };
        persist();
        closeSheet();
        setView("dashboard");
        toast("Backup restored");
      } catch (err) {
        toast("Could not read backup file");
      }
    };
    reader.readAsText(file);
  }
  function doClearData() {
    if (!confirm("Erase ALL customers, sales, and payments from this device? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? Consider downloading a backup first.")) return;
    customers = [];
    sales = [];
    payments = [];
    adjustments = {};
    seq = { c: 0 };
    persist();
    closeSheet();
    setView("dashboard");
    toast("All data erased");
  }

  /* ============ Toast ============ */
  let toastTimer;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ============ Event wiring ============ */
  document.querySelectorAll(".nav-item").forEach((btn) => btn.addEventListener("click", () => setView(btn.dataset.view)));
  document.getElementById("settingsBtn").addEventListener("click", openSettings);

  document.addEventListener("click", (e) => {
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) {
      if (e.target.classList && e.target.classList.contains("sheet-overlay")) closeSheet();
      return;
    }
    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;
    switch (action) {
      case "close-sheet":
        closeSheet();
        break;
      case "add-customer":
        openSheet("Add Customer", customerFormHTML());
        break;
      case "edit-customer":
        openSheet("Edit Customer", customerFormHTML(custById(id)));
        break;
      case "delete-customer":
        if (confirm("Delete this customer and all related sales & payment records? This cannot be undone.")) deleteCustomer(id);
        break;
      case "view-customer":
        openCustomerDetail(id);
        break;
      case "add-sale":
        openSaleForm();
        break;
      case "edit-sale":
        openSaleForm(id);
        break;
      case "delete-sale":
        if (confirm("Delete this sale record?")) deleteSale(id);
        break;
      case "add-payment":
        openPaymentForm(id);
        break;
      case "delete-payment":
        if (confirm("Delete this payment record?")) deletePayment(id);
        break;
      case "edit-report":
        openReportAdjust(id);
        break;
      case "backup":
        doBackup();
        break;
      case "trigger-restore":
        document.getElementById("restoreFile").click();
        break;
      case "clear-data":
        doClearData();
        break;
      case "sales-filter":
        salesFilter = actionEl.dataset.filter;
        render();
        break;
    }
  });

  document.addEventListener("submit", (e) => {
    e.preventDefault();
    if (e.target.id === "customerForm") handleCustomerSubmit(e.target);
    else if (e.target.id === "saleForm") handleSaleSubmit(e.target);
    else if (e.target.id === "paymentForm") handlePaymentSubmit(e.target);
    else if (e.target.id === "adjustForm") handleAdjustSubmit(e.target);
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "saleQty" || e.target.id === "saleRate") {
      const form = e.target.closest("form");
      const qty = parseFloat(form.qty.value) || 0;
      const rate = parseFloat(form.rate.value) || 0;
      const preview = document.getElementById("saleTotalPreview");
      if (preview) preview.textContent = money(qty * rate);
    }
    if (e.target.id === "customerSearchInput") {
      customerSearch = e.target.value;
      const cursor = e.target.selectionStart;
      render();
      const el = document.getElementById("customerSearchInput");
      if (el) {
        el.focus();
        el.setSelectionRange(cursor, cursor);
      }
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.id === "paySelect") {
      const preview = document.getElementById("payBalancePreview");
      if (preview) preview.textContent = money(customerBalance(e.target.value));
    }
    if (e.target.id === "restoreFile") {
      handleRestoreFile(e.target.files[0]);
    }
    if (e.target.id === "reportMonthInput" && e.target.value) {
      const [y, m] = e.target.value.split("-").map(Number);
      reportYear = y;
      reportMonth = m;
      render();
    }
  });

  /* ============ PWA service worker ============ */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  /* ============ Init ============ */
  render();
})();
