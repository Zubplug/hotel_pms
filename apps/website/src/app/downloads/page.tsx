import type { Metadata } from "next";
import Link from "next/link";

const githubReleaseApi = "https://api.github.com/repos/Zubplug/hotel_pms/releases/latest";

type ReleaseAsset = { name: string; browser_download_url: string; digest?: string | null };
type GithubRelease = { tag_name: string; html_url: string; published_at: string; assets: ReleaseAsset[] };
type DownloadRelease = {
  version: string;
  appVersion: string;
  tag: string;
  releasedAt: string;
  msix: string;
  runtime: string;
  releaseNotes: string;
  checksum: string;
};

const fallbackRelease: DownloadRelease = {
  version: "1.2.59",
  appVersion: "1.2.59.0",
  tag: "v1.2.59",
  releasedAt: "November 28, 2026",
  msix: "https://github.com/Zubplug/hotel_pms/releases/download/v1.2.59/LodgeCore.Desktop_1.2.59.0_x86.msix",
  runtime: "https://github.com/Zubplug/hotel_pms/releases/download/v1.2.59/Microsoft.WindowsAppRuntime.1.7.msix",
  releaseNotes: "https://github.com/Zubplug/hotel_pms/releases/tag/v1.2.59",
  checksum: "4cf1ff64909e78a31d5a0800f2a232a5a7c7dcd5f60a821bc96136f063671b26",
};

async function getLatestRelease(): Promise<DownloadRelease> {
  try {
    const response = await fetch(githubReleaseApi, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const latest = (await response.json()) as GithubRelease;
    const msix = latest.assets.find((asset) => asset.name.toLowerCase().endsWith(".msix") && !asset.name.toLowerCase().includes("windowsappruntime"));
    const runtime = latest.assets.find((asset) => asset.name.toLowerCase().includes("windowsappruntime") && asset.name.toLowerCase().endsWith(".msix"));
    if (!msix || !runtime) throw new Error("The latest release is missing a required Windows asset");
    const version = latest.tag_name.replace(/^v/i, "");
    return {
      version,
      appVersion: msix.name.match(/_(\d+\.\d+\.\d+\.\d+)_/)?.[1] || `${version}.0`,
      tag: latest.tag_name,
      releasedAt: new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(latest.published_at)),
      msix: msix.browser_download_url,
      runtime: runtime.browser_download_url,
      releaseNotes: latest.html_url,
      checksum: msix.digest?.replace(/^sha256:/i, "") || "Checksum published on the GitHub release page",
    };
  } catch (error) {
    console.warn("[Downloads] GitHub latest release unavailable; using fallback.", error);
    return fallbackRelease;
  }
}

export const metadata: Metadata = {
  title: "LodgeCore Desktop downloads",
  description: "Download the latest LodgeCore Desktop MSIX package for Windows.",
};

export default async function DownloadsPage() {
  const release = await getLatestRelease();

  return (
    <main className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="LodgeCore home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300 font-black text-slate-950">L</span>
            <span><strong className="block text-base text-white">LodgeCore</strong><small className="block text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-300">Desktop PMS</small></span>
          </Link>
          <a href={release.releaseNotes} target="_blank" rel="noreferrer" className="text-sm text-slate-400 hover:text-white">Release notes ↗</a>
        </header>

        <section className="mx-auto max-w-3xl py-20 text-center sm:py-28">
          <p className="mx-auto mb-6 w-fit rounded-full border border-cyan-300/20 bg-cyan-300/[.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[.16em] text-cyan-200">✓ Latest stable release</p>
          <h1 className="text-4xl font-semibold tracking-[-.05em] text-white sm:text-6xl">LodgeCore Desktop {release.version}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">Download the latest LodgeCore Desktop package for a controlled manual update on your Windows terminal.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href={release.msix} className="rounded-xl bg-cyan-300 px-5 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-300/15 hover:bg-cyan-200">↓ Download Desktop MSIX</a>
            <a href={release.releaseNotes} target="_blank" rel="noreferrer" className="rounded-xl border border-white/15 bg-white/[.05] px-5 py-3.5 text-sm font-semibold text-white hover:bg-white/[.1]">View release details ↗</a>
          </div>
          <p className="mt-4 text-xs text-slate-500">Windows Desktop MSIX · Released {release.releasedAt}</p>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[.045] p-6 shadow-2xl sm:p-8">
            <h2 className="text-xl font-semibold text-white">Manual update</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Use this when automatic updating is unavailable or when a terminal needs an immediate controlled update.</p>
            <ol className="mt-7 space-y-5 text-sm text-slate-300">
              <li className="flex gap-3"><b className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-xs text-slate-950">1</b><span>Close LodgeCore Desktop.</span></li>
              <li className="flex gap-3"><b className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-xs text-slate-950">2</b><span>Open <strong className="text-white">Download Desktop MSIX</strong> and accept the Windows certificate prompt if shown.</span></li>
              <li className="flex gap-3"><b className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300 text-xs text-slate-950">3</b><span>Install the package, reopen LodgeCore, and let synchronization finish before operating.</span></li>
            </ol>
            <p className="mt-7 rounded-2xl border border-amber-300/15 bg-amber-300/[.06] p-4 text-xs leading-5 text-amber-100/80">Windows may ask you to trust the LodgeCore signing certificate the first time you install.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-white">Other downloads</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">The Windows App Runtime is required if it is not already installed on the terminal.</p>
            <div className="mt-6 space-y-3">
              <a href={release.msix} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.04] p-4 text-sm hover:border-cyan-300/30"><span><strong className="block text-white">MSIX package</strong><small className="text-xs text-slate-500">Windows x86</small></span>↓</a>
              <a href={release.runtime} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.04] p-4 text-sm hover:border-cyan-300/30"><span><strong className="block text-white">Windows App Runtime</strong><small className="text-xs text-slate-500">Required dependency</small></span>↓</a>
            </div>
            <div className="mt-7 border-t border-white/10 pt-5"><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Desktop MSIX SHA-256</p><code className="mt-3 block break-all rounded-xl bg-black/20 p-3 text-[11px] leading-5 text-slate-400">{release.checksum}</code></div>
          </div>
        </section>
        <footer className="py-10 text-center text-xs text-slate-500"><p>LodgeCore Desktop {release.appVersion} · {release.tag}</p><a href="https://github.com/Zubplug/hotel_pms/releases" target="_blank" rel="noreferrer" className="mt-2 inline-block hover:text-slate-300">Browse all releases</a></footer>
      </div>
    </main>
  );
}
