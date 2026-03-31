"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { createProjectFromTemplate } from "@/lib/projects/createProjectFromTemplate";
import {
  getWizardGenreOptions,
  getWizardPlatformOptions,
  getWizardScopeOptions,
  getWizardStyleOptions,
  resolveTemplateFromWizard,
  type WizardChoices,
  type WizardGenre,
  type WizardPlatform,
  type WizardScope,
  type WizardStyle,
} from "@/lib/templates/manualTemplates";
import {
  FREE_MAX_PROJECTS,
  FREE_MAX_SECTIONS_PER_PROJECT,
  FREE_MAX_SECTIONS_TOTAL,
} from "@/lib/structuralLimits";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

type WizardFormState = {
  genre: WizardGenre | null;
  platforms: WizardPlatform[];
  scope: WizardScope | null;
  style: WizardStyle | null;
};

const STEP_META: Array<{ id: WizardStep; label: string; title: string; description: string }> = [
  { id: 1, label: "Passo 1", title: "Tipo de projeto", description: "Defina o formato principal do projeto." },
  { id: 2, label: "Passo 2", title: "Genero", description: "Escolha o genero principal do seu jogo." },
  { id: 3, label: "Passo 3", title: "Plataforma", description: "Selecione onde o jogo sera publicado." },
  { id: 4, label: "Passo 4", title: "Escopo", description: "Ajuste a profundidade inicial do GDD." },
  { id: 5, label: "Passo 5", title: "Estilo", description: "Defina o nivel de detalhamento do template." },
  { id: 6, label: "Passo 6", title: "Preview", description: "Revise a estrutura e crie o projeto." },
];

const GENRE_ADJECTIVES: Record<WizardGenre, string[]> = {
  rpg: ["Lendas", "Cronicas", "Reinos", "Ecos", "Guardioes"],
  roguelike: ["Abismo", "Ruina", "Labirinto", "Cinzas", "Catacumba"],
  platformer: ["Salto", "Horizonte", "Circuito", "Neblina", "Pulsar"],
  puzzle: ["Enigma", "Nexo", "Prisma", "Sintonia", "Mosaico"],
  simulation: ["Projeto", "Nucleo", "Ciclo", "Fluxo", "Operacao"],
};

