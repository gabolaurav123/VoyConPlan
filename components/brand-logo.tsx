export default function BrandLogo({ className = '' }: { className?: string }) {
  return <img className={'brand-logo ' + className} src="/brand/logo-v2.png" alt="VoyConPlan" width={2171} height={724} />;
}
