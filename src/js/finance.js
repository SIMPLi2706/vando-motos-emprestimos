// src/js/finance.js
// Motor de Cálculo Financeiro: Tabela Price, SAC, Juros Simples, Só Juros e Encargos de Atraso

/**
 * Gera o cronograma de parcelas com base nos parâmetros do empréstimo.
 * 
 * @param {Object} params
 * @param {number} params.principal - Valor do empréstimo (PV)
 * @param {number} params.interestRate - Taxa de juros percentual (ex: 10 para 10%)
 * @param {string} params.interestType - 'price', 'sac', 'simple', 'interest_only'
 * @param {string} params.periodicity - 'daily', 'weekly', 'biweekly', 'monthly'
 * @param {number} params.installmentsCount - Número de parcelas (n)
 * @param {string} params.startDate - Data de início/liberação (YYYY-MM-DD)
 * @param {number} params.firstPaymentDays - Dias até a primeira parcela (carência)
 */
export function calculateAmortizationSchedule(params) {
  const PV = Number(params.principal) || 0;
  const n = parseInt(params.installmentsCount, 10) || 1;
  const ratePct = Number(params.interestRate) || 0;
  const i = ratePct / 100;
  const type = params.interestType || 'price';
  const periodicity = params.periodicity || 'monthly';
  const startDate = new Date(params.startDate || new Date());
  const graceDays = parseInt(params.firstPaymentDays, 10) || 0;

  let schedule = [];
  let totalInterest = 0;
  let totalPayable = 0;

  // Função auxiliar para calcular data de cada parcela
  function getDueDate(index) {
    const d = new Date(startDate);
    
    // Se houver carência específica na primeira parcela
    if (index === 1 && graceDays > 0) {
      d.setDate(d.getDate() + graceDays);
      return d.toISOString().split('T')[0];
    }

    if (periodicity === 'daily') {
      d.setDate(d.getDate() + (graceDays > 0 ? graceDays + (index - 1) : index));
    } else if (periodicity === 'weekly') {
      d.setDate(d.getDate() + (graceDays > 0 ? graceDays + (index - 1) * 7 : index * 7));
    } else if (periodicity === 'biweekly') {
      d.setDate(d.getDate() + (graceDays > 0 ? graceDays + (index - 1) * 15 : index * 15));
    } else { // monthly
      d.setMonth(d.getMonth() + index);
      if (graceDays > 0) {
        d.setDate(d.getDate() + graceDays);
      }
    }
    return d.toISOString().split('T')[0];
  }

  if (type === 'price') {
    // Tabela Price: Parcelas Iguais (PMT)
    let PMT = 0;
    if (i === 0) {
      PMT = PV / n;
    } else {
      PMT = PV * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    }

    let remainingBalance = PV;

    for (let k = 1; k <= n; k++) {
      const interest = remainingBalance * i;
      let amortization = PMT - interest;
      
      // Ajuste na última parcela para zerar resíduos de centavos
      if (k === n) {
        amortization = remainingBalance;
        PMT = amortization + interest;
      }

      remainingBalance = Math.max(0, remainingBalance - amortization);
      totalInterest += interest;
      totalPayable += PMT;

      schedule.push({
        number: k,
        dueDate: getDueDate(k),
        installmentAmount: round(PMT),
        interestAmount: round(interest),
        amortizationAmount: round(amortization),
        remainingBalance: round(remainingBalance)
      });
    }

  } else if (type === 'sac') {
    // Tabela SAC: Amortização Constante (A = PV / n)
    const constantAmortization = PV / n;
    let remainingBalance = PV;

    for (let k = 1; k <= n; k++) {
      const interest = remainingBalance * i;
      let amortization = constantAmortization;
      
      if (k === n) {
        amortization = remainingBalance;
      }
      
      const PMT = amortization + interest;
      remainingBalance = Math.max(0, remainingBalance - amortization);
      totalInterest += interest;
      totalPayable += PMT;

      schedule.push({
        number: k,
        dueDate: getDueDate(k),
        installmentAmount: round(PMT),
        interestAmount: round(interest),
        amortizationAmount: round(amortization),
        remainingBalance: round(remainingBalance)
      });
    }

  } else if (type === 'simple') {
    // Juros Simples: J = PV * i * n. Total = PV + J. Parcela = Total / n
    const interestPerPeriod = PV * i;
    const amortizationPerPeriod = PV / n;
    const PMT = amortizationPerPeriod + interestPerPeriod;
    let remainingBalance = PV;

    for (let k = 1; k <= n; k++) {
      let amortization = amortizationPerPeriod;
      if (k === n) {
        amortization = remainingBalance;
      }
      remainingBalance = Math.max(0, remainingBalance - amortization);
      totalInterest += interestPerPeriod;
      totalPayable += PMT;

      schedule.push({
        number: k,
        dueDate: getDueDate(k),
        installmentAmount: round(PMT),
        interestAmount: round(interestPerPeriod),
        amortizationAmount: round(amortization),
        remainingBalance: round(remainingBalance)
      });
    }

  } else if (type === 'interest_only') {
    // Só Juros: Durante os períodos paga-se apenas o juro. No último, devolve o principal.
    const interestPerPeriod = PV * i;

    for (let k = 1; k <= n; k++) {
      const isLast = (k === n);
      const amortization = isLast ? PV : 0;
      const PMT = interestPerPeriod + amortization;
      const remainingBalance = isLast ? 0 : PV;

      totalInterest += interestPerPeriod;
      totalPayable += PMT;

      schedule.push({
        number: k,
        dueDate: getDueDate(k),
        installmentAmount: round(PMT),
        interestAmount: round(interestPerPeriod),
        amortizationAmount: round(amortization),
        remainingBalance: round(remainingBalance)
      });
    }
  }

  return {
    principal: round(PV),
    totalInterest: round(totalInterest),
    totalPayable: round(totalPayable),
    schedule
  };
}

/**
 * Calcula encargos de atraso (Multa e Mora Diária).
 */
export function calculateLateCharges(installment, targetDate = new Date(), penaltyRate = 2, dailyInterestRate = 0.1) {
  const dueDate = new Date(installment.dueDate);
  dueDate.setHours(0, 0, 0, 0);

  const checkDate = new Date(targetDate);
  checkDate.setHours(0, 0, 0, 0);

  const diffTime = checkDate.getTime() - dueDate.getTime();
  const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  const baseAmount = Number(installment.installmentAmount) - Number(installment.paidAmount || 0);

  if (daysOverdue <= 0 || baseAmount <= 0) {
    return {
      daysOverdue: 0,
      penaltyAmount: 0,
      dailyInterestAmount: 0,
      totalLateCharges: 0,
      totalUpdatedAmount: round(baseAmount)
    };
  }

  // Multa fixa percentual (ex: 2%)
  const penaltyAmount = baseAmount * (penaltyRate / 100);

  // Mora diária (ex: 0.1% ao dia)
  const dailyInterestAmount = baseAmount * (dailyInterestRate / 100) * daysOverdue;

  const totalLateCharges = penaltyAmount + dailyInterestAmount;
  const totalUpdatedAmount = baseAmount + totalLateCharges;

  return {
    daysOverdue,
    penaltyAmount: round(penaltyAmount),
    dailyInterestAmount: round(dailyInterestAmount),
    totalLateCharges: round(totalLateCharges),
    totalUpdatedAmount: round(totalUpdatedAmount)
  };
}

function round(val) {
  return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
}
