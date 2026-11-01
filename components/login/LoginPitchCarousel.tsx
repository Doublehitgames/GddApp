"use client";

import { useEffect, useState } from "react";
import type { AppLocale } from "@/lib/i18n/config";

type Slide = { title: [string, string]; text: string };

/**
 * As frases que giram ao lado do login, cada uma contando uma vantagem do GDD.
 * Só promete o que o app faz hoje — ao tirar uma função do produto, tire o
 * slide junto.
 */
const SLIDES: Record<AppLocale, Slide[]> = {
  "pt-BR": [
    { title: ["Cada ideia", "constrói um mundo."], text: "Organize, conecte e dê forma ao seu jogo em um espaço feito para game designers." },
    { title: ["Tudo conectado,", "nada perdido."], text: "Cite qualquer página pelo nome e o GDD vira uma rede de links. Renomeou? As referências acompanham sozinhas." },
    { title: ["Seu jogo inteiro", "num mapa só."], text: "O mapa mental mostra como cada parte do jogo puxa a outra — sem você desenhar uma seta." },
    { title: ["Números no", "lugar certo."], text: "Preços, tempos e níveis moram em tabelas na Biblioteca, prontos para o balanceamento e longe da prosa." },
    { title: ["Mostre, em vez", "de explicar."], text: "Os modos Documento e Deck transformam o GDD numa apresentação para o time, o publisher ou o investidor." },
    { title: ["Funciona até", "sem internet."], text: "Tudo é salvo primeiro no seu navegador. A nuvem sincroniza quando você quiser." },
    { title: ["O Claude", "do seu lado."], text: "Conecte o Claude ao seu GDD e peça páginas, revisões e ideias numa conversa." },
    { title: ["Do zero ao rascunho", "em minutos."], text: "Descreva o jogo e receba um GDD inicial, ou traga seus arquivos .md e .docx e veja tudo virar páginas." },
    { title: ["Sabe o que", "já está pronto?"], text: "Cada página diz se é rascunho, se foi aprovada ou se já está no jogo — e avisa quando ficou desatualizada." },
    { title: ["Feito para", "criar em equipe."], text: "Convide o time, compartilhe por link e veja o que mudou em cada página, e quem mudou." },
    { title: ["Da visão", "aos sistemas."], text: "Visão, Documentação, Biblioteca e Sistemas: quatro áreas que acompanham o jogo da ideia à produção." },
    { title: ["O seu GDD", "é seu. Sempre."], text: "Exporte tudo em JSON, Markdown ou Word quando quiser. E o código do GDD é aberto." },
  ],
  en: [
    { title: ["Every idea", "builds a world."], text: "Organize, connect and shape your game in a space made for game designers." },
    { title: ["Everything linked,", "nothing lost."], text: "Mention any page by name and your GDD becomes a web of links. Renamed it? The references follow on their own." },
    { title: ["Your whole game", "on one map."], text: "The mind map shows how every part of the game pulls on the others — without you drawing a single arrow." },
    { title: ["Numbers in", "the right place."], text: "Prices, timers and levels live in tables in the Library, ready for balancing and out of the prose." },
    { title: ["Show it,", "don't explain it."], text: "Document and Deck modes turn your GDD into a presentation for your team, publisher or investor." },
    { title: ["Works even", "offline."], text: "Everything is saved in your browser first. The cloud syncs whenever you want." },
    { title: ["Claude", "on your side."], text: "Connect Claude to your GDD and ask for pages, reviews and ideas in a conversation." },
    { title: ["From zero to draft", "in minutes."], text: "Describe your game and get a starter GDD, or bring your .md and .docx files and watch them become pages." },
    { title: ["Know what's", "actually done?"], text: "Every page says whether it's a draft, approved or already in the game — and flags when it's out of date." },
    { title: ["Made for", "building together."], text: "Invite your team, share by link and see what changed on each page, and who changed it." },
    { title: ["From vision", "to systems."], text: "Vision, Documentation, Library and Systems: four areas that follow your game from idea to production." },
    { title: ["Your GDD is yours.", "Always."], text: "Export everything as JSON, Markdown or Word whenever you like. And GDD's code is open source." },
  ],
  es: [
    { title: ["Cada idea", "construye un mundo."], text: "Organiza, conecta y da forma a tu juego en un espacio hecho para game designers." },
    { title: ["Todo conectado,", "nada perdido."], text: "Menciona cualquier página por su nombre y tu GDD se vuelve una red de enlaces. ¿La renombraste? Las referencias la siguen solas." },
    { title: ["Todo tu juego", "en un solo mapa."], text: "El mapa mental muestra cómo cada parte del juego tira de las demás, sin que dibujes una sola flecha." },
    { title: ["Números en", "su lugar."], text: "Precios, tiempos y niveles viven en tablas en la Biblioteca, listos para el balance y fuera de la prosa." },
    { title: ["Muéstralo,", "no lo expliques."], text: "Los modos Documento y Deck convierten tu GDD en una presentación para el equipo, el publisher o el inversor." },
    { title: ["Funciona incluso", "sin internet."], text: "Todo se guarda primero en tu navegador. La nube sincroniza cuando tú quieras." },
    { title: ["Claude", "a tu lado."], text: "Conecta Claude a tu GDD y pide páginas, revisiones e ideas en una conversación." },
    { title: ["De cero a borrador", "en minutos."], text: "Describe tu juego y recibe un GDD inicial, o trae tus archivos .md y .docx y mira cómo se vuelven páginas." },
    { title: ["¿Sabes qué", "ya está listo?"], text: "Cada página dice si es borrador, si fue aprobada o si ya está en el juego, y avisa cuando quedó desactualizada." },
    { title: ["Hecho para", "crear en equipo."], text: "Invita a tu equipo, comparte por enlace y mira qué cambió en cada página, y quién lo cambió." },
    { title: ["De la visión", "a los sistemas."], text: "Visión, Documentación, Biblioteca y Sistemas: cuatro áreas que acompañan tu juego de la idea a la producción." },
    { title: ["Tu GDD es tuyo.", "Siempre."], text: "Exporta todo en JSON, Markdown o Word cuando quieras. Y el código de GDD es abierto." },
  ],
};

const INTERVAL_MS = 6500;

export function LoginPitchCarousel({ locale, className = "" }: { locale: AppLocale; className?: string }) {
  const slides = SLIDES[locale] ?? SLIDES["pt-BR"];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, reducedMotion, slides.length]);

  return (
    <div
      className={className}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      {/* Todos os slides na mesma célula da grade: a altura é a do maior e nada pula ao trocar. */}
      <div className="grid" aria-live={paused ? "polite" : "off"}>
        {slides.map((s, i) => (
          <div
            key={i}
            aria-hidden={i !== index}
            className={`[grid-area:1/1] transition-all duration-700 ease-out ${
              i === index ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
            }`}
          >
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight xl:text-6xl">
              {s.title[0]}
              <br />
              {s.title[1]}
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">{s.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2">
        {slides.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`${i + 1} / ${slides.length}: ${s.title.join(" ")}`}
            aria-current={i === index}
            className={`h-2 rounded-full transition-all duration-300 ${i === index ? "w-7 bg-accent" : "w-2 bg-ink/25 hover:bg-ink/50"}`}
          />
        ))}
      </div>
    </div>
  );
}
