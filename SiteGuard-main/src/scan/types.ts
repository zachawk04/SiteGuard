// src/scan/types.ts

/** Kinds of form field the extractor recognizes. */
export type FieldKind =
  | "password"
  | "username"
  | "card"
  | "cvv"
  | "expiry"
  | "otp"
  | "ssn";

export type FormInfo = {
  kinds: FieldKind[];
  /** Hostname the form submits to, or null when it submits to this page. */
  actionHost: string | null;
  actionIsHttp: boolean;
  /** Visible text inside the form (labels, headings, button text). */
  text: string;
};

export type DownloadLink = { label: string; file: string };

/** Everything collected from one frame of the page. */
export type FrameData = {
  url: string;
  hostname: string;
  protocol: string;
  /** Chrome's own judgment: true for HTTPS and for localhost. */
  secureContext: boolean;
  isTopFrame: boolean;
  width: number;
  height: number;

  title: string;
  metaDescription: string;
  siteName: string;
  ogTitle: string;
  copyright: string[];
  logoHints: string[];

  headings: string[];
  controls: string[];
  overlays: string[];
  forms: FormInfo[];
  downloads: DownloadLink[];
  phones: string[];
  wallets: string[];
  hasContactLink: boolean;
  hasReturnsLink: boolean;
  linkCount: number;

  /** Visible text in reading order, capped. */
  text: string;
};

export type FindingCategory =
  | "brand_impersonation"
  | "insecure_form"
  | "tech_support_scam"
  | "fake_captcha"
  | "fake_update_download"
  | "credential_pressure"
  | "payment_demand"
  | "fake_store"
  | "investment_crypto_scam"
  | "prize_scam"
  | "instructions_to_ai";

export type Severity = "low" | "medium" | "high";

export type Finding = {
  category: FindingCategory;
  severity: Severity;
  explanation: string;
  /** Exact quote from the page, when the finding came from the AI. */
  evidence?: string;
  /** "ai" = from the model; "page" = from Sentinel's own checks. */
  source: "ai" | "page";
};

export type BrandCheck =
  | { status: "official"; brand: string; domain: string }
  | { status: "mismatch"; brand: string; officialDomains: string[] }
  | { status: "unverified"; brand: string }
  | { status: "none" };

export type Verdict = "clear" | "caution" | "danger";

export type ScanResult = {
  url: string;
  hostname: string;
  scannedAt: number;
  durationMs: number;
  verdict: Verdict;
  /** Set when the page is on a well-known site and the AI check was skipped. */
  wellKnown?: string;
  brand: BrandCheck;
  findings: Finding[];
  /** AI findings dropped because their quote wasn't on the page. */
  droppedFindings: number;
};

export type ScanStage = "reading" | "identity" | "patterns";
