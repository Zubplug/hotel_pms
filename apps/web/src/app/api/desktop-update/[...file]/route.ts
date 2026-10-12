import { NextResponse } from 'next/server';

const githubRepo = 'Zubplug/hotel_pms';

async function proxyDesktopUpdate(fileName: string, method: 'GET' | 'HEAD') {
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
  return new NextResponse(method === 'HEAD' ? null : upstream.body, {
    status: 200,
    headers: {
      'Content-Type': isAppInstaller ? 'application/appinstaller' : 'application/msix',
      'Content-Disposition': `attachment; filename="${fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
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
