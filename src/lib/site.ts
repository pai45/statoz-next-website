// The publication build supplies its own origin and repository path.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.statoz.in").replace(/\/$/, '');

export const SITE_NAME = "StatOz";
