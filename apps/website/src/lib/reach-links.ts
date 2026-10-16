const DEFAULT_REACH_ORIGIN = "https://getlodgecore.vercel.app";

export function reachShareUrl(code: string, origin = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_REACH_ORIGIN) {
  return `${origin}/r/${encodeURIComponent(code)}`;
}
