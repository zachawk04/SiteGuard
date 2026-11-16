// src/scan/trustedSites.ts
//
// Established, widely used websites skip the AI check and are reported as
// well-known. A small on-device model reading a big store or news site will
// sometimes mistake ordinary deals, countdowns, or headlines for scam
// signs, and a false warning on amazon.com teaches users to ignore the
// scanner.
//
// Trust covers a site's own domain and its subdomains, in addition to every
// official domain in the brand table (brands.ts).
//
// EXCEPTION: domains where anyone can publish pages. Phishers deliberately
// host pages on Google Sites, Google Forms, SharePoint, GitHub Pages and
// similar services because the address looks trustworthy. Those hosts are
// never auto-trusted and always get the full AI check.
import { officialDomainForHost, registrableDomain } from "./brands";

const POPULAR_SITES = [
  // Search, reference, email
  "bing.com", "duckduckgo.com", "wikipedia.org", "wikimedia.org", "wiktionary.org",
  "britannica.com", "merriam-webster.com", "dictionary.com", "proton.me", "protonmail.com",

  // News and weather
  "nytimes.com", "washingtonpost.com", "wsj.com", "cnn.com", "foxnews.com", "nbcnews.com",
  "abcnews.go.com", "cbsnews.com", "npr.org", "pbs.org", "bbc.com", "bbc.co.uk",
  "reuters.com", "apnews.com", "bloomberg.com", "theguardian.com", "usatoday.com",
  "cnbc.com", "politico.com", "axios.com", "theverge.com", "wired.com", "arstechnica.com",
  "techcrunch.com", "espn.com", "weather.com", "accuweather.com", "toledoblade.com",

  // Social and community
  "reddit.com", "tiktok.com", "pinterest.com", "discord.com", "twitch.tv", "quora.com",
  "stackoverflow.com", "stackexchange.com", "snapchat.com", "threads.net", "bsky.app",

  // Shopping, food, travel
  "lowes.com", "etsy.com", "wayfair.com", "ikea.com", "kohls.com", "macys.com",
  "nordstrom.com", "gap.com", "oldnavy.com", "nike.com", "adidas.com", "samsung.com",
  "dell.com", "hp.com", "lenovo.com", "newegg.com", "chewy.com", "cvs.com", "walgreens.com",
  "kroger.com", "instacart.com", "doordash.com", "ubereats.com", "uber.com", "lyft.com",
  "airbnb.com", "booking.com", "expedia.com", "tripadvisor.com", "kayak.com",
  "southwest.com", "delta.com", "united.com", "aa.com", "ticketmaster.com",

  // Tech, work, AI
  "github.com", "gitlab.com", "npmjs.com", "python.org", "mozilla.org", "cloudflare.com",
  "openai.com", "chatgpt.com", "anthropic.com", "claude.ai", "zoom.us", "slack.com",
  "notion.so", "atlassian.com", "trello.com", "canva.com", "figma.com", "salesforce.com",
  "hubspot.com", "oracle.com", "ibm.com", "intel.com", "nvidia.com", "amd.com",
  "wordpress.org", "w3schools.com",

  // Money
  "fidelity.com", "schwab.com", "vanguard.com", "robinhood.com", "intuit.com",
  "creditkarma.com", "experian.com", "equifax.com", "transunion.com", "visa.com",
  "mastercard.com", "stripe.com", "sofi.com", "ally.com",

  // Streaming and games
  "hulu.com", "disneyplus.com", "max.com", "peacocktv.com", "paramountplus.com",
  "pandora.com", "imdb.com", "crunchyroll.com", "epicgames.com", "minecraft.net",
  "playstation.com", "nintendo.com", "ea.com",

  // Health
  "webmd.com", "mayoclinic.org", "clevelandclinic.org", "kp.org",

  // Jobs and school
  "indeed.com", "glassdoor.com", "joinhandshake.com", "coursera.org", "khanacademy.org",
  "edx.org", "quizlet.com", "chegg.com", "instructure.com", "blackboard.com", "duolingo.com",
];

// Hosts where anyone can publish a page. Matched as the host itself or any
// subdomain of it. These are checked first and always win.
const USER_CONTENT_HOSTS = [
  // Google
  "sites.google.com", "docs.google.com", "drive.google.com", "script.google.com",
  "forms.gle", "googleusercontent.com", "storage.googleapis.com", "firebaseapp.com",
  "web.app", "appspot.com", "blogspot.com", "translate.goog",
  // Microsoft
  "sharepoint.com", "onedrive.live.com", "1drv.ms", "forms.office.com",
  "forms.microsoft.com", "azurewebsites.net", "blob.core.windows.net", "azureedge.net",
  // Amazon
  "amazonaws.com", "cloudfront.net", "amplifyapp.com",
  // Code and app hosting
  "github.io", "githubusercontent.com", "gist.github.com", "gitlab.io", "pages.dev",
  "workers.dev", "netlify.app", "vercel.app", "herokuapp.com", "glitch.me", "replit.app",
  "repl.co", "onrender.com", "fly.dev", "ngrok.io", "ngrok-free.app", "trycloudflare.com",
  // Site builders and publishing
  "wixsite.com", "weebly.com", "wordpress.com", "square.site", "webflow.io", "notion.site",
  "carrd.co", "godaddysites.com", "myshopify.com", "framer.website", "canva.site",
  "jimdosite.com", "mystrikingly.com", "webnode.page", "000webhostapp.com", "tumblr.com",
  "medium.com", "substack.com",
  // Forms and file sharing
  "surveymonkey.com", "typeform.com", "jotform.com", "dropboxusercontent.com",
  "ipfs.io", "linktr.ee",
  // Link shorteners
  "bit.ly", "tinyurl.com", "t.co", "rebrand.ly", "is.gd", "cutt.ly",
];

const hostMatches = (host: string, domain: string) =>
  host === domain || host.endsWith("." + domain);

/** True if anyone can publish pages at this host. */
export function isUserContentHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return USER_CONTENT_HOSTS.some((d) => hostMatches(host, d));
}

/**
 * If this hostname belongs to a well-known site, return that site's domain
 * (for display). Returns null for anything else, including user-content
 * hosts on famous domains.
 */
export function wellKnownSiteFor(hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || isUserContentHost(host)) return null;

  // U.S. government and military domains can only be registered by
  // government bodies.
  if (/\.(gov|mil)$/.test(host)) return registrableDomain(host);

  const popular = POPULAR_SITES.find((d) => hostMatches(host, d));
  if (popular) return popular;

  return officialDomainForHost(host);
}
