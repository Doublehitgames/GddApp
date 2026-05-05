"use client";

const ROUTINE = [
  {
    day: "Diário",
    time: "5 min",
    task: "Abrir analytics, verificar D1 do dia anterior, sessões/dia e churn por nível. Se algo sair fora do padrão, anota pra investigar.",
  },
  {
    day: "Segunda",
    time: "30 min",
    task: "Revisão profunda: curva D1/D7/D30 por coorte da semana. Comparar com a semana anterior.",
  },
  {
    day: "Quarta",
    time: "20 min",
    task: "Checar A/B tests ativos. Há significância estatística? Continua, encerra ou ajusta?",
  },
  {
    day: "Quinta",
    time: "30 min",
    task: "Levantar hipóteses pro relatório semanal. Montar a narrativa: o que mudou, por que, o que testar.",
  },
  {
    day: "Sexta",
    time: "45 min",
    task: "Escrever relatório semanal: números → hipóteses → aprendizados → próximos experimentos.",
  },
];

export default function KpiRoutineTab() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Rotina semanal de dados</p>
        <p className="text-sm text-gray-400">Consistência bate talento. Esses blocos de tempo por semana são suficientes pra tomar boas decisões de produto.</p>
      </div>

      <div className="rounded-xl border border-gray-700/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700/60 bg-gray-900/80">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-500 w-24">Dia</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-500 w-20">Tempo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">O que fazer</th>
            </tr>
          </thead>
          <tbody>
            {ROUTINE.map((row, i) => (
              <tr
                key={row.day}
                className={`border-b border-gray-700/40 last:border-0 ${i % 2 === 0 ? "bg-gray-900/30" : "bg-gray-900/60"}`}
              >
                <td className="px-4 py-3 font-semibold text-gray-200 align-top">{row.day}</td>
                <td className="px-4 py-3 text-emerald-400 font-mono tabular-nums align-top">{row.time}</td>
                <td className="px-4 py-3 text-gray-300 align-top">{row.task}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 px-4 py-3">
        <p className="text-xs text-gray-500">
          Esses tempos são estimativas para times pequenos. Com mais dados e automação (dashboards, alertas), o diário pode cair pra 2 minutos.
        </p>
      </div>
    </div>
  );
}
