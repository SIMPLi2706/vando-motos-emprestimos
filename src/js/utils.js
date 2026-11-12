// src/js/utils.js
// Utilitários de formatação, máscaras e comunicação

import { icon } from './icons.js';

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
  const iconHtml = type === 'success' 
    ? icon('checkCircle', 16) 
    : type === 'error' 
    ? icon('alert', 16) 
    : icon('info', 16);

  toast.innerHTML = `
    <span class="toast-icon">${iconHtml}</span>
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

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Redimensiona e comprime imagem no navegador para otimizar armazenamento em nuvem/local
 * @param {File} file
 * @param {number} maxSize
 * @param {number} quality
 * @returns {Promise<{dataUrl: string, sizeKB: number, width: number, height: number}>}
 */
export function compressImageFile(file, maxSize = 800, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width >= height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const approxBytes = Math.round((dataUrl.length * 3) / 4);
        resolve({
          dataUrl,
          sizeKB: Math.max(1, Math.round(approxBytes / 1024)),
          width,
          height
        });
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export const DEFAULT_WHATSAPP_STAGE_TEMPLATES = {
  upcoming: 'Olá, {cliente}! Tudo bem? Passando para lembrar com antecedência que sua parcela nº {parcela_num} no valor de {valor_parcela} vence em {data_vencimento}.\n\nChave PIX: {chave_pix}\nFavorecido: {titular_pix}\n\nQualquer dúvida estou à disposição!',
  dueToday: 'Olá, {cliente}! Lembramos que sua parcela nº {parcela_num} no valor de {valor_parcela} vence hoje ({data_vencimento}).\n\nPara facilitar o pagamento via PIX da {empresa}:\nChave PIX: {chave_pix}\nFavorecido: {titular_pix}\n\nApós o pagamento, envie o comprovante por aqui. Obrigado!',
  overdueLight: 'Olá, {cliente}! Constatamos que sua parcela nº {parcela_num} venceu em {data_vencimento} (há {dias_atraso} dia(s)). O valor atualizado para quitação hoje é {valor_parcela}.\n\nChave PIX: {chave_pix} ({titular_pix})\n\nPor gentileza, envie o comprovante após realizar a transferência.',
  overdueMedium: 'Prezado(a) {cliente}, sua parcela nº {parcela_num} encontra-se em aberto há {dias_atraso} dias (vencimento {data_vencimento}). O valor atualizado com multa e mora é {valor_parcela}.\n\nChave PIX: {chave_pix} ({titular_pix})\n\nEntre em contato hoje para quitar ou alinhar uma data de pagamento/acordo.',
  overdueCritical: 'AVISO IMPORTANTE - {empresa}\nPrezado(a) {cliente}, a parcela nº {parcela_num} está vencida há {dias_atraso} dias (desde {data_vencimento}), somando {valor_parcela} atualizados.\n\nSolicitamos contato imediato para regularização ou renegociação amigável antes da cobrança contratual / acionamento de garantia.\nChave PIX: {chave_pix}'
};

/**
 * Seleciona o estágio da régua de cobrança com base nos dias em relação ao vencimento
 */
export function getWhatsAppCollectionStage(dueDateStr, todayStr = formatDateForInput()) {
  if (!dueDateStr) return { stage: 'dueToday', daysDiff: 0 };
  const dDue = new Date(String(dueDateStr).split('T')[0] + 'T12:00:00');
  const dToday = new Date(String(todayStr).split('T')[0] + 'T12:00:00');
  const daysOverdue = Math.round((dToday.getTime() - dDue.getTime()) / (1000 * 60 * 60 * 24));

  if (daysOverdue >= 15) return { stage: 'overdueCritical', daysOverdue };
  if (daysOverdue >= 5) return { stage: 'overdueMedium', daysOverdue };
  if (daysOverdue >= 1) return { stage: 'overdueLight', daysOverdue };
  if (daysOverdue === 0) return { stage: 'dueToday', daysOverdue: 0 };
  return { stage: 'upcoming', daysOverdue };
}

/**
 * Monta mensagem personalizada por estágio da régua de cobrança
 */
export function buildWhatsAppCollectionMessage({
  clientName,
  installmentNumber,
  amount,
  dueDate,
  daysOverdue = 0,
  settings = {},
  stageOverride = null
}) {
  const templates = {
    ...DEFAULT_WHATSAPP_STAGE_TEMPLATES,
    ...(settings.whatsappTemplates || {})
  };
  if (settings.whatsappTemplate && !(settings.whatsappTemplates && settings.whatsappTemplates.dueToday)) {
    templates.dueToday = settings.whatsappTemplate;
  }

  let stage = stageOverride;
  let calcDays = Number(daysOverdue) || 0;
  if (!stage) {
    const auto = getWhatsAppCollectionStage(dueDate);
    stage = auto.stage;
    calcDays = auto.daysOverdue;
  }

  const rawTemplate = templates[stage] || templates.dueToday;
  const formattedDue = String(dueDate || '').includes('/') ? dueDate : formatDate(dueDate);
  const formattedVal = typeof amount === 'string' && amount.includes('R$') ? amount : formatBRL(amount);

  return rawTemplate
    .replace(/\{cliente\}/g, clientName || 'Cliente')
    .replace(/\{parcela_num\}/g, String(installmentNumber || '1'))
    .replace(/\{valor_parcela\}/g, formattedVal)
    .replace(/\{data_vencimento\}/g, formattedDue)
    .replace(/\{dias_atraso\}/g, String(Math.max(0, calcDays)))
    .replace(/\{chave_pix\}/g, settings.pixKey || '')
    .replace(/\{titular_pix\}/g, settings.pixHolder || settings.businessName || '')
    .replace(/\{empresa\}/g, settings.businessName || 'Vando motos locadora LTDA');
}


