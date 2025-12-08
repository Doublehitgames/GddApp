'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProjectStore, Project, Section } from '@/store/projectStore';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

type ExportFormat = 'markdown' | 'pdf' | 'word';

export default function ExportPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const getProject = useProjectStore((s) => s.getProject);
  const [project, setProject] = useState<Project | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [includeEmptySections, setIncludeEmptySections] = useState(false);
  
  useEffect(() => {
    const proj = getProject(projectId);
    if (proj) {
      setProject(proj);
    }
  }, [projectId, getProject]);

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Carregando projeto...</p>
        </div>
      </div>
    );
  }

  const getSectionsHierarchy = () => {
    const sections = project.sections || [];
    const rootSections = sections.filter(s => !s.parentId);
    
    const buildHierarchy = (parentId?: string): Section[] => {
      return sections
        .filter(s => s.parentId === parentId)
        .sort((a, b) => a.order - b.order);
    };

    return rootSections.map(section => ({
      ...section,
      subsections: buildHierarchy(section.id)
    }));
  };

  // Exportar como Markdown
  const exportMarkdown = () => {
    const hierarchy = getSectionsHierarchy();
    let markdown = `# ${project.title}\n\n`;
    
    if (project.description) {
      markdown += `${project.description}\n\n---\n\n`;
    }

    const renderSection = (section: Section & { subsections?: Section[] }, level: number) => {
      const isEmpty = !section.content || section.content.trim().length === 0;
      if (isEmpty && !includeEmptySections) return '';

      let md = '';
      const headerPrefix = '#'.repeat(level + 1);
      md += `${headerPrefix} ${section.title}\n\n`;
      
      if (section.content) {
        md += `${section.content}\n\n`;
      }

      if (section.subsections) {
        section.subsections.forEach(sub => {
          md += renderSection(sub, level + 1);
        });
      }

      return md;
    };

    hierarchy.forEach(section => {
      markdown += renderSection({ ...section, subsections: (section as any).subsections }, 1);
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    saveAs(blob, `${project.title}.md`);
  };

  // Exportar como PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    let yPosition = 20;
    const lineHeight = 7;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;

    const checkPageBreak = (neededSpace: number) => {
      if (yPosition + neededSpace > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
    };

    // Título
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(project.title, margin, yPosition);
    yPosition += 15;

    // Descrição
    if (project.description) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const descLines = doc.splitTextToSize(project.description, 170);
      checkPageBreak(descLines.length * lineHeight);
      doc.text(descLines, margin, yPosition);
      yPosition += descLines.length * lineHeight + 10;
    }

    const hierarchy = getSectionsHierarchy();

    const renderSection = (section: Section & { subsections?: Section[] }, level: number) => {
      const isEmpty = !section.content || section.content.trim().length === 0;
      if (isEmpty && !includeEmptySections) return;

      checkPageBreak(15);

      // Título da seção
      const fontSize = level === 1 ? 16 : level === 2 ? 14 : 12;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'bold');
      const indent = margin + (level - 1) * 10;
      doc.text(section.title, indent, yPosition);
      yPosition += 10;

      // Conteúdo
      if (section.content) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const contentLines = doc.splitTextToSize(section.content, 170 - (level - 1) * 10);
        
        contentLines.forEach((line: string) => {
          checkPageBreak(lineHeight);
          doc.text(line, indent, yPosition);
          yPosition += lineHeight;
        });
        
        yPosition += 5;
      }

      // Subseções
      if (section.subsections) {
        section.subsections.forEach(sub => {
          renderSection(sub, level + 1);
        });
      }
    };

    hierarchy.forEach(section => {
      renderSection({ ...section, subsections: (section as any).subsections }, 1);
    });

    doc.save(`${project.title}.pdf`);
  };

  // Exportar como Word
  const exportWord = async () => {
    const hierarchy = getSectionsHierarchy();
    const children: any[] = [];

    // Título
    children.push(
      new Paragraph({
        text: project.title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );

    // Descrição
    if (project.description) {
      children.push(
        new Paragraph({
          text: project.description,
          spacing: { after: 400 }
        })
      );
    }

    const renderSection = (section: Section & { subsections?: Section[] }, level: number) => {
      const isEmpty = !section.content || section.content.trim().length === 0;
      if (isEmpty && !includeEmptySections) return;

      // Título da seção
      const headingLevel = level === 1 ? HeadingLevel.HEADING_1 : 
                          level === 2 ? HeadingLevel.HEADING_2 : 
                          HeadingLevel.HEADING_3;

      children.push(
        new Paragraph({
          text: section.title,
          heading: headingLevel,
          spacing: { before: 200, after: 200 }
        })
      );

      // Conteúdo
      if (section.content) {
        const paragraphs = section.content.split('\n\n');
        paragraphs.forEach(para => {
          if (para.trim()) {
            children.push(
              new Paragraph({
                text: para,
                spacing: { after: 200 }
              })
            );
          }
        });
      }

      // Subseções
      if (section.subsections) {
        section.subsections.forEach(sub => {
          renderSection(sub, level + 1);
        });
      }
    };

    hierarchy.forEach(section => {
      renderSection({ ...section, subsections: (section as any).subsections }, 1);
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${project.title}.docx`);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      switch (selectedFormat) {
        case 'markdown':
          exportMarkdown();
          break;
        case 'pdf':
          exportPDF();
          break;
        case 'word':
          await exportWord();
          break;
      }
      
      // Aguardar um pouco para o download começar
      setTimeout(() => {
        router.push(`/projects/${projectId}`);
      }, 1000);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao exportar o documento. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="text-purple-600 hover:text-purple-800 mb-4 flex items-center gap-2"
          >
            ← Voltar ao Projeto
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            📤 Exportar GDD
          </h1>
          <p className="text-gray-600">
            Escolha o formato para exportar: <strong>{project.title}</strong>
          </p>
        </div>

        {/* Format Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Selecione o Formato</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Markdown */}
            <button
              onClick={() => setSelectedFormat('markdown')}
              className={`p-6 rounded-lg border-2 transition-all ${
                selectedFormat === 'markdown'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-blue-300'
              }`}
            >
              <div className="text-center">
                <div className="text-4xl mb-2">📝</div>
                <div className="font-semibold text-gray-900 mb-1">Markdown</div>
                <div className="text-xs text-gray-600">
                  Texto simples, editável, portável (.md)
                </div>
              </div>
            </button>

            {/* PDF */}
            <button
              onClick={() => setSelectedFormat('pdf')}
              className={`p-6 rounded-lg border-2 transition-all ${
                selectedFormat === 'pdf'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-300 hover:border-purple-300'
              }`}
            >
              <div className="text-center">
                <div className="text-4xl mb-2">📄</div>
                <div className="font-semibold text-gray-900 mb-1">PDF</div>
                <div className="text-xs text-gray-600">
                  Documento formatado, pronto para compartilhar (.pdf)
                </div>
              </div>
            </button>

            {/* Word */}
            <button
              onClick={() => setSelectedFormat('word')}
              className={`p-6 rounded-lg border-2 transition-all ${
                selectedFormat === 'word'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-300 hover:border-indigo-300'
              }`}
            >
              <div className="text-center">
                <div className="text-4xl mb-2">📘</div>
                <div className="font-semibold text-gray-900 mb-1">Word</div>
                <div className="text-xs text-gray-600">
                  Editável no Microsoft Word (.docx)
                </div>
              </div>
            </button>
          </div>

          {/* Options */}
          <div className="border-t pt-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeEmptySections}
                onChange={(e) => setIncludeEmptySections(e.target.checked)}
                className="w-4 h-4"
              />
              Incluir seções vazias
            </label>
          </div>
        </div>

        {/* Preview Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Informações</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Markdown:</strong> Melhor para edição e versionamento (Git)</li>
            <li>• <strong>PDF:</strong> Melhor para apresentação e compartilhamento</li>
            <li>• <strong>Word:</strong> Melhor para edição colaborativa</li>
          </ul>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
        >
          {isExporting ? (
            <>⏳ Exportando...</>
          ) : (
            <>📥 Exportar como {selectedFormat === 'markdown' ? 'Markdown' : selectedFormat === 'pdf' ? 'PDF' : 'Word'}</>
          )}
        </button>
      </div>
    </div>
  );
}
