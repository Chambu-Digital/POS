'use client'
// Old Bar Tabs landing — redirects to Bar POS.
import { redirect } from 'next/navigation'
export default function OldBarRoute() { redirect('/dashboard/bar/pos') }
