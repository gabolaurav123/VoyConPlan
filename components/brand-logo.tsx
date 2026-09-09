export default function BrandLogo({ className = '' }: { className?: string }) {
  return <img className={'brand-logo ' + className} src="/brand/logo.png" alt="VoyConPlan" width={2172} height={724} />;
}
