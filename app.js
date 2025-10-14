const appLayout = document.getElementById('appLayout');
const scanControls = document.getElementById('scanControls');
const cameraToggle = document.getElementById('cameraToggle');
const scanStatus = document.getElementById('scanStatus');
const scanner = document.getElementById('scanner');
const barcodeInput = document.getElementById('barcode');
const productNameInput = document.getElementById('productName');
const expiryDateInput = document.getElementById('expiryDate');
const daysRemainingInput = document.getElementById('daysRemaining');
const form = document.getElementById('productForm');
const clearButton = document.getElementById('clearForm');
const downloadExcelButton = document.getElementById('downloadExcel');
const tableBody = document.querySelector('#productTable tbody');
const rowTemplate = document.getElementById('rowTemplate');
const userMenu = document.getElementById('userMenu');
const userEmail = document.getElementById('userEmail');
const signOutButton = document.getElementById('signOutButton');
const authContainer = document.getElementById('authContainer');
const authTitle = document.getElementById('authTitle');
const authDescription = document.getElementById('authDescription');
const authMessage = document.getElementById('authMessage');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const registerForm = document.getElementById('registerForm');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const resetForm = document.getElementById('resetForm');
const resetEmail = document.getElementById('resetEmail');
const showRegisterButton = document.getElementById('showRegister');
const showLoginButton = document.getElementById('showLogin');
const showResetButton = document.getElementById('showReset');

const firebaseConfig = window.firebaseConfig || {};
const requiredFirebaseKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId'
];

const isFirebaseConfigured = requiredFirebaseKeys.every((key) => {
  const value = firebaseConfig[key];
  return typeof value === 'string' && value.trim() && !value.startsWith('YOUR_');
});

let auth = null;
let db = null;

const authTitles = {
  login: 'Giriş Yap',
  register: 'Hesap Oluştur',
  reset: 'Şifre Yenileme'
};

const authDescriptions = {
  login: 'Kayıtlı ürün listenizi görüntülemek için hesabınıza giriş yapın.',
  register: 'Yeni bir hesap oluşturarak SKT kayıtlarınızı bulutta saklayın.',
  reset: 'Şifre yenileme bağlantısı e-posta adresinize gönderilecektir.'
};

const configWarning =
  'Lütfen firebase-config.js dosyanızda Firebase yapılandırmasını doldurun.';

const productCatalog = {
  '8690504000012': 'Örnek Çikolata 80g',
  '8691234567890': 'Organik Süt 1L',
  '8699876543210': 'Tam Buğday Unu 2kg'
};

let currentUser = null;
let products = [];
let unsubscribeProducts = null;
let isCameraActive = false;
let quaggaInitialized = false;
let currentAuthMode = 'login';

showAuthForm('login');
renderTable();

if (!isFirebaseConfigured) {
  disableAuthButtons(false);
  setAuthMessage(configWarning, 'error');
} else {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  disableAuthButtons(false);

  auth.onAuthStateChanged((user) => {
    handleAuthStateChange(user);
  });
}

showRegisterButton.addEventListener('click', () => showAuthForm('register'));
showLoginButton.addEventListener('click', () => showAuthForm('login'));
showResetButton.addEventListener('click', () => showAuthForm('reset'));

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isFirebaseConfigured) {
    setAuthMessage(configWarning, 'error');
    return;
  }

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    setAuthMessage('E-posta ve şifre zorunludur.', 'error');
    return;
  }

  const submitButton = loginForm.querySelector('button[type="submit"]');
  setButtonLoading(submitButton, true, 'Giriş yapılıyor...');
  setAuthMessage('');

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    setAuthMessage(mapAuthError(error), 'error');
  } finally {
    setButtonLoading(submitButton, false);
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isFirebaseConfigured) {
    setAuthMessage(configWarning, 'error');
    return;
  }

  const email = registerEmail.value.trim();
  const password = registerPassword.value;

  if (!email || !password) {
    setAuthMessage('E-posta ve şifre zorunludur.', 'error');
    return;
  }

  if (password.length < 6) {
    setAuthMessage('Şifreniz en az 6 karakter olmalıdır.', 'error');
    return;
  }

  const submitButton = registerForm.querySelector('button[type="submit"]');
  setButtonLoading(submitButton, true, 'Hesap oluşturuluyor...');
  setAuthMessage('');

  try {
    await auth.createUserWithEmailAndPassword(email, password);
    setAuthMessage('Hesabınız oluşturuldu! Sisteme yönlendiriliyorsunuz.', 'success');
  } catch (error) {
    setAuthMessage(mapAuthError(error), 'error');
  } finally {
    setButtonLoading(submitButton, false);
  }
});

resetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isFirebaseConfigured) {
    setAuthMessage(configWarning, 'error');
    return;
  }

  const email = resetEmail.value.trim();
  if (!email) {
    setAuthMessage('Lütfen kayıtlı e-posta adresinizi girin.', 'error');
    return;
  }

  const submitButton = resetForm.querySelector('button[type="submit"]');
  setButtonLoading(submitButton, true, 'E-posta gönderiliyor...');
  setAuthMessage('');

  try {
    await auth.sendPasswordResetEmail(email);
    setAuthMessage('Şifre yenileme bağlantısı e-posta adresinize gönderildi.', 'success');
  } catch (error) {
    setAuthMessage(mapAuthError(error), 'error');
  } finally {
    setButtonLoading(submitButton, false);
  }
});

signOutButton.addEventListener('click', async () => {
  if (!auth) {
    return;
  }

  try {
    await auth.signOut();
  } catch (error) {
    console.error('Oturum kapatılamadı:', error);
  }
});

cameraToggle.addEventListener('click', async () => {
  if (isCameraActive) {
    stopScanner();
  } else {
    await startScanner();
  }
});

clearButton.addEventListener('click', () => {
  form.reset();
  daysRemainingInput.value = '';
  barcodeInput.focus();
});

expiryDateInput.addEventListener('change', () => {
  updateDaysRemaining(expiryDateInput.value);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser) {
    alert('Lütfen önce giriş yapın.');
    return;
  }

  const barcode = barcodeInput.value.trim();
  const productName = productNameInput.value.trim();
  const expiryDate = expiryDateInput.value;

  if (!productName || !expiryDate) {
    alert('Ürün adı ve SKT alanları zorunludur.');
    return;
  }

  if (!db) {
    alert('Veritabanı yapılandırması tamamlanmadan ürün kaydedilemez.');
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  setButtonLoading(submitButton, true, 'Kaydediliyor...');

  const product = {
    barcode,
    productName,
    expiryDate,
    createdAt: new Date().toISOString()
  };

  try {
    await db
      .collection('users')
      .doc(currentUser.uid)
      .collection('products')
      .add(product);

    form.reset();
    daysRemainingInput.value = '';
    barcodeInput.focus();
  } catch (error) {
    console.error('Ürün kaydedilemedi:', error);
    alert('Ürün kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.');
  } finally {
    setButtonLoading(submitButton, false);
  }
});

barcodeInput.addEventListener('input', () => {
  const barcode = barcodeInput.value.trim();
  if (!barcode) {
    return;
  }

  const productName = productCatalog[barcode];
  if (productName) {
    productNameInput.value = productName;
  }
});

