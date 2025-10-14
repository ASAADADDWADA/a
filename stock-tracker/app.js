const stockMap = new Map();
const productCatalog = new Map();
const metrics = {
  inbound: 0,
  transfer: 0,
  sale: 0,
  warnings: 0,
  files: 0,
  lastSkuCount: 0
};

let inventoryFilter = '';
let catalogFilter = '';

const summaryLog = document.getElementById('summaryLog');
const inventoryTableBody = document.querySelector('#inventoryTable tbody');
const catalogTableBody = document.querySelector('#catalogTable tbody');
const exportButton = document.getElementById('exportButton');
const downloadTemplateButton = document.getElementById('downloadTemplate');
const lastSyncLabel = document.getElementById('lastSync');
const inventorySearchInput = document.getElementById('inventorySearch');
const catalogSearchInput = document.getElementById('catalogSearch');

const ACTION_LABELS = {
  inbound: 'Depodan Gelen Mal Girişi',
  transfer: 'Transfer / Mal Çıkışı',
  sale: 'Anlık Satış Çıkışı',
  info: 'Bilgilendirme'
};

const ACTION_SIGN = {
  inbound: 1,
  transfer: -1,
  sale: -1
};

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9ğüşöçıİ\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findValue(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return undefined;
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value)
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  const result = Number.parseFloat(normalized);
  return Number.isFinite(result) ? result : null;
}

function formatQuantity(value) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(value);
}

function normalizeRow(row) {
  const normalized = {};
  Object.entries(row).forEach(([key, value]) => {
    normalized[slugify(key)] = value;
  });
  return normalized;
}

function getStatus(entry) {
  const quantity = Number(entry.quantity || 0);
  const minStock = Number(entry.minStock ?? NaN);

  if (!Number.isFinite(minStock) || minStock < 0) {
    return { label: 'Takipte', className: 'status-badge' };
  }

  if (quantity <= 0) {
    return { label: 'Tükendi', className: 'status-badge status-badge--critical' };
  }

  if (quantity <= minStock) {
    return { label: 'Kritik', className: 'status-badge status-badge--critical' };
  }

  if (quantity <= minStock * 1.2) {
    return { label: 'Düşük', className: 'status-badge status-badge--low' };
  }

  return { label: 'Güvende', className: 'status-badge status-badge--ok' };
}

function matchesFilter(entry, filter) {
  if (!filter) return true;
  const haystack = slugify([
    entry.code,
    entry.name,
    entry.category,
    entry.location,
    entry.unit,
    entry.description
  ].filter(Boolean).join(' '));
  return haystack.includes(filter);
}

