// app/api/ai/execute-tool/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface ProjectContext {
  projectId: string;
  projectTitle: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
    parentId?: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const { toolName, arguments: args, projectContext } = await req.json() as {
      toolName: string;
      arguments: any;
      projectContext: ProjectContext;
    };

    // As ferramentas serão executadas no cliente (via Zustand store)
    // Esta API apenas valida e retorna instruções
    
    switch (toolName) {
      case 'add_section':
        return NextResponse.json({
          success: true,
          action: 'add_section',
          data: {
            title: args.title,
            content: args.content,
            parentId: args.parentId,
          },
          message: `✅ Seção **"${args.title}"** criada com sucesso! 🎉`,
        });

      case 'edit_section':
        const sectionToEdit = projectContext.sections.find(s => s.id === args.sectionId);
        if (!sectionToEdit) {
          return NextResponse.json({
            success: false,
            message: `❌ Seção com ID ${args.sectionId} não encontrada.`,
          });
        }
        return NextResponse.json({
          success: true,
          action: 'edit_section',
          data: {
            sectionId: args.sectionId,
            title: args.title || sectionToEdit.title,
            content: args.content,
          },
          message: `✅ Seção **"${sectionToEdit.title}"** atualizada! 📝`,
        });

      case 'remove_section':
        const sectionToRemove = projectContext.sections.find(s => s.id === args.sectionId);
        if (!sectionToRemove) {
          return NextResponse.json({
            success: false,
            message: `❌ Seção com ID ${args.sectionId} não encontrada.`,
          });
        }
        return NextResponse.json({
          success: true,
          action: 'remove_section',
          data: {
            sectionId: args.sectionId,
          },
          message: `✅ Seção **"${sectionToRemove.title}"** removida. 🗑️`,
        });

      case 'list_sections':
        const sectionsList = projectContext.sections
          .map((s, i) => `${i + 1}. **${s.title}** (ID: \`${s.id}\`)`)
          .join('\n');
        return NextResponse.json({
          success: true,
          action: 'list_sections',
          data: { sections: projectContext.sections },
          message: `📋 **Seções do projeto:**\n\n${sectionsList}`,
        });

      default:
        return NextResponse.json({
          success: false,
          message: `❌ Ferramenta "${toolName}" não reconhecida.`,
        });
    }

  } catch (error) {
    console.error('Error executing tool:', error);
    return NextResponse.json(
      { 
        success: false,
        message: '❌ Erro ao executar ferramenta.' 
      },
      { status: 500 }
    );
  }
}
