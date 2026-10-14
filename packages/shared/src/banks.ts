export interface BankInfo {
  code: string;
  name: string;
}

export const NIGERIAN_BANKS: readonly BankInfo[] = [
  { code: "044", name: "Access Bank" },
  { code: "058", name: "Guaranty Trust Bank (GTBank)" },
  { code: "057", name: "Zenith Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "033", name: "United Bank for Africa (UBA)" },
  { code: "50211", name: "Kuda Bank" },
  { code: "999992", name: "OPay" },
  { code: "999991", name: "PalmPay" },
  { code: "50515", name: "Moniepoint MFB" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "070", name: "Fidelity Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank (FCMB)" },
  { code: "035", name: "Wema Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "215", name: "Unity Bank" },
  { code: "301", name: "Jaiz Bank" },
  { code: "100", name: "Suntrust Bank" },
  { code: "102", name: "Titan Trust Bank" },
  { code: "103", name: "Globus Bank" },
  { code: "107", name: "Optimus Bank" },
  { code: "108", name: "Signature Bank" },
  { code: "50587", name: "FairMoney Microfinance Bank" },
  { code: "50383", name: "Nomba (Kredi MFB)" },
] as const;

export function getBankName(bankCode: string | null | undefined): string | null {
  if (!bankCode) return null;
  const found = NIGERIAN_BANKS.find((b) => b.code === bankCode);
  return found ? found.name : null;
}
