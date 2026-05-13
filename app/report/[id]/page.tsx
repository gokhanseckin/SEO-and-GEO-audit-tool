export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Report {id}</h1>
      <p className="text-gray-500">Progressive report renders here in Phase C.</p>
    </main>
  );
}