function processWorkbook(action, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const processed = handleRows(action, rows);
        resolve(processed);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

function handleRows(action, rows) {
  const details = {
    action,
    total: rows.length,
    affected: 0,
    skipped: 0,
    warnings: [],
    totalQuantityChange: 0
  };

  rows.forEach((row, index) => {
    const normalized = normalizeRow(row);
    const code = findValue(normalized, ['stok kodu', 'stok_kodu', 'sku', 'ürün kodu', 'urun kodu', 'kod']);
    const name = findValue(normalized, ['ürün adı', 'urun adi', 'ürün', 'urun']);
    const unit = findValue(normalized, ['birim', 'unit', 'ölçü birimi', 'olcu birimi']);
    const quantityValue = findValue(normalized, ['miktar', 'adet', 'quantity', 'qty']);
    const category = findValue(normalized, ['kategori', 'grup', 'departman']);
    const location = findValue(normalized, ['lokasyon', 'raf', 'adres', 'konum']);
    const description = findValue(normalized, ['açıklama', 'aciklama', 'not', 'detay']);
    const minStockValue = findValue(normalized, ['minimum stok', 'min stok', 'kritik stok', 'emniyet stoğu', 'emniyet stogu']);
    const quantity = parseNumber(quantityValue);
    const minStock = parseNumber(minStockValue);

    if (!code) {
      details.skipped += 1;
      details.warnings.push(`Satır ${index + 2}: Stok kodu bulunamadı.`);
      return;
    }

    if (quantity === null) {
      details.skipped += 1;
      details.warnings.push(`Satır ${index + 2}: '${code}' ürünü için miktar okunamadı.`);
      return;
    }

    const direction = ACTION_SIGN[action] || 1;
    const change = direction * quantity;
    const existing = stockMap.get(code) || {
      code,
      name: name || 'Tanımsız Ürün',
      unit: unit || '',
      quantity: 0,
      category: category || '',
      location: location || '',
      minStock: Number.isFinite(minStock) ? minStock : null,
      description: description || '',
      updatedAt: null
    };

    const catalogEntry = productCatalog.get(code) || {
      code,
      name: name || existing.name || 'Tanımsız Ürün',
      category: category || existing.category || '',
      unit: unit || existing.unit || '',
      minStock: Number.isFinite(minStock) ? minStock : existing.minStock || null,
      location: location || existing.location || '',
      description: description || existing.description || ''
    };

    if (name) {
      existing.name = name;
      catalogEntry.name = name;
    }
    if (unit) {
      existing.unit = unit;
      catalogEntry.unit = unit;
    }
    if (category) {
      existing.category = category;
      catalogEntry.category = category;
    }
    if (location) {
      existing.location = location;
      catalogEntry.location = location;
    }
    if (description) {
      existing.description = description;
      catalogEntry.description = description;
    }
    if (Number.isFinite(minStock)) {
      existing.minStock = minStock;
      catalogEntry.minStock = minStock;
    }

    const currentQuantity = Number(existing.quantity || 0);
    const updatedQuantity = currentQuantity + change;

    if (updatedQuantity < 0) {
      existing.quantity = 0;
      details.warnings.push(`Satır ${index + 2}: '${code}' ürünü için stok yetersiz olduğu için miktar 0 olarak güncellendi.`);
    } else {
      existing.quantity = updatedQuantity;
    }

    existing.updatedAt = new Date();
    stockMap.set(code, existing);
    productCatalog.set(code, catalogEntry);

    details.affected += 1;
    details.totalQuantityChange += change;
  });

  renderInventory();
  renderCatalog();
  return details;
}

function renderInventory() {
  const entries = Array.from(stockMap.values())
    .filter((entry) => matchesFilter(entry, inventoryFilter))
    .sort((a, b) => a.code.localeCompare(b.code, 'tr'));

  inventoryTableBody.innerHTML = '';

  if (!entries.length) {
    const row = document.createElement('tr');
    row.className = 'placeholder';
    const cell = document.createElement('td');
    cell.colSpan = 9;
    cell.textContent = inventoryFilter
      ? 'Aramanıza uygun stok bulunamadı.'
      : 'Henüz stok verisi bulunmuyor. Excel yükleyerek başlayın.';
    row.appendChild(cell);
    inventoryTableBody.appendChild(row);
    return;
  }

  entries.forEach((entry) => {
    const status = getStatus(entry);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.code}</td>
      <td>${entry.name || ''}</td>
      <td>${entry.category || '-'}</td>
      <td>${entry.location || '-'}</td>
      <td>${entry.unit || '-'}</td>
      <td>${formatQuantity(entry.quantity)}</td>
      <td>${Number.isFinite(entry.minStock) ? formatQuantity(entry.minStock) : '-'}</td>
      <td><span class="${status.className}">${status.label}</span></td>
      <td>${formatDate(entry.updatedAt)}</td>
    `;
    inventoryTableBody.appendChild(row);
  });
}

function renderCatalog() {
  const entries = Array.from(productCatalog.values())
    .filter((entry) => matchesFilter(entry, catalogFilter))
    .sort((a, b) => {
      const byCategory = (a.category || '').localeCompare(b.category || '', 'tr');
      if (byCategory !== 0) return byCategory;
      return a.code.localeCompare(b.code, 'tr');
    });

  catalogTableBody.innerHTML = '';

  if (!entries.length) {
    const row = document.createElement('tr');
    row.className = 'placeholder';
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.textContent = catalogFilter
      ? 'Aramanıza uygun ürün bulunamadı.'
      : 'Henüz ürün tanımı bulunmuyor.';
    row.appendChild(cell);
    catalogTableBody.appendChild(row);
    return;
  }

  entries.forEach((entry) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.code}</td>
      <td>${entry.name || ''}</td>
      <td>${entry.category || '-'}</td>
      <td>${entry.unit || '-'}</td>
      <td>${Number.isFinite(entry.minStock) ? formatQuantity(entry.minStock) : '-'}</td>
      <td>${entry.location || '-'}</td>
      <td>${entry.description || '-'}</td>
    `;
    catalogTableBody.appendChild(row);
  });
}

