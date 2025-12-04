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

COMPORTAMENTO ESSENCIAL:
- Quando sugerir algo, limite a 2-3 opções curtas
- Pergunte "qual você curtiu mais?" OU "quer que eu ajuste?" (não os dois!)
- Se o usuário perguntar sobre o GDD gerado, COMENTE sobre ele, não gere outro!
- Celebre boas ideias ("Caraca, essa ideia tá show!")
- Se o usuário não gostar de algo, ajuste sem drama
- Seja prestativo e paciente

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

EXEMPLOS BONS (FAÇA):
✅ "Massa! Vai ser pra mobile ou PC?"
✅ "Entendi! E sobre o visual, pixel art combina?"
✅ "Posso sugerir um sistema de seasons (primavera, verão...)? Acho que ficaria dahora!"

Lembre-se: você é um parceiro criativo que conversa NATURALMENTE, UMA coisa por vez! 🎮✨`;

export function generateTemplatePrompt(request: GDDTemplateRequest): string {
  return `Crie um template completo de GDD para o seguinte projeto:

**Tipo de Jogo:** ${request.gameType}
**Descrição:** ${request.description}
${request.additionalInfo ? `**Informações Adicionais:** ${request.additionalInfo}` : ''}

Retorne um JSON válido no seguinte formato (sem markdown, apenas JSON puro):

{
  "projectTitle": "Nome criativo e chamativo do projeto",
  "projectDescription": "Descrição breve do projeto (2-3 linhas)",
  "sections": [
    {
      "title": "Nome da Seção",
      "content": "Conteúdo inicial da seção em Markdown. Use ## para subtítulos, - para listas, etc.",
      "subsections": [
        {
          "title": "Nome da Subseção",
          "content": "Conteúdo da subseção em Markdown"
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
8. Retorne APENAS o JSON, sem texto adicional antes ou depois

Seções típicas de um GDD incluem:
- Overview/Visão Geral
- Conceito e Pilares
- Gameplay/Mecânicas Core
- Progressão do Jogador
- Narrativa/História (se aplicável)
- Arte e Estética
- Audio/Música
- UI/UX
- Níveis/Mundo do Jogo
- Sistemas específicos do gênero (combate, puzzles, economia, etc.)
- Tecnologia
- Plano de Desenvolvimento/Milestones

Adapte as seções ao tipo de jogo descrito.`;
}

export function generateChatWithContextPrompt(
  userMessage: string,
  projectContext?: {
    projectTitle: string;
    sections: Array<{ id: string; title: string; content?: string }>;
  }
): string {
  if (!projectContext) {
    return userMessage;
  }

  const sectionsInfo = projectContext.sections
    .map(s => `- ${s.title}${s.content ? ` (${s.content.length} chars)` : ' (vazia)'}`)
    .join('\n');

  return `Contexto do projeto atual:

**Projeto:** ${projectContext.projectTitle}
**Seções existentes:**
${sectionsInfo}

**Requisição do usuário:**
${userMessage}

Responda de forma útil considerando o contexto do GDD atual. Se o usuário pedir para:
- Criar seções: sugira títulos e conteúdo inicial
- Editar conteúdo: forneça o texto em Markdown
- Analisar: revise as seções e dê feedback construtivo
- Completar: preencha lacunas com conteúdo relevante`;
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
