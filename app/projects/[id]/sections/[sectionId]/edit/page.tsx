"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

/**
 * Rota legada: /projects/[id]/sections/[sectionId]/edit
 * Redireciona para a tela da seção com ?edit=1 para abrir direto no modo edição inline.
 * O editor único é o Toast UI na própria tela da seção.
 */
export default function SectionEditRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;
  const sectionId = params?.sectionId as string;

  useEffect(() => {
    if (projectId && sectionId) {
      router.replace(`/projects/${projectId}/sections/${sectionId}?edit=1`);
    }
  }, [router, projectId, sectionId]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <p className="text-gray-400">Redirecionando…</p>
    </div>
  );
}
