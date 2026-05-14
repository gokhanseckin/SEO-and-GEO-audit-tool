import { requireAdmin } from '@/lib/admin/guard';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <div className="admin-shell p-6">{children}</div>;
}
