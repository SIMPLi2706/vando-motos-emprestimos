// src/js/components/loginScreen.js
// Tela de Login com PIN de 4 Dígitos - Vando Motos Locadora LTDA (Opcional & 100% Responsiva)

import { showToast } from '../utils.js';

const PIN_STORAGE_KEY = 'vandomotos_pin';
const PIN_ENABLED_KEY = 'vandomotos_pin_enabled';
const AUTH_SESSION_KEY = 'vandomotos_authenticated';
const DEFAULT_PIN = '1234';

/**
 * Verifica se a proteção por PIN está ativada no sistema
 * @returns {boolean} Padrão: false (desativado para não bloquear acesso)
 */
export function isPinEnabled() {
  return localStorage.getItem(PIN_ENABLED_KEY) === 'true';
}

/**
 * Ativa ou desativa a exigência de PIN ao entrar no sistema
 * @param {boolean} enabled
 */
export function setPinEnabled(enabled) {
  localStorage.setItem(PIN_ENABLED_KEY, enabled ? 'true' : 'false');
  if (!enabled) {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  }
}

/**
 * Verifica se a sessão atual está autenticada
 * @returns {boolean}
 */
export function isAuthenticated() {
  // Se o PIN não estiver ativado, o acesso é direto e livre
  if (!isPinEnabled()) return true;
  return sessionStorage.getItem(AUTH_SESSION_KEY) === 'true';
}

/**
 * Obtém o PIN configurado no localStorage (padrão: '1234')
 * @returns {string}
 */
export function getStoredPin() {
  let pin = localStorage.getItem(PIN_STORAGE_KEY);
  if (!pin) {
    pin = DEFAULT_PIN;
    localStorage.setItem(PIN_STORAGE_KEY, DEFAULT_PIN);
  }
  return pin;
}

/**
 * Atualiza o PIN configurado no localStorage
 * @param {string} newPin
 * @returns {boolean}
 */
export function setStoredPin(newPin) {
  const pinStr = String(newPin || '').trim();
  if (!/^\d{4}$/.test(pinStr)) {
    throw new Error('O PIN deve conter exatamente 4 dígitos numéricos.');
  }
  localStorage.setItem(PIN_STORAGE_KEY, pinStr);
  return true;
}

/**
 * Bloqueia o sistema manualmente exigindo o PIN
 */
export function lockSession() {
  setPinEnabled(true);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  window.location.reload();
}

/**
 * Encerra a sessão e recarrega
 */
export function logout() {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  window.location.reload();
}

/**
 * Cria e renderiza a tela de login por PIN (caso ativada)
 * @param {Function} [onSuccess] Callback executado ao validar o PIN com sucesso
 * @returns {HTMLElement|null}
 */
