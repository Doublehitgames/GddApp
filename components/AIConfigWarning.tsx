"use client";

import Link from "next/link";

interface AIConfigWarningProps {
  className?: string;
}

export default function AIConfigWarning({ className = "" }: AIConfigWarningProps) {
  return (
    <div className={`bg-yellow-900/30 border border-yellow-700 rounded-lg p-6 text-center ${className}`}>
      <div className="text-5xl mb-4">⚠️</div>
      <h3 className="text-xl font-bold text-yellow-300 mb-2">
        Configuração de IA Necessária
      </h3>
      <p className="text-gray-300 mb-4">
        Para usar este recurso, você precisa configurar sua própria API key de IA.
      </p>
      <Link
        href="/settings/ai"
        className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
      >
        Configurar API Key
      </Link>
      <div className="mt-4 text-sm text-gray-400">
        <p>Recomendamos usar Groq (gratuito)</p>
        <p>Leva apenas 2 minutos para configurar!</p>
      </div>
    </div>
  );
}
