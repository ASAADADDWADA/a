import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  logEvent
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDNd5MYXVX1LRYzAoI1aNpmQMPWsUTXtJA',
  authDomain: 'skt-takip-88f52.firebaseapp.com',
  projectId: 'skt-takip-88f52',
  storageBucket: 'skt-takip-88f52.firebasestorage.app',
  messagingSenderId: '857363805721',
  appId: '1:857363805721:web:9cbcf58fc17ccd81851c88',
  measurementId: 'G-J9RYRNT8QJ'
};

const firebaseApp = initializeApp(firebaseConfig);
const isBrowserEnvironment = typeof window !== 'undefined' && typeof document !== 'undefined';
let analyticsInstance = null;

const analyticsReady = isBrowserEnvironment
  ? isAnalyticsSupported()
      .then((supported) => {
        if (supported) {
          analyticsInstance = getAnalytics(firebaseApp);
          logEvent(analyticsInstance, 'dashboard_opened');
        }
        return supported;
      })
      .catch((error) => {
        console.warn('Firebase Analytics desteklenmiyor veya başlatılamadı.', error);
        return false;
      })
  : Promise.resolve(false);

function trackEvent(name, params = {}) {
  analyticsReady
    .then((supported) => {
      if (supported && analyticsInstance) {
        logEvent(analyticsInstance, name, params);
      }
    })
    .catch(() => {
      /* yoksay */
    });
}

const stockMap = new Map();
const productCatalog = new Map();
const metrics = {
  inbound: 0,
  transfer: 0,
  sale: 0,
  warnings: 0,
  files: 0,
  lastSkuCount: 0,
  netChange: 0
};

let inventoryFilter = '';
let catalogFilter = '';
let selectedProductCode = null;

const summaryLog = document.getElementById('summaryLog');
const inventoryTableBody = document.querySelector('#inventoryTable tbody');
const catalogTableBody = document.querySelector('#catalogTable tbody');
const exportButton = document.getElementById('exportButton');
const downloadTemplateButton = document.getElementById('downloadTemplate');
const lastSyncLabel = document.getElementById('lastSync');
const inventorySearchInput = document.getElementById('inventorySearch');
const catalogSearchInput = document.getElementById('catalogSearch');
const coverageBadge = document.getElementById('coverageBadge');
const coverageValueLabel = document.getElementById('coverageValue');
const netChangeBadge = document.getElementById('netChangeBadge');
const netChangeValueLabel = document.getElementById('netChangeValue');
const operationInboundRows = document.getElementById('operationInboundRows');
const operationTransferRows = document.getElementById('operationTransferRows');
const operationSaleRows = document.getElementById('operationSaleRows');
const operationFiles = document.getElementById('operationFiles');
const operationWarnings = document.getElementById('operationWarnings');
const operationVolume = document.getElementById('operationVolume');
const alertCenterList = document.getElementById('alertCenter');
const criticalListElement = document.getElementById('criticalList');
const categoryBreakdownContainer = document.getElementById('categoryBreakdown');
const nextActionsList = document.getElementById('nextActions');
const productDetail = document.getElementById('productDetail');
const detailName = document.getElementById('detailName');
const detailCode = document.getElementById('detailCode');
const detailQuantity = document.getElementById('detailQuantity');
const detailUnit = document.getElementById('detailUnit');
const detailMinStock = document.getElementById('detailMinStock');
const detailStatus = document.getElementById('detailStatus');
const detailCategory = document.getElementById('detailCategory');
const detailLocation = document.getElementById('detailLocation');
const detailUpdatedAt = document.getElementById('detailUpdatedAt');
const detailDescription = document.getElementById('detailDescription');

const HEALTH_KEY_SUFFIX = {
  ok: 'Ok',
  low: 'Low',
  critical: 'Critical',
  out: 'Out',
  tracking: 'Tracking'
};

const healthElements = Object.fromEntries(
  Object.entries(HEALTH_KEY_SUFFIX).map(([key, suffix]) => [
    key,
    {
      value: document.getElementById(`health${suffix}Value`),
      percent: document.getElementById(`health${suffix}Percent`),
      progress: document.getElementById(`health${suffix}Progress`),
      bar: document.getElementById(`health${suffix}Bar`)
    }
  ])
);

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

