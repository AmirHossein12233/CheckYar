
import './style.css';

const $ = (s) => document.querySelector(s);
const KEY = 'checkyar-data-v1';

let checks = [];
try {
  checks = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (!Array.isArray(checks)) checks = [];
} catch {
  checks = [];
}

let filter = 'همه';
let editing = null;

const money = (n) => new Intl.NumberFormat('fa-IR').format(Number(n) || 0);
const today = () => new Date().toISOString().slice(0, 10);

function save() {
  localStorage.setItem(KEY, JSON.stringify(checks));
  render();
}

function status(c) {
  if (c.paid) return 'تسویه‌شده';
  if (c.date && c.date < today()) return 'سررسید گذشته';
  return 'در انتظار';
}

function render() {
  const total = checks.filter(c => !c.paid).reduce((s, c) => s + Number(c.amount), 0);
  const received = checks.filter(c => c.type === 'دریافتی').length;
  const issued = checks.filter(c => c.type === 'صادره').length;

  $('#app').innerHTML = `
    <header>
      <div class="brand"><span class="logo">✓</span><div><h1>چک‌یار</h1><p>مدیریت ساده چک‌ها</p></div></div>
      <span class="local">ذخیره روی همین دستگاه</span>
    </header>

    <main>
      <section class="hero">
        <p class="muted">مجموع مبلغ چک‌های تسویه‌نشده</p>
        <h2>${money(total)} <small>تومان</small></h2>
        <div class="stats">
          <div><strong>${money(received)}</strong><span>چک دریافتی</span></div>
          <div><strong>${money(issued)}</strong><span>چک صادره</span></div>
          <div><strong>${money(checks.filter(c => c.paid).length)}</strong><span>تسویه‌شده</span></div>
        </div>
      </section>

      <section class="panel">
        <h2>${editing ? 'ویرایش چک' : 'ثبت چک جدید'}</h2>
        <form id="checkForm">
          <div class="fields">
            <label>نوع چک
              <select name="type">
                <option>دریافتی</option>
                <option>صادره</option>
              </select>
            </label>
            <label>مبلغ (تومان)
              <input name="amount" type="number" min="1" required placeholder="مثلاً 5000000" />
            </label>
            <label>نام صاحب چک / طرف مقابل
              <input name="person" maxlength="100" required placeholder="نام و نام خانوادگی" />
            </label>
            <label>بانک
              <input name="bank" maxlength="60" placeholder="نام بانک" />
            </label>
            <label>شناسه یا شماره چک
              <input name="number" maxlength="100" placeholder="شماره چک" />
            </label>
            <label>تاریخ سررسید
              <input name="date" type="date" required />
            </label>
            <label class="wide">یادداشت
              <textarea name="note" maxlength="500" rows="2" placeholder="توضیحات اختیاری"></textarea>
            </label>
          </div>
          <div class="actions">
            <button class="primary" type="submit">${editing ? 'ذخیره تغییرات' : 'ثبت چک'}</button>
            ${editing ? '<button id="cancelEdit" type="button" class="secondary">لغو ویرایش</button>' : ''}
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="list-head"><h2>فهرست چک‌ها</h2><span>${money(checks.length)} مورد</span></div>
        <input id="search" class="search" placeholder="جستجو بر اساس نام، بانک یا شماره..." />
        <div class="filters">
          ${['همه','دریافتی','صادره','تسویه‌شده','سررسید گذشته','در انتظار'].map(f =>
            `<button type="button" data-filter="${f}" class="${filter === f ? 'selected' : ''}">${f}</button>`
          ).join('')}
        </div>
        <div id="list"></div>
      </section>
      <p class="notice">اطلاعات فقط در حافظه همین دستگاه ذخیره می‌شود. با پاک‌کردن داده‌های برنامه ممکن است اطلاعات از بین برود. این برنامه به بانک یا سامانه صیاد متصل نیست.</p>
    </main>`;

  const form = $('#checkForm');
  if (editing) {
    const c = checks.find(x => x.id === editing);
    if (c) {
      for (const k of ['type','amount','person','bank','number','date','note']) {
        form.elements[k].value = c[k] ?? '';
      }
    }
  } else {
    form.elements.date.value = today();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.amount = Number(data.amount);
    if (!data.person.trim() || data.amount <= 0) return;

    if (editing) {
      const old = checks.find(c => c.id === editing);
      if (old) Object.assign(old, data);
    } else {
      checks.unshift({ id: crypto.randomUUID(), ...data, paid: false });
    }
    editing = null;
    save();
  });

  $('#cancelEdit')?.addEventListener('click', () => {
    editing = null;
    render();
  });

  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      filter = btn.dataset.filter;
      render();
    });
  });

  $('#search').addEventListener('input', updateList);
  updateList();
}

function updateList() {
  const q = $('#search').value.trim().toLowerCase();
  const items = checks.filter(c => {
    const s = status(c);
    const matchesFilter = filter === 'همه' || c.type === filter || s === filter;
    const haystack = [c.person, c.bank, c.number, c.note].join(' ').toLowerCase();
    return matchesFilter && haystack.includes(q);
  });

  const list = $('#list');
  if (!items.length) {
    list.innerHTML = '<div class="empty">چکی برای نمایش وجود ندارد.</div>';
    return;
  }

  list.innerHTML = items.map(c => {
    const st = status(c);
    return `<article class="check-card">
      <div class="card-top">
        <div><span class="type">${c.type}</span><h3>${escapeHTML(c.person)}</h3></div>
        <span class="status ${c.paid ? 'paid' : st === 'سررسید گذشته' ? 'late' : ''}">${st}</span>
      </div>
      <div class="amount">${money(c.amount)} <small>تومان</small></div>
      <div class="details">
        <span>بانک: ${escapeHTML(c.bank || '—')}</span>
        <span>سررسید: ${escapeHTML(c.date || '—')}</span>
        <span>شماره: ${escapeHTML(c.number || '—')}</span>
      </div>
      ${c.note ? `<p class="note">${escapeHTML(c.note)}</p>` : ''}
      <div class="card-actions">
        <button data-edit="${c.id}" class="secondary">ویرایش</button>
        <button data-paid="${c.id}" class="secondary">${c.paid ? 'لغو تسویه' : 'تسویه شد'}</button>
        <button data-delete="${c.id}" class="danger">حذف</button>
      </div>
    </article>`;
  }).join('');

  list.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    editing = b.dataset.edit;
    render();
    $('#checkForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  list.querySelectorAll('[data-paid]').forEach(b => b.addEventListener('click', () => {
    const c = checks.find(x => x.id === b.dataset.paid);
    if (c) {
      c.paid = !c.paid;
      save();
    }
  }));

  list.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => {
    const c = checks.find(x => x.id === b.dataset.delete);
    if (c && confirm(`چک ${c.person} حذف شود؟`)) {
      checks = checks.filter(x => x.id !== c.id);
      if (editing === c.id) editing = null;
      save();
    }
  }));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  })[ch]);
}

render();
