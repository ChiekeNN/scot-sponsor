/** 2026/27 Scotland, annualised employee income, standard NI category A. */
export function estimateScottishPay(gross: number) {
  const salary = Number.isFinite(gross) ? Math.max(0, gross) : 0;
  const allowance = Math.max(0, 12570 - Math.max(0, salary - 100000) / 2);
  const taxable = Math.max(0, salary - allowance);
  const bands: [number, number][] = [[3967, .19], [16956, .20], [31092, .21], [62430, .42], [125140, .45], [Infinity, .48]];
  let lower = 0, incomeTax = 0;
  for (const [upper, rate] of bands) {
    incomeTax += Math.max(0, Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  const nationalInsurance = Math.max(0, Math.min(salary, 50270) - 12570) * .08 + Math.max(0, salary - 50270) * .02;
  return { gross: salary, allowance, incomeTax, nationalInsurance, net: salary - incomeTax - nationalInsurance };
}
