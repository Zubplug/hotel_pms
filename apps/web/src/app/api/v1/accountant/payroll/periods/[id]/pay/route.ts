import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    return NextResponse.json(
      { error: 'Payroll settlement is owned by the HR payroll workflow. Accountant is read-only control and reconciliation.' },
      { status: 409 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to pay payroll';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
