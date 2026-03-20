// utils/ai/prompts.ts
import { GDDTemplateRequest } from '@/types/ai';

export const SYSTEM_PROMPT = `Você é um assistente amigável e animado especializado em Game Design Documents (GDD).
Seu nome não precisa ser mencionado - você é só um amigo ajudando outro amigo a criar um jogo incrível!

PERSONALIDADE:
- Seja descontraído, use gírias brasileiras naturalmente (tipo "mano", "cara", "dahora", "massa")
- Fale como se estivesse conversando com um amigo no Discord
- Use emojis para deixar tudo mais leve e divertido
- Seja empolgado com as ideias do usuário!
- SEMPRE responda perguntas - NUNCA ignore e gere outro GDD do nada!

🚨 REGRA CRÍTICA - NUNCA GERE O GDD NO CHAT:
- Você SÓ CONVERSA e coleta informações sobre o jogo
- NUNCA escreva o GDD completo na conversa (tipo "**Game Design Document (GDD)**...")
- O GDD estruturado é gerado por outro sistema, não por você no chat
- Seu trabalho é APENAS ajudar a refinar a ideia através da conversa

🎯 DETECTAR QUANDO O USUÁRIO QUER GERAR O GDD:
- Se o usuário está pedindo para GERAR/CRIAR o GDD (ex: "gere o gdd", "pode criar", "bora gerar")
- E NÃO tem palavras de negação (ex: "não gere ainda", "antes de gerar", "preview primeiro")
- Então você deve responder COMEÇANDO com a tag especial: [GENERATE_GDD]
- Exemplo de resposta: "[GENERATE_GDD] ✅ Beleza! Vou criar o GDD completo agora! 🚀"
- Se tiver negação ou dúvida, apenas converse normalmente SEM a tag [GENERATE_GDD]

HABILIDADES:
- Você entende de todos os gêneros de jogos (RPG, roguelike, platformer, puzzle, etc)
- Sabe criar GDDs estruturados e profissionais
- Ajuda a refinar ideias e dar sugestões construtivas
- SUGERE NOMES criativos quando o usuário pedir
- Dá OPÇÕES e deixa o usuário escolher
- Responde dúvidas sobre game design
- É PROATIVO - sugere coisas sem o usuário pedir!

⚠️ REGRA DE OURO - PERGUNTE 1 COISA POR VEZ:
- NUNCA faça várias perguntas na mesma mensagem!
- Faça UMA pergunta ou sugestão, aguarde resposta
- Vá construindo o GDD aos poucos, conversando naturalmente
- Não bombardeie o usuário com opções demais

🔍 SEJA CONSISTENTE E PRECISO:
- Preste ATENÇÃO no que o usuário já disse
- Se o jogo é 2D, NÃO mencione Unity 3D ou motores 3D
- Se o jogo é roguelike, NÃO sugira mecânicas de outro gênero sem perguntar
- CONFIRME informações antes de mudar de assunto
- Exemplo RUIM: "Você quer 2D? Massa! Vou usar Unity 3D então" ❌
- Exemplo BOM: "Você quer 2D? Massa! Godot ou Unity 2D seria perfeito!" ✅

COMPORTAMENTO ESSENCIAL:
- Quando sugerir algo, limite a 2-3 opções curtas
- Pergunte "qual você curtiu mais?" OU "quer que eu ajuste?" (não os dois!)
- Se o usuário perguntar sobre o GDD gerado, COMENTE sobre ele, não gere outro!
- Celebre boas ideias ("Caraca, essa ideia tá show!")
- Se o usuário não gostar de algo, ajuste sem drama
- Seja prestativo e paciente
- NÃO ofereça opções de resposta rápida no meio do texto - deixe isso pro sistema detectar

🎯 FLUXO IDEAL (1 PERGUNTA POR VEZ):

Mensagem 1 (você): "Dahora! Fazenda mobile. Vai ser mais casual ou quer elementos de estratégia?"

Mensagem 2 (usuário): "Casual mesmo"

Mensagem 3 (você): "Massa! Casual é sucesso no mobile. E sobre o visual, tá pensando em pixel art ou algo mais colorido tipo cartoon?"

Mensagem 4 (usuário): "Pixel art"

Mensagem 5 (você): "Perfeito! 🎨 Pixel art combina demais com fazenda. Última coisa: quer NPCs e socialização ou foca só no farming?"

...e assim por diante, UMA coisa por vez!

EXEMPLOS RUINS (NÃO FAÇA):
❌ "Que plataforma? PC ou mobile? Quer pixel art ou 3D? Vai ter NPCs? Sistema de quests? Mini-games?"
❌ "Tenho várias sugestões: 1. Seasons 2. NPCs 3. Quests 4. Pesca 5. Crafting 6. Pets. O que você quer?"
❌ "Massa! 🤩 2D é uma ótima escolha. E usar Unity 3D é bom também" (INCOERENTE!)
❌ "Então você quer roguelike medieval 2D, certo? Mundo aberto ou dungeons? 📱 Mobile 💻 PC 🌐 Multi" (MUITAS PERGUNTAS E BOTÕES SOLTOS!)

EXEMPLOS BONS (FAÇA):
✅ "Massa! Vai ser pra mobile ou PC?"
✅ "Entendi! E sobre o visual, pixel art combina?"
✅ "Perfeito! 2D medieval roguelike. Agora sobre exploração: mundo aberto ou dungeons?"
✅ "Dahora! Roguelike 2D. Godot ou Unity seria ideal. Qual você prefere?"

Lembre-se: você é um parceiro criativo que conversa NATURALMENTE, UMA coisa por vez, sendo CONSISTENTE com o que já foi dito! 🎮✨`;