const STATUS_TO_KEY = {
  Güvende: 'ok',
  Düşük: 'low',
  Kritik: 'critical',
  Tükendi: 'out',
  Takipte: 'tracking'
};

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9ğüşöçıİ\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeSelector(value = '') {
  return String(value).replace(/([\0-\x1f\x7f"'\\:;<=>?@\[\]^`{|}~#$.%&*,+()])/g, '\\$1');
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

const integerFormatter = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

function formatInteger(value) {
  return integerFormatter.format(value);
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

function computeHealthStats(entries) {
  const stats = {
    total: entries.length,
    ok: 0,
    low: 0,
    critical: 0,
    out: 0,
    tracking: 0,
    totalQuantity: 0,
    totalMinStock: 0,
    minDefinedCount: 0
  };

  entries.forEach((entry) => {
    const quantity = Number(entry.quantity || 0);
    const minStock = Number(entry.minStock ?? NaN);
    stats.totalQuantity += quantity;
    if (Number.isFinite(minStock) && minStock > 0) {
      stats.totalMinStock += minStock;
      stats.minDefinedCount += 1;
    }

    const statusKey = STATUS_TO_KEY[getStatus(entry).label] || 'tracking';
    stats[statusKey] += 1;
  });

  return stats;
}

function updateHealthIndicators(stats) {
  const total = Math.max(stats.total, 1);

  Object.entries(healthElements).forEach(([key, refs]) => {
    if (!refs) return;
    const count = stats[key] || 0;
    const percent = Math.round((count / total) * 100);
    if (refs.value) refs.value.textContent = formatInteger(count);
    if (refs.percent) refs.percent.textContent = `${percent}%`;
    if (refs.bar) refs.bar.style.width = `${percent}%`;
    if (refs.progress) {
      refs.progress.setAttribute('aria-valuenow', String(percent));
      refs.progress.setAttribute('aria-valuetext', `${percent}%`);
    }
  });
}

function updateCoverageIndicator(stats) {
  if (!coverageValueLabel || !coverageBadge) return;

  if (stats.total === 0) {
    coverageValueLabel.textContent = '-';
    coverageBadge.removeAttribute('data-level');
    return;
  }

  if (stats.totalMinStock > 0) {
    const ratio = stats.totalQuantity / stats.totalMinStock;
    coverageValueLabel.textContent = `${ratio.toFixed(1)} kat`;
    if (ratio >= 1.5) {
      delete coverageBadge.dataset.level;
    } else if (ratio >= 1) {
      coverageBadge.dataset.level = 'medium';
    } else {
      coverageBadge.dataset.level = 'low';
    }
  } else {
    coverageValueLabel.textContent = 'Veri yok';
    coverageBadge.dataset.level = 'medium';
  }
}

function renderCriticalProducts(entries, stats) {
  if (!criticalListElement) return;
  criticalListElement.innerHTML = '';

  const prioritized = entries
    .filter((entry) => Number.isFinite(entry.minStock) && entry.minStock > 0)
    .map((entry) => ({
      entry,
      ratio: entry.minStock > 0 ? (Number(entry.quantity || 0) / entry.minStock) : Infinity
    }))
    .filter((item) => item.ratio <= 1.5)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 5);

  if (!prioritized.length) {
    const li = document.createElement('li');
    li.className = 'placeholder';
    li.textContent = stats.total ? 'Kritik stok bulunmuyor.' : 'Analiz için stok verisi yükleyin.';
    criticalListElement.appendChild(li);
    return;
  }

  prioritized.forEach(({ entry, ratio }) => {
    const li = document.createElement('li');
    const percent = Math.max(0, Math.round(ratio * 100));
    li.innerHTML = `
      <strong>${entry.name || entry.code}</strong>
      <span>${entry.code} · ${(entry.category || 'Kategori Yok')}</span>
      <small>Kalan ${formatQuantity(Number(entry.quantity || 0))} / Min ${formatQuantity(Number(entry.minStock || 0))} (<span class="ratio">${percent}%</span>)</small>
    `;
    criticalListElement.appendChild(li);
  });
}

function renderCategoryBreakdown(entries, stats) {
  if (!categoryBreakdownContainer) return;
  categoryBreakdownContainer.innerHTML = '';

  if (!entries.length) {
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'Kategori bazlı veri henüz oluşmadı.';
    categoryBreakdownContainer.appendChild(placeholder);
    return;
  }

  const totals = new Map();
  entries.forEach((entry) => {
    const key = entry.category || 'Kategori Yok';
    const quantity = Number(entry.quantity || 0);
    const existing = totals.get(key) || { quantity: 0, count: 0 };
    existing.quantity += quantity;
    existing.count += 1;
    totals.set(key, existing);
  });

  const sorted = Array.from(totals.entries())
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 6);

  const denominator = stats.totalQuantity || sorted.reduce((sum, [, info]) => sum + info.quantity, 0) || 1;

  sorted.forEach(([category, info]) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'category-breakdown__item';
    const percent = Math.round((info.quantity / denominator) * 100);
    wrapper.innerHTML = `
      <div class="category-breakdown__label">
        <span>${category} (${info.count})</span>
        <strong>${formatQuantity(info.quantity)}</strong>
      </div>
      <div class="category-breakdown__bar"><span style="width: ${percent}%"></span></div>
    `;
    categoryBreakdownContainer.appendChild(wrapper);
  });
}

function updateAlertCenter(entries) {
  if (!alertCenterList) return;
  alertCenterList.innerHTML = '';

  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'placeholder';
    li.textContent = 'Analiz için yeterli veri bekleniyor.';
    alertCenterList.appendChild(li);
    return;
  }

  const alerts = [];
  entries.forEach((entry) => {
    const quantity = Number(entry.quantity || 0);
    const minStock = Number(entry.minStock ?? NaN);
    if (quantity <= 0) {
      alerts.push({
        severity: 'critical',
        title: `${entry.name || entry.code} stoğu tükendi`,
        detail: `${entry.code} için acil tedarik planı oluşturun.`
      });
    } else if (Number.isFinite(minStock) && quantity <= minStock) {
      alerts.push({
        severity: 'critical',
        title: `${entry.name || entry.code} kritik seviyede`,
        detail: `${formatQuantity(quantity)} adet kaldı. Minimum stok: ${formatQuantity(minStock)}.`
      });
    } else if (Number.isFinite(minStock) && quantity <= minStock * 1.2) {
      alerts.push({
        severity: 'low',
        title: `${entry.name || entry.code} düşük stok`,
        detail: `Rezerve stok ${formatQuantity(minStock)}. Planlanan sevkiyatları kontrol edin.`
      });
    }
  });

  const severityOrder = { critical: 0, low: 1 };
  alerts
    .sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99))
    .slice(0, 4)
    .forEach((alert) => {
      const li = document.createElement('li');
      li.dataset.severity = alert.severity;
      li.innerHTML = `<strong>${alert.title}</strong><span>${alert.detail}</span>`;
      alertCenterList.appendChild(li);
    });

  if (!alertCenterList.children.length) {
    const li = document.createElement('li');
    li.className = 'placeholder';
    li.textContent = 'Riskli stok bulunmuyor.';
    alertCenterList.appendChild(li);
  }
}

