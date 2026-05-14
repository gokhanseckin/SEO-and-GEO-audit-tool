import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const sb = await createClient();
  const { data: audits } = await sb
    .from('audits')
    .select('id, user_id, domain, status, error, created_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold mb-4">Recent audits</h1>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2">Domain</th>
              <th>Status</th>
              <th>Created</th>
              <th>Error</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(audits ?? []).map((a) => (
              <tr key={a.id} className="border-t">
                <td className="py-2">{a.domain}</td>
                <td>{a.status}</td>
                <td>{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</td>
                <td className="text-red-600">{a.error ?? ''}</td>
                <td><Link href={`/report/${a.id}`}>open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
