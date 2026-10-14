// src/js/utils.js
// Utilitários de formatação, máscaras e comunicação

export function formatBRL(value) {
  const number = Number(value) || 0;
  return number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function parseBRL(valueStr) {
  if (typeof valueStr === 'number') return valueStr;
  if (!valueStr) return 0;
  const cleaned = valueStr.toString().replace(/[^\d,-]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

export function formatDate(dateInput) {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    // Tenta formato YYYY-MM-DD
    const parts = String(dateInput).split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateInput;
  }
  // Corrige fuso horário local simples
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

export function formatDateForInput(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(dateInput, days) {
  const d = new Date(dateInput);
  d.setDate(d.getDate() + Number(days));
  return d;
}

export function addMonths(dateInput, months) {
  const d = new Date(dateInput);
  d.setMonth(d.getMonth() + Number(months));
  return d;
}

export function getDaysDiff(fromDate, toDate) {
  const d1 = new Date(fromDate);
  d1.setHours(0, 0, 0, 0);
  const d2 = new Date(toDate);
  d2.setHours(0, 0, 0, 0);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

export function cleanPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export function maskPhone(val) {
  let v = String(val || '').replace(/\D/g, '');
  if (v.length > 11) v = v.substring(0, 11);
  if (v.length > 10) {
    return v.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (v.length > 6) {
    return v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  } else if (v.length > 2) {
    return v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
  }
  return v;
}

export function maskCPF(val) {
  let v = String(val || '').replace(/\D/g, '');
  if (v.length > 11) v = v.substring(0, 11);
  return v
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function createWhatsAppUrl(phone, message) {
  let clean = cleanPhone(phone);
  if (!clean) return '';
  if (clean.length === 10 || clean.length === 11) {
    clean = '55' + clean; // Prefixo Brasil
  }
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type} animate-fade-in`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span class="toast-msg">${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

export function formatDateExtenso(dateInput) {
  if (!dateInput) return { dia: '', mes: '', ano: '', texto: '' };
  const d = new Date(dateInput);
  let dia = d.getDate();
  let mesIdx = d.getMonth();
  let ano = d.getFullYear();

  // Tratamento para strings YYYY-MM-DD
  if (typeof dateInput === 'string' && dateInput.includes('-')) {
    const parts = dateInput.split('T')[0].split('-');
    if (parts.length === 3) {
      ano = parseInt(parts[0], 10);
      mesIdx = parseInt(parts[1], 10) - 1;
      dia = parseInt(parts[2], 10);
    }
  }

  const mesNome = MESES[mesIdx] || '';
  return {
    dia: String(dia).padStart(2, '0'),
    mes: mesNome,
    ano: String(ano),
    texto: `${dia} de ${mesNome} de ${ano}`
  };
}

export function numeroParaExtenso(valor) {
  const v = Math.abs(Number(valor) || 0);
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function trioParaExtenso(n) {
    if (n === 100) return 'cem';
    let res = [];
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) res.push(centenas[c]);
    if (d === 1) {
      res.push(especiais[u]);
    } else {
      if (d > 1) res.push(dezenas[d]);
      if (u > 0) res.push(unidades[u]);
    }
    return res.join(' e ');
  }

  const inteiro = Math.floor(v);
  const centavos = Math.round((v - inteiro) * 100);

  let partesInteiro = [];
  if (inteiro === 0 && centavos === 0) return 'zero reais';

  if (inteiro > 0) {
    const milhoes = Math.floor(inteiro / 1000000);
    const milhares = Math.floor((inteiro % 1000000) / 1000);
    const resto = inteiro % 1000;

    if (milhoes > 0) {
      partesInteiro.push(trioParaExtenso(milhoes) + (milhoes === 1 ? ' milhão' : ' milhões'));
    }
    if (milhares > 0) {
      if (milhares === 1) {
        partesInteiro.push('um mil');
      } else {
        partesInteiro.push(trioParaExtenso(milhares) + ' mil');
      }
    }
    if (resto > 0) {
      partesInteiro.push(trioParaExtenso(resto));
    }
  }

  let resultado = '';
  if (inteiro > 0) {
    const moeda = inteiro === 1 ? 'real' : 'reais';
    resultado = partesInteiro.join(', ') + ' ' + moeda;
  }

  if (centavos > 0) {
    const centavosTexto = trioParaExtenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
    if (resultado) {
      resultado += ' e ' + centavosTexto;
    } else {
      resultado = centavosTexto;
    }
  }

  return resultado;
}

