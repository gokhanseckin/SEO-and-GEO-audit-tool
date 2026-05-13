export default function AuthErrorPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">Sign-in failed</h1>
        <p className="text-gray-600">Please try again.</p>
        <a href="/" className="mt-4 inline-block underline">Back to home</a>
      </div>
    </main>
  );
}
