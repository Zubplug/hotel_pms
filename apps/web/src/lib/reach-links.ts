const DEFAULT_REACH_ORIGIN = 'https://lodgecore.zubplug.com.ng';

/** Returns the canonical public Reach link used by both partner and staff campaigns. */
export function reachShareUrl(code: string, origin = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_REACH_ORIGIN) {
  return `${origin}/r/${encodeURIComponent(code)}`;
}