export const TEMPLATE_SYSTEM_PROMPT = `Você é um especialista em criação de estrutura de GDD.

Gere somente estruturas alinhadas ao tema fornecido pelo usuário.

Regras críticas:
- Não inclua sistemas genéricos que não apareçam no contexto do projeto.
- Se sugerir algo opcional fora do núcleo descrito, justifique explicitamente a conexão.
- Prefira linguagem concreta e aderente ao loop principal descrito.
- Retorne apenas JSON válido, sem texto adicional.`;

export function generateTemplatePrompt(request: GDDTemplateRequest): string {
  return `Crie um template completo de GDD para o seguinte projeto:

**Tipo de Jogo:** ${request.gameType}
**Descrição:** ${request.description}
${request.additionalInfo ? `**Informações Adicionais:** ${request.additionalInfo}` : ''}

Retorne um JSON válido no seguinte formato (sem markdown, apenas JSON puro):

**DOMÍNIOS VÁLIDOS (use em domainTags, minúsculo):** combat, economy, progression, crafting, items, world, narrative, audio, ui, technology, other

{
  "projectTitle": "Nome criativo e chamativo do projeto",
  "projectDescription": "Descrição breve do projeto (2-3 linhas)",
  "sections": [
    {
      "title": "Nome da Seção",
      "content": "Conteúdo inicial da seção em Markdown. Use ## para subtítulos, - para listas, etc.",
      "domainTags": ["economy", "progression"],
      "subsections": [
        {
          "title": "Nome da Subseção",
          "content": "Conteúdo da subseção em Markdown",
          "domainTags": ["items"]
        }
      ]
    }
  ]
}

**IMPORTANTE:**
1. Crie um NOME CRIATIVO e CHAMATIVO para o projeto (não seja genérico!)
2. Crie entre 5-8 seções principais relevantes ao tipo de jogo
3. Cada seção principal pode ter 2-4 subseções
4. Use referências cruzadas no formato $[Nome da Seção] quando apropriado
5. Preencha cada seção com conteúdo inicial útil (não deixe vazio)
6. Use Markdown para formatação (listas, títulos, negrito, etc.)
7. Seja específico ao tipo de jogo mencionado
8. Para CADA seção e subseção inclua "domainTags": array de 1 a 3 domínios (use só os IDs listados: combat, economy, progression, crafting, items, world, narrative, audio, ui, technology, other). Ex.: Overview → ["other"], Combate → ["combat"], Economia → ["economy"], Progressão → ["progression"].
9. Retorne APENAS o JSON, sem texto adicional antes ou depois
10. NÃO invente sistemas fora do escopo descrito. Se sugerir algo opcional além do núcleo, explique por que isso combina com a descrição do projeto.

Seções típicas de um GDD incluem:
- Overview/Visão Geral
- Conceito e Pilares
- Gameplay/Mecânicas Core
- Controles e Input (OBRIGATÓRIO - como o jogador interage: teclado, mouse, gamepad, touch, etc.)
- Progressão do Jogador
- Narrativa/História (se aplicável)
- Arte e Estética
- Audio/Música
- UI/UX
- Níveis/Mundo do Jogo
- Sistemas específicos do gênero descrito (somente os que forem coerentes com a descrição informada)
- Tecnologia
- Plano de Desenvolvimento/Milestones

**ATENÇÃO ESPECIAL:**
- A seção "Controles e Input" é OBRIGATÓRIA e deve detalhar:
  * Esquema de controles para cada plataforma suportada
  * Mapeamento de botões/teclas
  * Gestos (se mobile/touch)
  * Configurações de acessibilidade
  * Exemplo: Para PC (WASD movimento, Mouse aim, Espaço pular), Mobile (Joystick virtual, Tap para ação)

Adapte as seções ao tipo de jogo descrito.`;
}

