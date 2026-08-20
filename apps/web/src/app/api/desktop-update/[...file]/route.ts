import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ file: string[] }> }
) {
  const resolvedParams = await params;
  if (!resolvedParams.file || resolvedParams.file.length === 0) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  // Extract the actual filename being requested (e.g., LodgeCore.Desktop.appinstaller or .msix)
  const fileName = resolvedParams.file[resolvedParams.file.length - 1];

  // The GitHub repository where releases are hosted
  const githubRepo = 'Zubplug/hotel_pms';
  
  // Construct the GitHub Releases latest download URL
  const githubUrl = `https://github.com/${githubRepo}/releases/latest/download/${fileName}`;

  // Redirect the Windows App Installer to the GitHub URL
  return NextResponse.redirect(githubUrl, {
    status: 302, // Temporary redirect because 'latest' points to different files over time
  });
}
