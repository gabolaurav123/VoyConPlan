import { AuthForm } from '@/components/auth-form';
export const metadata = {
  title: 'Crear cuenta · VoyConPlan',
  robots: { index: false, follow: false },
};
export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