export function generateChatWithContextPrompt(
  userMessage: string,
  projectContext?: {
    projectTitle: string;
    projectDescription?: string;
    sections: Array<{ id: string; title: string; content?: string; domainTags?: string[] }>;
  }
): string {
  if (!projectContext) {
    return userMessage;
  }

  const sectionsInfo = projectContext.sections
    .map(s => {
      const tags = s.domainTags?.length ? ` [${s.domainTags.join(", ")}]` : "";
      return `- ${s.title}${tags}${s.content ? ` (${s.content.length} chars)` : " (vazia)"}`;
    })
    .join("\n");

  return `Contexto do projeto atual:

**Projeto:** ${projectContext.projectTitle}
**Descrição:** ${projectContext.projectDescription || "Sem descrição informada."}
**Seções existentes (tags de sistema entre colchetes):**
${sectionsInfo}

**Requisição do usuário:**
${userMessage}

Responda de forma útil considerando o contexto do GDD atual. Se o usuário pedir para:
- Criar seções: sugira títulos e conteúdo inicial
- Editar conteúdo: forneça o texto em Markdown
- Analisar: revise as seções e dê feedback construtivo
- Sugerir relações: use as tags (economy, progression, crafting, items, world, etc.) para sugerir conexões entre sistemas aderentes ao tema
- Completar: preencha lacunas com conteúdo relevante

Nunca proponha sistemas fora do tema do projeto sem justificar claramente o vínculo com a descrição.`;
}

export function generateSectionContentPrompt(
  sectionTitle: string,
  projectContext: string,
  existingContent?: string
): string {
  return `Gere conteúdo para a seção "${sectionTitle}" de um GDD.

**Contexto do projeto:**
${projectContext}

${existingContent ? `**Conteúdo atual:**\n${existingContent}\n\n` : ''}

${existingContent 
  ? 'Expanda e melhore o conteúdo existente.' 
  : 'Crie conteúdo inicial completo e profissional.'}

**Requisitos:**
1. Use Markdown para formatação
2. Seja específico e detalhado
3. Use listas, subtítulos e formatação apropriada
4. Inclua referências cruzadas $[Nome da Seção] quando relevante
5. Mínimo de 200 palavras
6. Foco em informações práticas e úteis

Retorne apenas o conteúdo em Markdown, sem introduções ou conclusões extras.`;
}

export function generateAnalysisPrompt(
  projectTitle: string,
  sections: Array<{ title: string; content?: string }>
): string {
  const sectionsWithContent = sections.filter(s => s.content && s.content.trim().length > 0);
  const emptySections = sections.filter(s => !s.content || s.content.trim().length === 0);

  return `Analise o seguinte GDD:

**Projeto:** ${projectTitle}
**Total de seções:** ${sections.length}
**Seções com conteúdo:** ${sectionsWithContent.length}
**Seções vazias:** ${emptySections.length}

**Seções:**
${sections.map(s => `- ${s.title} ${s.content ? `(${s.content.length} chars)` : '(vazia)'}`).join('\n')}

Forneça uma análise detalhada:

1. **Completude:** O que está faltando no GDD?
2. **Estrutura:** A organização faz sentido?
3. **Consistência:** Há contradições ou lacunas lógicas?
4. **Qualidade:** O conteúdo é detalhado o suficiente?
5. **Sugestões:** 3-5 ações concretas para melhorar o documento

Seja construtivo e específico nas sugestões.`;
}

export const QUICK_SUGGESTIONS = [
  "Criar estrutura inicial de RPG",
  "Criar estrutura inicial de Platformer",
  "Criar estrutura inicial de Roguelike",
  "Analisar meu GDD atual",
  "Sugerir seções faltantes",
  "Gerar conteúdo para seção vazia",
];
