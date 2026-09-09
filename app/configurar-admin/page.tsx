import { AuthForm } from '@/components/auth-form';
export const metadata = {
  title: 'Configurar administración · VoyConPlan',
  robots: { index: false, follow: false },
};
export default function SetupAdminPage() {
  return <AuthForm mode="setup" />;
}
