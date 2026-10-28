"use client";

import Link from "next/link";

interface AIConfigWarningProps {
  className?: string;
  /** Fundo da tela onde o aviso aparece. A importação é clara; o resto, escuro. */
  tone?: "dark" | "light";
}

const TONES = {
  dark: {
    box: "bg-yellow-900/30 border-yellow-700",
    title: "text-yellow-300",
    body: "text-gray-300",
    hint: "text-gray-400",
  },
  light: {
    box: "bg-amber-50 border-amber-300",
    title: "text-amber-800",
    body: "text-gray-700",
    hint: "text-gray-500",
  },
} as const;

export default function AIConfigWarning({ className = "", tone = "dark" }: AIConfigWarningProps) {
  const t = TONES[tone];
  return (
    <div className={`${t.box} border rounded-lg p-6 text-center ${className}`}>
      <div className="text-5xl mb-4">⚠️</div>
      <h3 className={`text-xl font-bold ${t.title} mb-2`}>
        Configuração de IA Necessária
      </h3>
      <p className={`${t.body} mb-4`}>
        Para usar este recurso, você precisa configurar sua própria API key de IA.
      </p>
      <Link
        href="/settings/ai"
        className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
      >
        Configurar API Key
      </Link>
      <div className={`mt-4 text-sm ${t.hint}`}>
        <p>Recomendamos usar Groq (gratuito)</p>
        <p>Leva apenas 2 minutos para configurar!</p>
      </div>
    </div>
  );
}
