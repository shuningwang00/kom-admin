export const BUSINESS = {
  name: "Knockout Math",
  email: "contact@knockoutmath.sg",
  phone: "+65 8476 0600",
  addressLines: [
    "144 Upper Bukit Timah Road,",
    "#03-38, Beauty World Centre,",
    "Singapore 588177",
  ],
  website: "https://www.knockoutmath.sg",
  uen: process.env.KOM_UEN ?? "202515997H",
} as const;

export const PAYMENT = {
  paynowUen: process.env.KOM_PAYNOW_UEN ?? "202515997H",
  bank: {
    name: "United Overseas Bank (UOB)",
    swift: "UOVBSGSG",
    accountType: "Current Account",
    branch: "UOB Main",
    accountName: "KNOCKOUT LEARNING CENTRE PTE. LTD.",
    accountNumber: "761-308-201-1",
  },
} as const;

export function getDefaultRatePerSession(): number {
  const raw = process.env.DEFAULT_RATE_PER_SESSION ?? "80";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 80;
}

/** When set, middleware requires a Google session cookie before app routes. */
export function getAdminPassword(): string | undefined {
  const p = process.env.BILLING_ADMIN_PASSWORD?.trim();
  return p || undefined;
}