function getStructuralLimitMessage(errorCode: string): string {
  if (errorCode === "structural_limit_projects") {
    return `Limite do plano Free: voce pode ter no maximo ${FREE_MAX_PROJECTS} projetos.`;
  }
  if (errorCode === "structural_limit_sections_per_project") {
    return `Limite do plano Free: maximo de ${FREE_MAX_SECTIONS_PER_PROJECT} secoes por projeto.`;
  }
  if (errorCode === "structural_limit_sections_total") {
    return `Limite do plano Free: maximo de ${FREE_MAX_SECTIONS_TOTAL} secoes na conta.`;
  }
  return "Nao foi possivel criar o projeto neste momento.";
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function generateProjectName(genre: WizardGenre): string {
  const adjective = randomItem(GENRE_ADJECTIVES[genre]);
  const number = 10 + Math.floor(Math.random() * 90);
  return `${adjective} ${number}`;
}

function cardClass(selected: boolean): string {
  return `p-4 rounded-xl border text-left transition-all ${
    selected
      ? "border-blue-400 bg-blue-600/20 shadow-md shadow-blue-900/30"
      : "border-gray-600 hover:border-gray-400 hover:bg-gray-700/40"
  }`;
}

export default function ProjectsPage() {
  const router = useRouter();
  const addProject = useProjectStore((state) => state.addProject);
  const addSection = useProjectStore((state) => state.addSection);
  const addSubsection = useProjectStore((state) => state.addSubsection);

  const [step, setStep] = useState<WizardStep>(1);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<WizardFormState>({
    genre: null,
    platforms: [],
    scope: null,
    style: null,
  });
  const [projectName, setProjectName] = useState("");
  const [selectedRootSectionIds, setSelectedRootSectionIds] = useState<string[]>([]);

  const genreOptions = getWizardGenreOptions();
  const platformOptions = getWizardPlatformOptions();
  const scopeOptions = getWizardScopeOptions();
  const styleOptions = getWizardStyleOptions();

  const choices = useMemo<WizardChoices | null>(() => {
    if (!form.genre || !form.scope || !form.style) return null;
    return {
      projectType: "digital_game",
      genre: form.genre,
      platforms: form.platforms,
      scope: form.scope,
      style: form.style,
    };
  }, [form.genre, form.platforms, form.scope, form.style]);

  const resolvedTemplate = useMemo(() => {
    if (!choices) return null;
    return resolveTemplateFromWizard(choices);
  }, [choices]);

  useEffect(() => {
    if (!resolvedTemplate) return;
    setSelectedRootSectionIds(resolvedTemplate.sections.map((section) => section.id));
  }, [resolvedTemplate]);

  useEffect(() => {
    if (!form.genre) return;
    if (projectName.trim()) return;
    setProjectName(generateProjectName(form.genre));
  }, [form.genre, projectName]);

  const selectedSections = useMemo(() => {
    if (!resolvedTemplate) return [];
    const selectedSet = new Set(selectedRootSectionIds);
    return resolvedTemplate.sections.filter((section) => selectedSet.has(section.id));
  }, [resolvedTemplate, selectedRootSectionIds]);

  const totalSelectedSubsections = useMemo(
    () => selectedSections.reduce((sum, section) => sum + (section.subsections?.length || 0), 0),
    [selectedSections]
  );
  const currentStep = STEP_META.find((item) => item.id === step) || STEP_META[0];
  const selectedGenreLabel = genreOptions.find((item) => item.id === form.genre)?.label || "Nao definido";
  const selectedScopeLabel = scopeOptions.find((item) => item.id === form.scope)?.label || "Nao definido";
  const selectedStyleLabel = styleOptions.find((item) => item.id === form.style)?.label || "Nao definido";
  const selectedPlatformLabel = form.platforms.length
    ? platformOptions
        .filter((item) => form.platforms.includes(item.id))
        .map((item) => item.label)
        .join(", ")
    : "Nao definido";

  const canGoNext =
    (step === 1 && true) ||
    (step === 2 && !!form.genre) ||
    (step === 3 && form.platforms.length > 0) ||
    (step === 4 && !!form.scope) ||
    (step === 5 && !!form.style) ||
    step === 6;

  const nextStep = () => {
    if (!canGoNext) return;
    setError("");
    setStep((current) => (current < 6 ? ((current + 1) as WizardStep) : current));
  };

  const previousStep = () => {
    setError("");
    if (step === 1) {
      router.push("/");
      return;
    }
    setStep((current) => (current > 1 ? ((current - 1) as WizardStep) : current));
  };

  const togglePlatform = (platform: WizardPlatform) => {
    setForm((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }));
  };

  const toggleRootSection = (sectionId: string) => {
    setSelectedRootSectionIds((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId]
    );
  };

  const handleCreate = () => {
    if (!resolvedTemplate) return;
    if (!projectName.trim()) {
      setError("Defina um nome para o projeto.");
      return;
    }
    if (selectedRootSectionIds.length === 0) {
      setError("Selecione pelo menos uma secao para criar o projeto.");
      return;
    }

    setError("");
    setIsCreating(true);

    try {
      const projectId = createProjectFromTemplate({
        template: {
          ...resolvedTemplate,
          projectTitle: projectName.trim(),
        },
        addProject,
        addSection,
        addSubsection,
        selectedRootSectionIds,
      });
      router.push(`/projects/${projectId}`);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("structural_limit_")) {
        setError(getStructuralLimitMessage(e.message));
      } else {
        setError("Nao foi possivel criar o projeto. Tente novamente.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <button
          onClick={previousStep}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← {step === 1 ? "Voltar para Home" : "Voltar"}
        </button>

        <header className="mt-5 mb-6 rounded-2xl border border-gray-700/80 bg-gray-900/70 p-5 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-blue-300">{currentStep.label}</p>
              <h1 className="text-3xl font-bold mt-1">Wizard de Criacao Manual</h1>
              <p className="text-gray-300 mt-2">{currentStep.title} - {currentStep.description}</p>
            </div>
            <p className="text-sm text-gray-400">Passo {step} de 6</p>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2 mt-5">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
              style={{ width: `${(step / 6) * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4">
            {STEP_META.map((item) => {
              const done = item.id < step;
              const active = item.id === step;
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border px-2 py-1 text-xs text-center ${
                    active
                      ? "border-blue-400 bg-blue-500/20 text-blue-100"
                      : done
                        ? "border-emerald-600/60 bg-emerald-600/15 text-emerald-100"
                        : "border-gray-700 bg-gray-800/60 text-gray-400"
                  }`}
                >
                  {item.id}
                </div>
              );
            })}
          </div>
        </header>

        <section className="bg-gray-900/70 border border-gray-700/80 rounded-2xl p-6 backdrop-blur-sm shadow-xl shadow-black/20">
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold mb-2">1. Tipo de projeto</h2>
              <p className="text-gray-300 mb-4">Neste MVP, o wizard esta focado em jogo digital.</p>
              <button className="w-full text-left p-5 rounded-xl border border-blue-500 bg-blue-600/20 shadow-md shadow-blue-900/20">
                <p className="font-semibold">Jogo digital</p>
                <p className="text-sm text-gray-300">Estrutura de GDD com secoes de gameplay, producao e UX.</p>
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">2. Escolha o genero principal</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {genreOptions.map((option) => {
                  const selected = form.genre === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setForm((current) => ({ ...current, genre: option.id }))}
                      className={cardClass(selected)}
                    >
                      <p className="font-semibold">{option.label}</p>
                      <p className="text-sm text-gray-300 mt-1">Template otimizado para {option.label}.</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-2">3. Plataforma alvo</h2>
              <p className="text-gray-300 mb-4">Selecione uma ou mais plataformas.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {platformOptions.map((option) => {
                  const selected = form.platforms.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      onClick={() => togglePlatform(option.id)}
                      className={cardClass(selected)}
                    >
                      <p className="font-semibold">{option.label}</p> 
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">4. Escopo inicial</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {scopeOptions.map((option) => {
                  const selected = form.scope === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setForm((current) => ({ ...current, scope: option.id }))}
                      className={cardClass(selected)}
                    >
                      <p className="font-semibold">{option.label}</p>
                      <p className="text-sm text-gray-300 mt-1">{option.summary}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">5. Estilo de template</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {styleOptions.map((option) => {
                  const selected = form.style === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setForm((current) => ({ ...current, style: option.id }))}
                      className={cardClass(selected)}
                    >
                      <p className="font-semibold">{option.label}</p>
                      <p className="text-sm text-gray-300 mt-1">{option.summary}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 6 && resolvedTemplate && (
            <div>
              <h2 className="text-xl font-semibold mb-2">6. Preview e confirmacao</h2>
              <p className="text-gray-300 mb-4">
                Ajuste o nome e marque quais secoes raiz entram no projeto.
              </p>

              <div className="mb-5">
                <label className="block text-sm mb-2 text-gray-300">Nome do projeto</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    className="flex-1 p-3 rounded-lg bg-gray-950 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome do projeto"
                  />
                  <button
                    onClick={() => form.genre && setProjectName(generateProjectName(form.genre))}
                    className="px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    Gerar outro nome
                  </button>
                </div>
              </div>

              <div className="mb-5 p-4 rounded-xl border border-gray-700 bg-gray-950/80">
                <p className="text-sm text-gray-300">{resolvedTemplate.projectDescription}</p>
              </div>

              <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm">
                  <p className="text-gray-400">Genero</p>
                  <p className="font-medium">{selectedGenreLabel}</p>
                </div>
                <div className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm">
                  <p className="text-gray-400">Plataformas</p>
                  <p className="font-medium">{selectedPlatformLabel}</p>
                </div>
                <div className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm">
                  <p className="text-gray-400">Escopo</p>
                  <p className="font-medium">{selectedScopeLabel}</p>
                </div>
                <div className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm">
                  <p className="text-gray-400">Estilo</p>
                  <p className="font-medium">{selectedStyleLabel}</p>
                </div>
              </div>

              <div className="space-y-3">
                {resolvedTemplate.sections.map((section) => {
                  const selected = selectedRootSectionIds.includes(section.id);
                  return (
                    <div key={section.id} className={`p-4 rounded-xl border ${selected ? "border-blue-500/70 bg-blue-900/10" : "border-gray-700 bg-gray-950/60"}`}>
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRootSection(section.id)}
                          className="mt-1 accent-blue-500"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{section.title}</p>
                            {section.subsections && section.subsections.length > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-200">
                                {section.subsections.length} subsecoes
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-300 mt-1">{section.content}</p>
                          {section.subsections && section.subsections.length > 0 && (
                            <ul className="mt-2 text-sm text-gray-400 list-disc pl-5">
                              {section.subsections.map((subsection) => (
                                <li key={subsection.id}>{subsection.title}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>

              <p className="text-sm text-gray-400 mt-4">
                Estrutura selecionada: {selectedSections.length} secoes raiz e {totalSelectedSubsections} subsecoes.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-5 p-3 rounded border border-red-500/60 bg-red-900/30 text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            {step < 6 ? (
              <button
                onClick={nextStep}
                disabled={!canGoNext}
                className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                Avancar
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 transition-colors"
              >
                {isCreating ? "Criando..." : "Criar projeto"}
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
