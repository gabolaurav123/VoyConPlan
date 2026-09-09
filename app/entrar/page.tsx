import { AuthForm } from '@/components/auth-form';
export const metadata = {
  title: 'Iniciar sesión · VoyConPlan',
  robots: { index: false, follow: false },
};
export default function LoginPage() {
  return <AuthForm mode="login" />;
}
