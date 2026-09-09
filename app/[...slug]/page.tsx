import Workspace from '@/components/workspace';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  return <Workspace path={'/' + slug.join('/')} />;
}