downloadExcelButton.addEventListener('click', () => {
  if (!products.length) {
    alert('İndirilecek bir ürün bulunamadı.');
    return;
  }

  const worksheetData = [
    ['#', 'Barkod', 'Ürün Adı', 'SKT', 'Kalan Gün', 'Eklenme Tarihi']
  ];

  products.forEach((product, index) => {
    const remaining = calculateRemainingDays(product.expiryDate);
    worksheetData.push([
      index + 1,
      product.barcode || '-',
      product.productName,
      formatDate(product.expiryDate),
      remaining,
      formatDate(product.createdAt, true)
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'SKT Takip');
  XLSX.writeFile(workbook, 'skt-takip-listesi.xlsx');
});

function showAuthForm(mode) {
  currentAuthMode = mode;
  loginForm.classList.toggle('hidden', mode !== 'login');
  registerForm.classList.toggle('hidden', mode !== 'register');
  resetForm.classList.toggle('hidden', mode !== 'reset');

  showLoginButton.classList.toggle('hidden', mode === 'login');
  showRegisterButton.classList.toggle('hidden', mode === 'register');
  showResetButton.classList.toggle('hidden', mode === 'reset');

  authTitle.textContent = authTitles[mode];
  authDescription.textContent = authDescriptions[mode];

  if (!isFirebaseConfigured) {
    setAuthMessage(configWarning, 'error');
  } else {
    setAuthMessage('');
  }

  const activeForm = mode === 'login' ? loginForm : mode === 'register' ? registerForm : resetForm;
  focusFirstInput(activeForm);
}

function handleAuthStateChange(user) {
  currentUser = user;

  if (!user) {
    detachProductsListener();
    products = [];
    renderTable();
    appLayout.classList.add('hidden');
    scanControls.classList.add('hidden');
    userMenu.classList.add('hidden');
    authContainer.classList.remove('hidden');
    cameraToggle.textContent = 'Kameradan Barkod Tara';
    scanStatus.textContent = 'Kamera kapalı';
    stopScanner();
    showAuthForm('login');
    return;
  }

  userEmail.textContent = user.email || '';
  authContainer.classList.add('hidden');
  userMenu.classList.remove('hidden');
  scanControls.classList.remove('hidden');
  appLayout.classList.remove('hidden');
  setAuthMessage('');

  subscribeToProducts(user.uid);
}

function subscribeToProducts(uid) {
  detachProductsListener();

  if (!db) {
    return;
  }

  unsubscribeProducts = db
    .collection('users')
    .doc(uid)
    .collection('products')
    .orderBy('createdAt', 'asc')
    .onSnapshot(
      (snapshot) => {
        products = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            barcode: data.barcode || '',
            productName: data.productName || '',
            expiryDate: data.expiryDate || '',
            createdAt: data.createdAt || ''
          };
        });
        renderTable();
      },
      (error) => {
        console.error('Ürünler yüklenemedi:', error);
        alert('Ürünler yüklenirken bir sorun oluştu. Sayfayı yenileyip tekrar deneyebilirsiniz.');
      }
    );
}

function detachProductsListener() {
  if (typeof unsubscribeProducts === 'function') {
    unsubscribeProducts();
  }
  unsubscribeProducts = null;
}

function updateDaysRemaining(expiryDate) {
  if (!expiryDate) {
    daysRemainingInput.value = '';
    return;
  }
  const remaining = calculateRemainingDays(expiryDate);
  daysRemainingInput.value = `${remaining} gün`;
}

function calculateRemainingDays(expiryDate) {
  const expiry = normalizeDate(expiryDate);
  if (!expiry) {
    return 0;
  }

  const today = new Date();
  const expiryMidnight = new Date(expiry.setHours(0, 0, 0, 0));
  const todayMidnight = new Date(today.setHours(0, 0, 0, 0));
  const diff = expiryMidnight - todayMidnight;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

async function startScanner() {
  try {
    if (!quaggaInitialized) {
      await initQuagga();
    } else {
      Quagga.start();
    }
    isCameraActive = true;
    scanner.classList.remove('hidden');
    scanner.setAttribute('aria-hidden', 'false');
    cameraToggle.textContent = 'Kamerayı Kapat';
    scanStatus.textContent = 'Kamera açık';
  } catch (error) {
    console.error('Kamera başlatılamadı:', error);
    alert('Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin.');
  }
}

function stopScanner() {
  if (!isCameraActive) return;
  Quagga.stop();
  isCameraActive = false;
  scanner.classList.add('hidden');
  scanner.setAttribute('aria-hidden', 'true');
  cameraToggle.textContent = 'Kameradan Barkod Tara';
  scanStatus.textContent = 'Kamera kapalı';
}

async function initQuagga() {
  return new Promise((resolve, reject) => {
    Quagga.init(
      {
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: document.getElementById('camera'),
          constraints: {
            facingMode: 'environment'
          }
        },
        decoder: {
          readers: ['code_128_reader']
        },
        locate: true,
        numOfWorkers: navigator.hardwareConcurrency || 2
      },
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        quaggaInitialized = true;
        Quagga.start();
        Quagga.onDetected(onBarcodeDetected);
        resolve();
      }
    );
  });
}

