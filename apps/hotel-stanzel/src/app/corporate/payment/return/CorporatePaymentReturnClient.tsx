'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type PaymentState = 'loading' | 'pending' | 'confirmed' | 'failed' | 'expired' | 'missing' | 'error';

export default function CorporatePaymentReturnClient() {