export function createLoginScreen(onSuccess) {
  // Se o PIN estiver desativado ou já autenticado, prossegue direto
  if (isAuthenticated()) {
    const cb = onSuccess || window.onAuthSuccess || window.onLoginSuccess;
    if (typeof cb === 'function') {
      setTimeout(() => cb(), 0);
    }
    return null;
  }

  // Evita duplicatas se a tela já estiver no DOM
  const existingScreen = document.getElementById('pin-login-screen');
  if (existingScreen) {
    return existingScreen;
  }

  getStoredPin();

  let enteredPin = '';
  let isChecking = false;

  const screen = document.createElement('div');
  screen.id = 'pin-login-screen';
  screen.className = 'pin-screen animate-fade-in';

  screen.innerHTML = `
    <div class="pin-card">
      <div class="pin-brand">
        <img src="/logo-vandomotos.png" alt="Vando Motos Locadora" class="pin-logo" />
        <h1 class="pin-title">Vando Motos Locadora</h1>
        <p class="pin-subtitle">Digite seu PIN para acessar</p>
      </div>

      <div class="pin-dots" id="pin-dots" aria-live="polite" aria-label="Dígitos informados">
        <span class="pin-dot" data-index="0"></span>
        <span class="pin-dot" data-index="1"></span>
        <span class="pin-dot" data-index="2"></span>
        <span class="pin-dot" data-index="3"></span>
      </div>

      <div class="pin-keypad" role="group" aria-label="Teclado numérico">
        <button type="button" class="pin-btn" data-key="1">1</button>
        <button type="button" class="pin-btn" data-key="2">2</button>
        <button type="button" class="pin-btn" data-key="3">3</button>

        <button type="button" class="pin-btn" data-key="4">4</button>
        <button type="button" class="pin-btn" data-key="5">5</button>
        <button type="button" class="pin-btn" data-key="6">6</button>

        <button type="button" class="pin-btn" data-key="7">7</button>
        <button type="button" class="pin-btn" data-key="8">8</button>
        <button type="button" class="pin-btn" data-key="9">9</button>

        <button type="button" class="pin-btn pin-btn--action" data-action="clear" aria-label="Limpar">
          <span class="pin-btn-action-label">Limpar</span>
        </button>
        <button type="button" class="pin-btn" data-key="0">0</button>
        <button type="button" class="pin-btn pin-btn--action" data-action="backspace" aria-label="Apagar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
            <line x1="18" y1="9" x2="12" y2="15"></line>
            <line x1="12" y1="9" x2="18" y2="15"></line>
          </svg>
        </button>
      </div>

      <div class="pin-footer-actions">
        <button type="button" class="pin-skip-btn" id="btn-skip-pin">
          Entrar sem PIN
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(screen);

  const dots = screen.querySelectorAll('.pin-dot');
  const dotsContainer = screen.querySelector('.pin-dots');
  const keypad = screen.querySelector('.pin-keypad');

  function updateDots() {
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx < enteredPin.length);
    });
  }

  function handleDigit(digit) {
    if (isChecking || enteredPin.length >= 4) return;
    enteredPin += digit;
    updateDots();

    if (enteredPin.length === 4) {
      validatePin();
    }
  }

  function handleBackspace() {
    if (isChecking || enteredPin.length === 0) return;
    enteredPin = enteredPin.slice(0, -1);
    updateDots();
  }

  function handleClear() {
    if (isChecking) return;
    enteredPin = '';
    updateDots();
  }

  function closeAndProceed() {
    sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
    screen.classList.add('fade-out');

    const cb = onSuccess || window.onAuthSuccess || window.onLoginSuccess;
    if (typeof cb === 'function') {
      cb();
    }

    cleanupListeners();
    setTimeout(() => screen.remove(), 280);
  }

  function validatePin() {
    isChecking = true;
    const correctPin = getStoredPin();

    if (enteredPin === correctPin) {
      closeAndProceed();
    } else {
      dotsContainer.classList.add('shake');
      showToast('PIN incorreto', 'error');

      setTimeout(() => {
        dotsContainer.classList.remove('shake');
        enteredPin = '';
        updateDots();
        isChecking = false;
      }, 450);
    }
  }

  const handleKeypadClick = (e) => {
    const btn = e.target.closest('.pin-btn');
    if (!btn) return;

    const key = btn.dataset.key;
    const action = btn.dataset.action;

    if (key !== undefined) {
      handleDigit(key);
    } else if (action === 'backspace') {
      handleBackspace();
    } else if (action === 'clear') {
      handleClear();
    }
  };
  keypad.addEventListener('click', handleKeypadClick);

  screen.querySelector('#btn-skip-pin')?.addEventListener('click', () => {
    closeAndProceed();
  });

  const handleKeyDown = (e) => {
    if (e.key >= '0' && e.key <= '9') {
      handleDigit(e.key);
    } else if (e.key === 'Backspace') {
      handleBackspace();
    } else if (e.key === 'Escape' || e.key === 'Delete') {
      handleClear();
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  function cleanupListeners() {
    keypad.removeEventListener('click', handleKeypadClick);
    window.removeEventListener('keydown', handleKeyDown);
  }

  return screen;
}
