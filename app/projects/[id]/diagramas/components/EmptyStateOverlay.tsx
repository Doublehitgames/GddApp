"use client";

type EmptyStateOverlayProps = {
  cardClass: string;
  primaryButtonClass: string;
  onCreateNode: () => void;
};

export default function EmptyStateOverlay({ cardClass, primaryButtonClass, onCreateNode }: EmptyStateOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      <div className={`pointer-events-auto ${cardClass}`}>
        <p className="text-lg font-semibold mb-2 text-slate-100">Seu quadro esta vazio</p>
        <p className="text-sm text-slate-300 mb-5">Crie blocos, conecte com setas e adicione labels nas conexoes.</p>
        <button onClick={onCreateNode} className={primaryButtonClass}>Criar primeiro bloco</button>
      </div>
    </div>
  );
}
