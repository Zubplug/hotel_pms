type VercelDomainResult = { attached: boolean; configured: boolean };

/** Attach a verified hostname to the deployed website project.
 * Missing Vercel credentials is deliberately non-fatal: DNS verification can
 * complete first, and HQ can attach the hostname after configuring the project.
 */
export async function attachVercelDomain(domain: string): Promise<VercelDomainResult> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return { attached: false, configured: false };

  const url = new URL(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/domains`);
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set("teamId", process.env.VERCEL_TEAM_ID);
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: domain }),
    cache: "no-store",
  });
  if (response.ok || response.status === 409) return { attached: true, configured: true };
  const detail = await response.text().catch(() => "");
  throw new Error(`Vercel domain attachment failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
}