function onBarcodeDetected(result) {
  if (!result?.codeResult?.code) {
    return;
  }

  const barcode = result.codeResult.code;
  barcodeInput.value = barcode;
  const productName = productCatalog[barcode];
  if (productName) {
    productNameInput.value = productName;
  } else if (!productNameInput.value) {
    productNameInput.focus();
  }
  scanStatus.textContent = `Barkod bulundu: ${barcode}`;
  updateDaysRemaining(expiryDateInput.value);

  setTimeout(() => {
    scanStatus.textContent = 'Kamera açık';
  }, 3000);
}

function renderTable() {
  tableBody.innerHTML = '';

  if (!products.length) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 6;
    emptyCell.className = 'empty-state';
    emptyCell.textContent = 'Henüz ürün eklenmedi.';
    emptyRow.appendChild(emptyCell);
    tableBody.appendChild(emptyRow);
    return;
  }

  const fragment = document.createDocumentFragment();

  products.forEach((product, index) => {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    const remaining = calculateRemainingDays(product.expiryDate);
    row.querySelector('.row-index').textContent = index + 1;
    row.querySelector('.row-barcode').textContent = product.barcode || '-';
    row.querySelector('.row-product').textContent = product.productName;
    row.querySelector('.row-expiry').textContent = formatDate(product.expiryDate);
    const remainingCell = row.querySelector('.row-remaining');
    remainingCell.textContent = `${remaining} gün`;
    remainingCell.dataset.status = getStatus(remaining);
    row.querySelector('.row-created').textContent = formatDate(product.createdAt, true);
    fragment.appendChild(row);
  });

  tableBody.appendChild(fragment);
}

function getStatus(remaining) {
  if (remaining <= 0) return 'danger';
  if (remaining <= 7) return 'warning';
  return 'safe';
}

function formatDate(value, includeTime = false) {
  if (!value) return '-';
  const date = normalizeDate(value);
  if (!date || Number.isNaN(date.getTime())) {
    return '-';
  }
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
  if (includeTime) {
    Object.assign(options, { hour: '2-digit', minute: '2-digit' });
  }
  return new Intl.DateTimeFormat('tr-TR', options).format(date);
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
}

function setButtonLoading(button, isLoading, loadingText = 'Lütfen bekleyin...') {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
    button.disabled = false;
  }
}

function setAuthMessage(message, type = 'error') {
  authMessage.textContent = message || '';
  authMessage.classList.remove('success', 'error');
  if (!message) {
    return;
  }
  authMessage.classList.add(type === 'success' ? 'success' : 'error');
}

function disableAuthButtons(disabled) {
  [loginForm, registerForm, resetForm].forEach((formElement) => {
    if (!formElement) return;
    const submit = formElement.querySelector('button[type="submit"]');
    if (submit) {
      submit.disabled = disabled;
    }
  });
}

function focusFirstInput(formElement) {
  if (!formElement) return;
  const firstInput = formElement.querySelector('input');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 50);
  }
}

function mapAuthError(error) {
  const code = error?.code;
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'E-posta veya şifre hatalı.';
    case 'auth/email-already-in-use':
      return 'Bu e-posta adresi zaten kayıtlı.';
    case 'auth/invalid-email':
      return 'Geçerli bir e-posta adresi girin.';
    case 'auth/weak-password':
      return 'Şifre en az 6 karakter olmalıdır.';
    case 'auth/too-many-requests':
      return 'Çok sayıda başarısız giriş denemesi. Lütfen daha sonra tekrar deneyin.';
    default:
      return 'İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.';
  }
}

window.addEventListener('beforeunload', () => {
  if (isCameraActive) {
    stopScanner();
  }
  detachProductsListener();
});
