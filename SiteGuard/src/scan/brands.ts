// src/scan/brands.ts
//
// Commonly impersonated brands and the domains they really use. The AI
// only names the brand a page claims to be; this table decides whether the
// page is actually on that brand's website. A small model's guess at
// official domains isn't reliable, a lookup table is.
//
// `countrySites: true` also accepts the brand's name on any country domain
// (google.it, amazon.co.uk, ebay.de) so local sites aren't flagged.

type Brand = {
  name: string;
  aliases: string[];
  domains: string[];
  countrySites?: boolean;
};

const BRANDS: Brand[] = [
  // Tech and accounts
  { name: "Microsoft", aliases: ["microsoft", "outlook", "hotmail", "office 365", "microsoft 365", "onedrive", "sharepoint", "teams", "windows", "xbox", "skype", "bing"],
    domains: ["microsoft.com", "live.com", "outlook.com", "office.com", "microsoftonline.com", "microsoft365.com", "office365.com", "onedrive.com", "sharepoint.com", "xbox.com", "skype.com", "bing.com", "windows.com", "msn.com"] },
  { name: "Google", aliases: ["google", "gmail", "youtube", "google drive", "google docs"],
    domains: ["google.com", "gmail.com", "youtube.com", "g.co"], countrySites: true },
  { name: "Apple", aliases: ["apple", "icloud", "apple id", "itunes", "app store"],
    domains: ["apple.com", "icloud.com", "me.com"] },
  { name: "Amazon", aliases: ["amazon", "aws", "prime video", "amazon prime"],
    domains: ["amazon.com", "primevideo.com", "aws.amazon.com"], countrySites: true },
  { name: "Meta", aliases: ["facebook", "meta", "messenger"], domains: ["facebook.com", "meta.com", "fb.com", "messenger.com"] },
  { name: "Instagram", aliases: ["instagram"], domains: ["instagram.com"] },
  { name: "WhatsApp", aliases: ["whatsapp"], domains: ["whatsapp.com"] },
  { name: "LinkedIn", aliases: ["linkedin"], domains: ["linkedin.com"] },
  { name: "X (Twitter)", aliases: ["twitter", "x"], domains: ["x.com", "twitter.com"] },
  { name: "Yahoo", aliases: ["yahoo"], domains: ["yahoo.com"], countrySites: true },
  { name: "AOL", aliases: ["aol"], domains: ["aol.com"] },
  { name: "Netflix", aliases: ["netflix"], domains: ["netflix.com"] },
  { name: "Spotify", aliases: ["spotify"], domains: ["spotify.com"] },
  { name: "Dropbox", aliases: ["dropbox"], domains: ["dropbox.com"] },
  { name: "Adobe", aliases: ["adobe", "acrobat"], domains: ["adobe.com"] },
  { name: "DocuSign", aliases: ["docusign"], domains: ["docusign.com", "docusign.net"] },
  { name: "Steam", aliases: ["steam", "valve"], domains: ["steampowered.com", "steamcommunity.com"] },
  { name: "Roblox", aliases: ["roblox"], domains: ["roblox.com"] },
  { name: "Norton", aliases: ["norton"], domains: ["norton.com"] },
  { name: "McAfee", aliases: ["mcafee"], domains: ["mcafee.com"] },
  { name: "Geek Squad", aliases: ["geek squad"], domains: ["geeksquad.com", "bestbuy.com"] },

  // Payments, banks, crypto
  { name: "PayPal", aliases: ["paypal"], domains: ["paypal.com", "paypal.me"] },
  { name: "Venmo", aliases: ["venmo"], domains: ["venmo.com"] },
  { name: "Cash App", aliases: ["cash app", "cashapp"], domains: ["cash.app", "squareup.com"] },
  { name: "Zelle", aliases: ["zelle"], domains: ["zellepay.com"] },
  { name: "Chase", aliases: ["chase", "jpmorgan"], domains: ["chase.com", "jpmorganchase.com"] },
  { name: "Bank of America", aliases: ["bank of america", "bofa"], domains: ["bankofamerica.com", "bofa.com"] },
  { name: "Wells Fargo", aliases: ["wells fargo"], domains: ["wellsfargo.com", "wf.com"] },
  { name: "Citi", aliases: ["citi", "citibank"], domains: ["citi.com", "citibank.com"] },
  { name: "Capital One", aliases: ["capital one"], domains: ["capitalone.com"] },
  { name: "U.S. Bank", aliases: ["us bank", "u.s. bank"], domains: ["usbank.com"] },
  { name: "PNC", aliases: ["pnc"], domains: ["pnc.com"] },
  { name: "TD Bank", aliases: ["td bank"], domains: ["td.com", "tdbank.com"] },
  { name: "American Express", aliases: ["american express", "amex"], domains: ["americanexpress.com", "aexp.com"] },
  { name: "Discover", aliases: ["discover card", "discover bank"], domains: ["discover.com"] },
  { name: "Navy Federal", aliases: ["navy federal"], domains: ["navyfederal.org"] },
  { name: "USAA", aliases: ["usaa"], domains: ["usaa.com"] },
  { name: "Coinbase", aliases: ["coinbase"], domains: ["coinbase.com"] },
  { name: "Binance", aliases: ["binance"], domains: ["binance.com", "binance.us"] },
  { name: "MetaMask", aliases: ["metamask"], domains: ["metamask.io"] },

  // Shopping and delivery
  { name: "eBay", aliases: ["ebay"], domains: ["ebay.com"], countrySites: true },
  { name: "Walmart", aliases: ["walmart"], domains: ["walmart.com"] },
  { name: "Target", aliases: ["target"], domains: ["target.com"] },
  { name: "Best Buy", aliases: ["best buy", "bestbuy"], domains: ["bestbuy.com"] },
  { name: "Costco", aliases: ["costco"], domains: ["costco.com"] },
  { name: "The Home Depot", aliases: ["home depot"], domains: ["homedepot.com"] },
  { name: "USPS", aliases: ["usps", "postal service"], domains: ["usps.com"] },
  { name: "UPS", aliases: ["ups"], domains: ["ups.com"] },
  { name: "FedEx", aliases: ["fedex"], domains: ["fedex.com"] },
  { name: "DHL", aliases: ["dhl"], domains: ["dhl.com"], countrySites: true },

  // Phone and internet
  { name: "Verizon", aliases: ["verizon"], domains: ["verizon.com"] },
  { name: "AT&T", aliases: ["at&t", "att"], domains: ["att.com"] },
  { name: "T-Mobile", aliases: ["t-mobile", "tmobile"], domains: ["t-mobile.com"] },
  { name: "Xfinity", aliases: ["xfinity", "comcast"], domains: ["xfinity.com", "comcast.com", "comcast.net"] },

  // Government and education
  { name: "IRS", aliases: ["irs", "internal revenue service"], domains: ["irs.gov"] },
  { name: "Social Security Administration", aliases: ["social security administration", "ssa"], domains: ["ssa.gov"] },
  { name: "University of Toledo", aliases: ["university of toledo", "utoledo"], domains: ["utoledo.edu"] },
];

