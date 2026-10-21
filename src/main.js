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

const today = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(checks));
    render();
  } catch {
    alert('ذخیره اطلاعات انجام نشد. فضای ذخیره‌سازی دستگاه را بررسی کن.');
  }
}

function status(c) {
  if (c.paid) return 'تسویه‌شده';
  if (c.date && c.date < today()) return 'سررسید گذشته';
  return 'در انتظار';
}

function backup() {
  const data = {
    app: 'CheckYar',
    version: 1,
    exportedAt: new Date().toISOString(),
    checks
  };

  downloadFile(
    JSON.stringify(data, null, 2),
    `checkyar-backup-${today()}.json`,
    'application/json;charset=utf-8'
  );
}

function exportCSV() {
  const headers = [
    'نوع چک',
    'مبلغ (تومان)',
    'نام طرف مقابل',
    'بانک',
    'شماره چک',
    'تاریخ سررسید',
    'وضعیت',
    'یادداشت'
  ];

  const rows = checks.map(c => [
    c.type,
    c.amount,
    c.person,
    c.bank || '',
    c.number || '',
    c.date || '',
    status(c),
    c.note || ''
  ]);

  const csvCell = value => {
    let text = String(value ?? '');

    // جلوگیری از اجرای فرمول‌های خطرناک در نرم‌افزارهای صفحه‌گسترده
    if (/^[\s]*[=+\-@\t\r]/.test(text)) {
      text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
  };

  const csv = '\uFEFF' + [headers, ...rows]
    .map(row => row.map(csvCell).join(','))
    .join('\r\n');

  downloadFile(
    csv,
    `checkyar-checks-${today()}.csv`,
    'text/csv;charset=utf-8'
  );
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function restoreFile(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const imported = Array.isArray(parsed) ? parsed : parsed.checks;

      if (!Array.isArray(imported)) {
        throw new Error('ساختار فایل پشتیبان معتبر نیست.');
      }

      const valid = imported.every(c =>
        c &&
        typeof c === 'object' &&
        ['دریافتی', 'صادره'].includes(c.type) &&
        Number.isFinite(Number(c.amount)) &&
        Number(c.amount) > 0 &&
        typeof c.person === 'string' &&
        typeof c.paid === 'boolean'
      );

      if (!valid) {
        throw new Error('اطلاعات داخل فایل معتبر نیست.');
      }

      if (!confirm(
        `تعداد ${imported.length} چک از فایل بازیابی شود؟ اطلاعات فعلی جایگزین خواهد شد.`
      )) return;

      checks = imported.map(c => ({
        id: String(c.id || crypto.randomUUID()),
        type: c.type,
        amount: Number(c.amount),
        person: String(c.person).slice(0, 100),
        bank: String(c.bank || '').slice(0, 60),
        number: String(c.number || '').slice(0, 100),
        date: String(c.date || ''),
        note: String(c.note || '').slice(0, 500),
        paid: c.paid
      }));

      editing = null;
      save();
      alert('بازیابی اطلاعات با موفقیت انجام شد.');
    } catch (err) {
      alert(err.message || 'خواندن فایل پشتیبان ناموفق بود.');
    } finally {
      $('#restoreFile').value = '';
    }
  };

  reader.onerror = () => {
    alert('خواندن فایل ناموفق بود.');
    $('#restoreFile').value = '';
  };

  reader.readAsText(file);
}

function render() {
  const total = checks
    .filter(c => !c.paid)
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const received = checks.filter(c => c.type === 'دریافتی').length;
  const issued = checks.filter(c => c.type === 'صادره').length;

  $('#app').innerHTML = `
    <header>
      <div class="brand">
        <span class="logo">✓</span>
        <div><h1>چک‌یار</h1><p>مدیریت ساده چک‌ها</p></div>
      </div>
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
        <h2>مدیریت فایل‌ها</h2>
        <p>از اطلاعاتت پشتیبان بگیر، آن را بازیابی کن یا فهرست را برای Excel خروجی بگیر.</p>
        <div class="actions">
          <button id="backupBtn" type="button" class="primary">دانلود پشتیبان</button>
          <button id="restoreBtn" type="button" class="secondary">بازیابی از فایل</button>
          <button id="csvBtn" type="button" class="secondary">خروجی Excel (CSV)</button>
          <input id="restoreFile" type="file" accept=".json,application/json" hidden />
        </div>
        <p class="notice">بازیابی، فهرست فعلی را جایگزین می‌کند. فایل پشتیبان را در جای امن نگه دار.</p>
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
        <div class="list-head">
          <h2>فهرست چک‌ها</h2>
          <span>${money(checks.length)} مورد</span>
        </div>

        <input id="search" class="search" placeholder="جستجو بر اساس نام، بانک یا شماره..." />

        <div class="filters">
          ${['همه','دریافتی','صادره','تسویه‌شده','سررسید گذشته','در انتظار'].map(f =>
            `<button type="button" data-filter="${f}" class="${filter === f ? 'selected' : ''}">${f}</button>`
          ).join('')}
        </div>

        <div id="list"></div>
      </section>

      <p class="notice">
        اطلاعات فقط در حافظه همین دستگاه ذخیره می‌شود. این برنامه به بانک یا سامانه صیاد متصل نیست.
      </p>
    </main>
  `;

  $('#backupBtn').addEventListener('click', backup);
  $('#csvBtn').addEventListener('click', exportCSV);

  $('#restoreBtn').addEventListener('click', () => {
    $('#restoreFile').click();
  });

  $('#restoreFile').addEventListener('change', e => {
    restoreFile(e.target.files[0]);
  });

  const form = $('#checkForm');

  if (editing) {
    const c = checks.find(x => x.id === editing);

    if (c) {
      for (const k of ['type', 'amount', 'person', 'bank', 'number', 'date', 'note']) {
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
    data.person = data.person.trim();

    if (!data.person || data.amount <= 0) return;

    if (editing) {
      const old = checks.find(c => c.id === editing);
      if (old) Object.assign(old, data);
    } else {
      checks.unshift({
        id: crypto.randomUUID(),
        ...data,
        paid: false
      });
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

    return `
      <article class="check-card">
        <div class="card-top">
          <div>
            <span class="type">${escapeHTML(c.type)}</span>
            <h3>${escapeHTML(c.person)}</h3>
          </div>
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
          <button data-edit="${escapeHTML(c.id)}" class="secondary">ویرایش</button>
          <button data-paid="${escapeHTML(c.id)}" class="secondary">${c.paid ? 'لغو تسویه' : 'تسویه شد'}</button>
          <button data-delete="${escapeHTML(c.id)}" class="danger">حذف</button>
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-edit]').forEach(b => {
    b.addEventListener('click', () => {
      editing = b.dataset.edit;
      render();
      $('#checkForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  list.querySelectorAll('[data-paid]').forEach(b => {
    b.addEventListener('click', () => {
      const c = checks.find(x => x.id === b.dataset.paid);

      if (c) {
        c.paid = !c.paid;
        save();
      }
    });
  });

  list.querySelectorAll('[data-delete]').forEach(b => {
    b.addEventListener('click', () => {
      const c = checks.find(x => x.id === b.dataset.delete);

      if (c && confirm(`چک ${c.person} حذف شود؟`)) {
        checks = checks.filter(x => x.id !== c.id);

        if (editing === c.id) editing = null;

        save();
      }
    });
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

render();
