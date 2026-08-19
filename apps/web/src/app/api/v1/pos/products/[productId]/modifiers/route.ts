import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;

    const modifiers = await prisma.posProductModifier.findMany({
      where: { productId, isActive: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ data: modifiers, error: null });
  } catch (err: any) {
    return NextResponse.json({ data: [], error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const body = await req.json();

    const modifier = await prisma.posProductModifier.create({
      data: {
        productId,
        name: body.name,
        price: body.price ?? 0,
        isActive: true,
      },
    });

    return NextResponse.json({ data: modifier, error: null }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}