// Two-part public suffixes common enough to matter for country sites.
const TWO_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "co.jp", "co.in", "co.nz", "co.za", "co.kr",
  "com.au", "com.br", "com.mx", "com.tr", "com.sg", "com.ar", "com.co", "com.hk",
  "com.tw", "com.my", "com.ph", "com.sa", "com.eg", "com.be",
]);

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9&]/g, "");

/** Approximate registrable domain (eTLD+1) without a full suffix list. */
export function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/\.$/, "").split(".");
  if (labels.length <= 2) return labels.join(".");
  const lastTwo = labels.slice(-2).join(".");
  return TWO_PART_SUFFIXES.has(lastTwo)
    ? labels.slice(-3).join(".")
    : lastTwo;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Map the AI's answer to a known brand. Any alias may match the whole
 * answer ("Outlook" -> Microsoft). Only the primary name may match inside a
 * longer answer ("PayPal Holdings"), on word boundaries, so "Windows
 * Central" (a news site) isn't mistaken for Microsoft.
 */
export function findBrand(claimed: string): Brand | null {
  const lower = claimed.toLowerCase().trim();
  const claim = normalize(claimed);
  if (!claim || claim === "unknown" || claim === "none") return null;
  for (const brand of BRANDS) {
    for (const [i, alias] of brand.aliases.entries()) {
      if (claim === normalize(alias)) return brand;
      if (
        i === 0 &&
        alias.length >= 4 &&
        new RegExp(`\\b${escapeRe(alias)}\\b`).test(lower)
      ) {
        return brand;
      }
    }
  }
  return null;
}

/** Returns the official domain this hostname belongs to, or null. */
export function matchOfficialDomain(brand: Brand, hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  for (const d of brand.domains) {
    if (host === d || host.endsWith("." + d)) return d;
  }
  if (brand.countrySites) {
    const reg = registrableDomain(host);
    const [label, ...suffix] = reg.split(".");
    const tld = suffix[suffix.length - 1] ?? "";
    // Brand name as the whole domain name on a country domain: google.it
    if (brand.domains.some((d) => d.split(".")[0] === label) && tld.length === 2) {
      return reg;
    }
  }
  return null;
}

/** If this hostname is on any brand's official domain, return that domain. */
export function officialDomainForHost(hostname: string): string | null {
  for (const brand of BRANDS) {
    const match = matchOfficialDomain(brand, hostname);
    if (match) return match;
  }
  return null;
}

export type { Brand };
