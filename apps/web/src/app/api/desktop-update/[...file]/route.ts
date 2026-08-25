import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ file: string[] }> }
) {
  const resolvedParams = await params;
  if (!resolvedParams.file || resolvedParams.file.length === 0) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const fileName = resolvedParams.file[resolvedParams.file.length - 1];
  const githubRepo = 'Zubplug/hotel_pms';
  const githubUrl = `https://github.com/${githubRepo}/releases/latest/download/${fileName}`;

  // Stream the file content directly instead of redirecting.
  // Windows App Installer resolves all child URIs inside the .appinstaller relative
  // to the declared <AppInstaller Uri="...">, so a 302 redirect would break that
  // resolution and some App Installer versions refuse to follow redirects entirely.
  const upstream = await fetch(githubUrl, {
    headers: { 'Accept': '*/*' },
    redirect: 'follow',
  });

  if (!upstream.ok) {
    return new NextResponse(`Upstream error: ${upstream.status} ${upstream.statusText}`, {
      status: upstream.status,
    });
  }

  // Determine the correct Content-Type for the file
  const isAppInstaller = fileName.endsWith('.appinstaller');
  const contentType = isAppInstaller
    ? 'application/appinstaller'
    : 'application/msix';

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
