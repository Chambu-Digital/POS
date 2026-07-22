'use client'
// Old service/bar canonical — redirects to Bar POS.
import { redirect } from 'next/navigation'
export default function OldServiceBarRoute() { redirect('/dashboard/bar/pos') }