function updateActionPlan(stats) {
  if (!nextActionsList) return;
  nextActionsList.innerHTML = '';

  const suggestions = [];

  if (stats.out > 0 || stats.critical > 0) {
    suggestions.push(`Kritik durumda ${formatInteger(stats.out + stats.critical)} ürün var. Satın alma ve tedarik planı oluşturun.`);
  }

  if (metrics.warnings > 0) {
    suggestions.push(`${formatInteger(metrics.warnings)} satır uyarı verdi. Excel şablonunu gözden geçirip temizleyin.`);
  }

  if (metrics.transfer + metrics.sale > metrics.inbound) {
    suggestions.push('Çıkış hareketleri girişleri geçti. Depolar arası stok dengelemesi yapın.');
  } else {
    suggestions.push('Depo sayımı planlayarak stok doğruluğunu teyit edin.');
  }

  if (stats.low === 0 && stats.critical === 0 && stats.out === 0) {
    suggestions.unshift('Stok sağlığı dengede. Kampanya veya üretim planlarını güncelleyin.');
  }

  suggestions.slice(0, 3).forEach((text) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="action-plan__text">${text}</span>`;
    nextActionsList.appendChild(li);
  });

  if (!nextActionsList.children.length) {
    const li = document.createElement('li');
    li.className = 'placeholder';
    li.textContent = 'Veriler analiz ediliyor.';
    nextActionsList.appendChild(li);
  }
}

function updateInsightPanels() {
  const entries = Array.from(stockMap.values());
  const stats = computeHealthStats(entries);
  updateHealthIndicators(stats);
  updateCoverageIndicator(stats);
  renderCriticalProducts(entries, stats);
  renderCategoryBreakdown(entries, stats);
  updateAlertCenter(entries);
  updateActionPlan(stats);
}

function highlightSelectedRow(code) {
  inventoryTableBody.querySelectorAll('tr').forEach((row) => row.classList.remove('is-selected'));
  if (!code) return;
  const selector = `tr[data-code="${escapeSelector(code)}"]`;
  const activeRow = inventoryTableBody.querySelector(selector);
  if (activeRow) {
    activeRow.classList.add('is-selected');
  }
}

function clearProductDetail() {
  selectedProductCode = null;
  if (!productDetail) return;
  productDetail.classList.add('is-empty');
  highlightSelectedRow(null);
  if (detailName) detailName.textContent = '-';
  if (detailCode) detailCode.textContent = '-';
  if (detailQuantity) detailQuantity.textContent = '0';
  if (detailUnit) detailUnit.textContent = '-';
  if (detailMinStock) detailMinStock.textContent = '-';
  if (detailStatus) {
    detailStatus.textContent = '-';
    detailStatus.className = 'status-badge';
  }
  if (detailCategory) detailCategory.textContent = '-';
  if (detailLocation) detailLocation.textContent = '-';
  if (detailUpdatedAt) detailUpdatedAt.textContent = '-';
  if (detailDescription) detailDescription.textContent = '-';
}

function showProductDetail(entry) {
  if (!entry) {
    clearProductDetail();
    return;
  }

  selectedProductCode = entry.code;
  if (!productDetail) return;

  productDetail.classList.remove('is-empty');
  if (detailName) detailName.textContent = entry.name || 'Tanımsız Ürün';
  if (detailCode) detailCode.textContent = entry.code;
  if (detailQuantity) detailQuantity.textContent = formatQuantity(Number(entry.quantity || 0));
  if (detailUnit) detailUnit.textContent = entry.unit || '-';
  if (detailMinStock) {
    detailMinStock.textContent = Number.isFinite(entry.minStock) ? formatQuantity(Number(entry.minStock)) : '-';
  }
  if (detailCategory) detailCategory.textContent = entry.category || '-';
  if (detailLocation) detailLocation.textContent = entry.location || 'Belirtilmedi';
  if (detailUpdatedAt) detailUpdatedAt.textContent = formatDate(entry.updatedAt);
  if (detailDescription) detailDescription.textContent = entry.description || 'Açıklama girilmemiş.';

  const status = getStatus(entry);
  if (detailStatus) {
    detailStatus.className = status.className;
    detailStatus.textContent = status.label;
  }

  highlightSelectedRow(entry.code);
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
    clearProductDetail();
    return;
  }

  let hasSelection = false;

  entries.forEach((entry) => {
    const status = getStatus(entry);
    const row = document.createElement('tr');
    row.dataset.code = entry.code;
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
    row.addEventListener('click', () => {
      showProductDetail(entry);
    });
    if (entry.code === selectedProductCode) {
      row.classList.add('is-selected');
      hasSelection = true;
    }
    inventoryTableBody.appendChild(row);
  });

  if (hasSelection) {
    const current = entries.find((item) => item.code === selectedProductCode);
    if (current) {
      showProductDetail(current);
    }
  } else if (entries.length) {
    showProductDetail(entries[0]);
  }
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
    metrics.netChange += details.totalQuantityChange;
  }

  const totalQuantity = Array.from(stockMap.values()).reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);

  document.getElementById('metricSkus').textContent = formatInteger(skuCount);
  const delta = skuCount - prevSkuCount;
  const deltaLabel = delta === 0 ? 'Değişim yok' : `${delta > 0 ? '+' : ''}${delta} ürün`;
  document.getElementById('metricSkusDelta').textContent = deltaLabel;
  document.getElementById('metricQuantity').textContent = formatQuantity(totalQuantity);
  document.getElementById('metricInbound').textContent = formatInteger(metrics.inbound);
  document.getElementById('metricTransfer').textContent = formatInteger(metrics.transfer);
  document.getElementById('metricSale').textContent = formatInteger(metrics.sale);
  document.getElementById('metricWarnings').textContent = formatInteger(metrics.warnings);

  if (operationInboundRows) operationInboundRows.textContent = formatInteger(metrics.inbound);
  if (operationTransferRows) operationTransferRows.textContent = formatInteger(metrics.transfer);
  if (operationSaleRows) operationSaleRows.textContent = formatInteger(metrics.sale);
  if (operationFiles) operationFiles.textContent = formatInteger(metrics.files);
  if (operationWarnings) operationWarnings.textContent = formatInteger(metrics.warnings);
  if (operationVolume) operationVolume.textContent = formatQuantity(totalQuantity);

  if (netChangeValueLabel) {
    const net = metrics.netChange;
    const label = `${net >= 0 ? '+' : ''}${formatQuantity(net)}`;
    netChangeValueLabel.textContent = label;
    if (netChangeBadge) {
      if (net > 0) {
        netChangeBadge.dataset.trend = 'positive';
      } else if (net < 0) {
        netChangeBadge.dataset.trend = 'negative';
      } else {
        delete netChangeBadge.dataset.trend;
      }
    }
  }

  if (details) {
    lastSyncLabel.textContent = formatDate(new Date());
  }

  updateInsightPanels();
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
    trackEvent('inventory_export_empty', { reason: 'no_data' });
    return;
  }

  const totalQuantity = entries.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
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
  trackEvent('inventory_exported', {
    sku_count: rows.length,
    total_quantity: totalQuantity
  });
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
  trackEvent('template_downloaded', { sample_rows: rows.length });
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
      trackEvent('excel_upload_processed', {
        action,
        file_name: file.name,
        total_rows: details.total,
        processed_rows: details.affected,
        skipped_rows: details.skipped,
        quantity_change: details.totalQuantityChange
      });
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
      trackEvent('excel_upload_failed', {
        action,
        file_name: file.name,
        message: error.message
      });
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
  trackEvent('initial_inventory_seeded', {
    sku_count: initialCatalog.length
  });
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
