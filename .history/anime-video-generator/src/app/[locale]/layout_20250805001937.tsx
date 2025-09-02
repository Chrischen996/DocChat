import { redirect } from 'next/navigation';

// This layout redirects to root since we don't use locale routing anymore
export default function LocaleLayout() {
  redirect('/');
}
