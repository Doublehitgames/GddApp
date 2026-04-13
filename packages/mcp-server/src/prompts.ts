/**
 * MCP Prompts for GDD Manager.
 *
 * Pre-built workflows that users can invoke from Claude's prompt list.
 * Each prompt returns messages that instruct Claude on what to do.
 */

import { z } from "zod/v3";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function userMsg(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

export function registerPrompts(server: McpServer) {
  // ── 1. Meus Projetos ───────────────────────────────────────────

  server.prompt(
    "meus_projetos",
    "Lista todos os seus projetos com resumo de seções e addons",
    async () => userMsg(
      `Use a tool list_projects para listar meus projetos do GDD Manager. Para cada projeto, mostre:
- Nome do projeto
- Quantidade de seções
- Descrição resumida (primeiras 2 linhas)

Apresente de forma limpa e organizada.`
    ),
  );

  // ── 2. Ver Projeto ──────────────────────────────────────────────

  server.prompt(
    "ver_projeto",
    "Mostra um projeto completo com todas as seções e addons",
    { projectName: z.string().describe("Nome ou parte do nome do projeto") },
    async ({ projectName }) => userMsg(
      `Quero ver o projeto "${projectName}" do meu GDD Manager.

1. Use list_projects para encontrar o projeto pelo nome
2. Use get_project com o ID encontrado
3. Mostre uma visão organizada:
   - Título e descrição
   - Árvore de seções (com indentação para sub-seções)
   - Para cada seção, liste os addons (tipo e nome)
   - Destaque seções sem conteúdo ou vazias`
    ),
  );

  // ── 3. Nova Seção ───────────────────────────────────────────────

  server.prompt(
    "nova_secao",
    "Guia a criação de uma nova seção no projeto",
    {
      projectName: z.string().describe("Nome do projeto"),
      sectionTitle: z.string().describe("Título da nova seção"),
    },
    async ({ projectName, sectionTitle }) => userMsg(
      `Crie uma nova seção chamada "${sectionTitle}" no projeto "${projectName}".

1. Use list_projects para encontrar o ID do projeto
2. Use create_section para criar a seção com:
   - Título: "${sectionTitle}"
   - Sugira domain tags apropriadas baseadas no título
   - Sugira um conteúdo inicial com template de GDD (visão geral, mecânicas, regras)
3. Mostre a seção criada e pergunte se quer adicionar addons`
    ),
  );

  // ── 4. Novo Addon ──────────────────────────────────────────────

  server.prompt(
    "novo_addon",
    "Adiciona um addon a uma seção existente",
    {
      projectName: z.string().describe("Nome do projeto"),
      sectionName: z.string().describe("Nome da seção"),
      addonType: z.string().describe("Tipo do addon (currency, inventory, progressionTable, etc.)"),
    },
    async ({ projectName, sectionName, addonType }) => userMsg(
      `Adicione um addon do tipo "${addonType}" na seção "${sectionName}" do projeto "${projectName}".

1. Use list_projects para encontrar o projeto
2. Use list_sections para encontrar a seção pelo nome
3. Use a tool create_${addonType.replace(/([A-Z])/g, '_$1').toLowerCase()}_addon (ou create_addon com type="${addonType}")
4. Preencha os campos com valores padrão inteligentes baseados no contexto da seção
5. Mostre o addon criado`
    ),
  );

  // ── 5. Buscar no GDD ───────────────────────────────────────────

  server.prompt(
    "buscar",
    "Busca por palavra-chave em todos os projetos e seções",
    { query: z.string().describe("Termo de busca") },
    async ({ query }) => userMsg(
      `Busque por "${query}" nos meus GDDs usando a tool search.
Mostre os resultados organizados por projeto, com o nome da seção e um trecho do conteúdo onde o termo aparece.`
    ),
  );

  // ── 6. Resumo do Projeto ───────────────────────────────────────

  server.prompt(
    "resumo_projeto",
    "Gera um resumo executivo completo do projeto",
    { projectName: z.string().describe("Nome do projeto") },
    async ({ projectName }) => userMsg(
      `Gere um resumo executivo do projeto "${projectName}" do GDD Manager.

1. Use list_projects para encontrar o projeto
2. Use get_project para carregar todas as seções e addons
3. Crie um resumo executivo com:
   - Visão geral do jogo (baseada na descrição e seções)
   - Estrutura do documento (árvore de seções)
   - Sistemas de jogo identificados (baseado nos addons: economia, inventário, progressão, etc.)
   - Estatísticas: total de seções, addons por tipo, seções vazias
   - Pontos que merecem atenção (seções sem conteúdo, addons incompletos)`
    ),
  );

  // ── 7. Analisar GDD ────────────────────────────────────────────

  server.prompt(
    "analisar_gdd",
    "Analisa o GDD em busca de inconsistências e melhorias",
    { projectName: z.string().describe("Nome do projeto") },
    async ({ projectName }) => userMsg(
      `Analise o GDD do projeto "${projectName}" em busca de problemas e oportunidades de melhoria.

1. Use list_projects para encontrar o projeto
2. Use get_project para carregar tudo
3. Analise:
   - Seções vazias ou com pouco conteúdo
   - Addons de currency/economy sem valores definidos
   - Tabelas de progressão com poucos níveis
   - Seções que mencionam conceitos sem seção própria
   - Inconsistências entre addons (ex: item referencia currency que não existe)
   - Sugestões de novas seções ou addons que fariam sentido
4. Apresente como um relatório com prioridades (crítico, importante, sugestão)`
    ),
  );
}
