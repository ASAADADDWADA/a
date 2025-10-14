const navToggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('main-nav');
const yearEl = document.getElementById('year');
const form = document.querySelector('.download__form');
const feedback = document.querySelector('.form-feedback');
const accordionButtons = document.querySelectorAll('.accordion__item > button');

// Header navigation toggle for mobile
actionNav();
function actionNav() {
  if (!navToggle || !nav) return;
  nav.setAttribute('aria-hidden', window.innerWidth <= 960 ? 'true' : 'false');

  navToggle.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!expanded));
    nav.setAttribute('aria-hidden', expanded ? 'true' : 'false');
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 960) {
      navToggle.setAttribute('aria-expanded', 'false');
      nav.setAttribute('aria-hidden', 'false');
    } else {
      nav.setAttribute('aria-hidden', navToggle.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
    }
  });
}

// Smooth scroll for anchor links
nav?.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  event.preventDefault();
  const target = document.querySelector(link.getAttribute('href'));
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (window.innerWidth <= 960) {
    navToggle.setAttribute('aria-expanded', 'false');
    nav.setAttribute('aria-hidden', 'true');
  }
});

// Year display
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

// Simulated SMS form
if (form && feedback) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const phoneInput = form.querySelector('input[type="tel"]');
    const value = phoneInput?.value.trim();
    if (!value) {
      feedback.textContent = 'Lütfen telefon numaranı gir.';
      feedback.style.color = '#facc15';
      return;
    }

    feedback.textContent = 'Bağlantı gönderildi! Gelen kutunu kontrol et.';
    feedback.style.color = '#4ade80';
    form.reset();
  });
}

// FAQ accordion
accordionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const item = button.parentElement;
    const panel = button.nextElementSibling;
    const isOpen = item.classList.contains('is-open');

    accordionButtons.forEach((btn) => {
      btn.parentElement.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.nextElementSibling.hidden = true;
    });

    if (!isOpen) {
      item.classList.add('is-open');
      button.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
    }
  });
});
