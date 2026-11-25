import { NextResponse } from 'next/server';

const githubRepo = 'Zubplug/hotel_pms';

function isAllowedDesktopFile(fileName: string) {
  return (
    fileName === 'LodgeCore.appinstaller' ||
    /^LodgeCore\.Desktop_\d+\.\d+\.\d+\.\d+_x86\.msix$/.test(fileName) ||
    fileName === 'Microsoft.WindowsAppRuntime.1.7.msix'
  );
}

async function proxyDesktopUpdate(fileName: string, method: 'GET' | 'HEAD') {
  // Do not turn this route into an arbitrary GitHub release proxy. Apart from
  // being safer, an allow-list guarantees that App Installer only receives
  // files whose identities and MIME types are part of our release contract.
  if (!isAllowedDesktopFile(fileName)) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const githubUrl = `https://github.com/${githubRepo}/releases/latest/download/${encodeURIComponent(fileName)}`;

  const upstream = await fetch(githubUrl, {
    method,
    headers: { Accept: '*/*' },
    redirect: 'follow',
    cache: 'no-store',
  });

  if (!upstream.ok) {
    return new NextResponse(`Upstream error: ${upstream.status} ${upstream.statusText}`, {
      status: upstream.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const isAppInstaller = fileName.toLowerCase().endsWith('.appinstaller');
  const contentLength = upstream.headers.get('content-length');
  const responseHeaders = new Headers({
    'Content-Type': isAppInstaller ? 'application/appinstaller' : 'application/msix',
    // App Installer is a document handler. Serving the XML inline avoids
    // Windows treating the downloaded response as a generic app package.
    ...(isAppInstaller
      ? {}
      : { 'Content-Disposition': `attachment; filename="${fileName.replace(/"/g, '')}"` }),
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
  });
  if (contentLength) {
    responseHeaders.set('Content-Length', contentLength);
  }

  return new NextResponse(method === 'HEAD' ? null : upstream.body, {
    status: 200,
    headers: responseHeaders,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ file: string[] }> }
) {
  const resolvedParams = await params;
  if (!resolvedParams.file || resolvedParams.file.length === 0) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const fileName = resolvedParams.file[resolvedParams.file.length - 1];
  return proxyDesktopUpdate(fileName, 'GET');
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ file: string[] }> }
) {
  const resolvedParams = await params;
  if (!resolvedParams.file || resolvedParams.file.length === 0) {
    return new NextResponse(null, { status: 400 });
  }

  const fileName = resolvedParams.file[resolvedParams.file.length - 1];
  return proxyDesktopUpdate(fileName, 'HEAD');
}