function appendSummary(details, fileName, customLabel) {
  const wrapper = document.createElement('div');
  wrapper.className = 'summary__entry';

  const quantityChange = details.totalQuantityChange || 0;
  const changeLabel = quantityChange === 0
    ? 'Stok değişimi olmadı.'
    : `Stok değişimi: ${quantityChange > 0 ? '+' : ''}${formatQuantity(quantityChange)}.`;

  const warnings = details.warnings.length
    ? `<br/><span>${details.warnings.slice(0, 5).join('<br/>')}${details.warnings.length > 5 ? '<br/>…' : ''}</span>`
    : '';

  wrapper.innerHTML = `
    <strong>${customLabel || ACTION_LABELS[details.action] || 'İşlem'}</strong> işlemi için <strong>${fileName}</strong> dosyası işlendi.<br/>
    Toplam satır: ${details.total}, Güncellenen stok: ${details.affected}, Atlanan satır: ${details.skipped}. ${changeLabel}${warnings}
  `;

  summaryLog.prepend(wrapper);
}

function updateMetrics(details) {
  const prevSkuCount = metrics.lastSkuCount;
  const skuCount = stockMap.size;
  metrics.lastSkuCount = skuCount;

  if (details) {
    metrics.files += 1;
    metrics.warnings += details.warnings.length;
    if (metrics[details.action] !== undefined) {
      metrics[details.action] += details.affected;
    }
  }

  const totalQuantity = Array.from(stockMap.values()).reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);

  const formatNumber = (value) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(value);

  document.getElementById('metricSkus').textContent = formatNumber(skuCount);
  const delta = skuCount - prevSkuCount;
  const deltaLabel = delta === 0 ? 'Değişim yok' : `${delta > 0 ? '+' : ''}${delta} ürün`;
  document.getElementById('metricSkusDelta').textContent = deltaLabel;
  document.getElementById('metricQuantity').textContent = formatQuantity(totalQuantity);
  document.getElementById('metricInbound').textContent = formatNumber(metrics.inbound);
  document.getElementById('metricTransfer').textContent = formatNumber(metrics.transfer);
  document.getElementById('metricSale').textContent = formatNumber(metrics.sale);
  document.getElementById('metricWarnings').textContent = formatNumber(metrics.warnings);

  if (details) {
    lastSyncLabel.textContent = formatDate(new Date());
  }
}

