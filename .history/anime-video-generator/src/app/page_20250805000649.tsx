import { redirect } from 'next/navigation';

// This page redirects to Chinese locale
export default function RootPage() {
  redirect('/zh');
}
