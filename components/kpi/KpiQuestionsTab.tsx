"use client";

const RETENTION_QUESTIONS = [
  {
    q: "D1 abaixo do esperado?",
    a: "Problema no tutorial ou na primeira sessão. Jogador não sentiu a graça antes de sair.",
  },
  {
    q: "D7 cai muito em relação ao D1?",
    a: "Loop de curto prazo não está retendo. Faltam objetivos que levem o jogador de volta no dia 2 e 3.",
  },
  {
    q: "D30 muito baixo?",
    a: "Mid-game vazio. Ficou sem o que fazer entre o nível 20 e 50.",
  },
  {
    q: "Qual nível tem mais churn?",
    a: "É o seu ponto de intervenção prioritária. Pode ser um spike de dificuldade ou um vazio de conteúdo.",
  },
];

const EXPERIMENT_QUESTIONS = [
  {
    q: "O que testamos esta semana?",
    a: "Sempre 1 hipótese ativa. Nunca teste tudo ao mesmo tempo — você não vai saber o que funcionou.",
  },
  {
    q: "O resultado confirmou?",
    a: "Sim → implementa. Não → descarta ou reformula. Inconclusivo → mais dados ou hipótese mais clara.",
  },
  {
    q: "O que aprendemos?",
    a: "Este é o valor real do relatório semanal. Sem learning registrado, você vai repetir os mesmos erros.",
  },
  {
    q: "Qual é a próxima hipótese?",
    a: "Sempre saia com pelo menos 1 experimento definido. Sem hipótese ativa, a semana é perdida.",
  },
];

export default function KpiQuestionsTab() {
  return (
    <div className="space-y-6">
      {/* Info box */}
      <div className="rounded-xl border border-sky-700/50 bg-sky-950/30 px-4 py-3">
        <p className="text-sm text-sky-200 font-medium mb-1">Por que essas perguntas?</p>
        <p className="text-sm text-sky-300/80">
          Dados sem perguntas são só números. Essas perguntas transformam os KPIs em ações de produto.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-4">Sobre retenção</p>
          <div className="space-y-4">
            {RETENTION_QUESTIONS.map((item, i) => (
              <div key={i}>
                <p className="text-sm font-semibold text-gray-200">{item.q}</p>
                <p className="mt-1 text-sm text-gray-400 pl-3 border-l-2 border-gray-700">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-400 mb-4">Sobre experimentos</p>
          <div className="space-y-4">
            {EXPERIMENT_QUESTIONS.map((item, i) => (
              <div key={i}>
                <p className="text-sm font-semibold text-gray-200">{item.q}</p>
                <p className="mt-1 text-sm text-gray-400 pl-3 border-l-2 border-gray-700">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 px-4 py-3">
        <p className="text-xs text-gray-500">
          Lembre de registrar o aprendizado de cada semana aqui na aba "KPIs principais" — o histórico de decisões é mais valioso que qualquer dashboard.
        </p>
      </div>
    </div>
  );
}