function exportInventory() {
  const entries = Array.from(stockMap.values());
  if (!entries.length) {
    appendSummary({
      action: 'info',
      total: 0,
      affected: 0,
      skipped: 0,
      warnings: ['İndirilecek stok verisi bulunamadı.'],
      totalQuantityChange: 0
    }, 'Stok', 'Bilgilendirme');
    return;
  }

  const rows = entries
    .sort((a, b) => a.code.localeCompare(b.code, 'tr'))
    .map((entry) => ({
      'Stok Kodu': entry.code,
      'Ürün Adı': entry.name,
      'Kategori': entry.category || '',
      'Lokasyon': entry.location || '',
      'Birim': entry.unit,
      'Miktar': entry.quantity,
      'Minimum Stok': Number.isFinite(entry.minStock) ? entry.minStock : '',
      'Durum': getStatus(entry).label,
      'Son Güncelleme': entry.updatedAt ? entry.updatedAt.toISOString() : ''
    }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Güncel Stok');
  XLSX.writeFile(workbook, `stok-durumu-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function downloadTemplate() {
  const rows = [
    {
      'Stok Kodu': 'STK-0001',
      'Ürün Adı': 'Örnek Ürün',
      'Kategori': 'Kategori',
      'Lokasyon': 'A-01',
      'Birim': 'Adet',
      'Miktar': 10,
      'Minimum Stok': 5,
      'Açıklama': 'Opsiyonel not'
    }
  ];
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stok Hareketi');
  XLSX.writeFile(workbook, 'stok-hareket-sablonu.xlsx');
}

function handleFileInput(event) {
  const input = event.currentTarget;
  const action = input.dataset.action;
  const file = input.files[0];

  if (!file || !action) {
    return;
  }

  processWorkbook(action, file)
    .then((details) => {
      appendSummary(details, file.name);
      updateMetrics(details);
    })
    .catch((error) => {
      appendSummary({
        action,
        total: 0,
        affected: 0,
        skipped: 0,
        warnings: [error.message],
        totalQuantityChange: 0
      }, file.name);
      metrics.warnings += 1;
      updateMetrics();
    })
    .finally(() => {
      input.value = '';
    });
}

function bootstrapInitialData() {
  const initialCatalog = [
    {
      code: 'STK-1001',
      name: 'Endüstriyel Vidalı Kompresör',
      category: 'Makine',
      unit: 'Adet',
      minStock: 2,
      location: 'A-01',
      description: 'Bakım seti ile teslim edilir.',
      quantity: 5
    },
    {
      code: 'STK-1010',
      name: 'Pnömatik Hortum Seti',
      category: 'Aksesuar',
      unit: 'Set',
      minStock: 10,
      location: 'B-12',
      description: '5\'li bağlantı adaptörü içerir.',
      quantity: 24
    },
    {
      code: 'STK-2030',
      name: 'Endüstriyel Yağ 20L',
      category: 'Tüketim',
      unit: 'Bidon',
      minStock: 8,
      location: 'C-07',
      description: 'ISO VG 46',
      quantity: 12
    },
    {
      code: 'STK-3050',
      name: 'Elektrik Motoru 5.5kW',
      category: 'Yedek Parça',
      unit: 'Adet',
      minStock: 3,
      location: 'D-03',
      description: 'IE3 yüksek verim sınıfı.',
      quantity: 3
    },
    {
      code: 'STK-4100',
      name: 'Filtre Kartuşu',
      category: 'Tüketim',
      unit: 'Adet',
      minStock: 30,
      location: 'E-02',
      description: 'Her 500 saatlik kullanımda değişim önerilir.',
      quantity: 28
    },
    {
      code: 'STK-5200',
      name: 'Kontrol Paneli Modülü',
      category: 'Elektronik',
      unit: 'Adet',
      minStock: 4,
      location: 'F-05',
      description: 'Firmware v2.3 ile uyumlu.',
      quantity: 6
    }
  ];

  initialCatalog.forEach((item) => {
    const catalogEntry = { ...item };
    delete catalogEntry.quantity;
    productCatalog.set(item.code, catalogEntry);

    stockMap.set(item.code, {
      code: item.code,
      name: item.name,
      unit: item.unit,
      category: item.category,
      location: item.location,
      minStock: Number.isFinite(item.minStock) ? item.minStock : null,
      description: item.description,
      quantity: item.quantity,
      updatedAt: new Date()
    });
  });

  renderInventory();
  renderCatalog();
  updateMetrics();
  lastSyncLabel.textContent = formatDate(new Date());

  appendSummary({
    action: 'info',
    total: initialCatalog.length,
    affected: initialCatalog.length,
    skipped: 0,
    warnings: [],
    totalQuantityChange: initialCatalog.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  }, 'Başlangıç Verisi', 'Sistem');
}

function bindEvents() {
  document.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener('change', handleFileInput);
  });

  inventorySearchInput.addEventListener('input', (event) => {
    inventoryFilter = slugify(event.currentTarget.value);
    renderInventory();
  });

  catalogSearchInput.addEventListener('input', (event) => {
    catalogFilter = slugify(event.currentTarget.value);
    renderCatalog();
  });

  exportButton.addEventListener('click', exportInventory);
  downloadTemplateButton.addEventListener('click', downloadTemplate);
}

bootstrapInitialData();
bindEvents();
