export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-6">GDD App</h1>
      <p className="mb-8 text-lg text-gray-300">
        Gerencie seus Game Design Documents de forma inteligente.
      </p>

      <button className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700">
        Criar novo projeto
      </button>
    </main>
  );
}