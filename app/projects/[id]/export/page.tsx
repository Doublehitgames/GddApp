'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProjectStore, Project, Section } from '@/store/projectStore';
import { useI18n } from '@/lib/i18n/provider';
import { buildUnityExport } from '@/lib/balance/unityExport';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { resolveProjectSpecialTokensForProject } from '@/lib/addons/projectSpecialTokens';
import {
  extractSectionRichDocMarkdown,
  sectionHasExportableContent,
} from '@/lib/richDoc/exportSection';

type ExportFormat = 'markdown' | 'pdf' | 'word' | 'unityJson';

export default function ExportPage() {
  const { t } = useI18n();
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
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  const resolveExportContent = (value?: string, sectionId?: string) => {
    if (!value) return "";
    return resolveProjectSpecialTokensForProject(value, project, sectionId);
  };

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
  const exportMarkdown = async () => {
    const { saveAs } = await import(/* webpackChunkName: "file-saver" */ 'file-saver');
    const hierarchy = getSectionsHierarchy();
    let markdown = `# ${project.title}\n\n`;

    if (project.description) {
      markdown += `${resolveExportContent(project.description)}\n\n---\n\n`;
    }

    const renderSection = (section: Section & { subsections?: Section[] }, level: number) => {
      if (!sectionHasExportableContent(section) && !includeEmptySections) return '';

      let md = '';
      const headerPrefix = '#'.repeat(level + 1);
      md += `${headerPrefix} ${section.title}\n\n`;

      if (section.content) {
        md += `${resolveExportContent(section.content, section.id)}\n\n`;
      }

      const richDocMd = extractSectionRichDocMarkdown(section);
      if (richDocMd) {
        md += `${richDocMd}\n\n`;
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
  const exportPDF = async () => {
    const { jsPDF } = await import(/* webpackChunkName: "jspdf" */ 'jspdf');
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

    // Titulo
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(project.title, margin, yPosition);
    yPosition += 15;

    // Descricao
    if (project.description) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const descLines = doc.splitTextToSize(resolveExportContent(project.description), 170);
      checkPageBreak(descLines.length * lineHeight);
      doc.text(descLines, margin, yPosition);
      yPosition += descLines.length * lineHeight + 10;
    }

    const hierarchy = getSectionsHierarchy();

    const renderSection = (section: Section & { subsections?: Section[] }, level: number) => {
      if (!sectionHasExportableContent(section) && !includeEmptySections) return;

      checkPageBreak(15);

      // Titulo da secao
      const fontSize = level === 1 ? 16 : level === 2 ? 14 : 12;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'bold');
      const indent = margin + (level - 1) * 10;
      doc.text(section.title, indent, yPosition);
      yPosition += 10;

      // Conteudo
      if (section.content) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const contentLines = doc.splitTextToSize(resolveExportContent(section.content, section.id), 170 - (level - 1) * 10);

        contentLines.forEach((line: string) => {
          checkPageBreak(lineHeight);
          doc.text(line, indent, yPosition);
          yPosition += lineHeight;
        });

        yPosition += 5;
      }

      // RichDoc addons (rendered as raw markdown text — PDF output is
      // text-only so headings/bold/etc. appear as plain ASCII).
      const richDocMd = extractSectionRichDocMarkdown(section);
      if (richDocMd) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(richDocMd, 170 - (level - 1) * 10);
        lines.forEach((line: string) => {
          checkPageBreak(lineHeight);
          doc.text(line, indent, yPosition);
          yPosition += lineHeight;
        });
        yPosition += 5;
      }

      // Subsecoes
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
    const { Document, Packer, Paragraph, HeadingLevel, AlignmentType } = await import(/* webpackChunkName: "docx" */ 'docx');
    const { saveAs } = await import(/* webpackChunkName: "file-saver" */ 'file-saver');
    const hierarchy = getSectionsHierarchy();
    const children: any[] = [];

    // Titulo
    children.push(
      new Paragraph({
        text: project.title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );

    // Descricao
    if (project.description) {
      children.push(
        new Paragraph({
          text: resolveExportContent(project.description),
          spacing: { after: 400 }
        })
      );
    }

    const renderSection = (section: Section & { subsections?: Section[] }, level: number) => {
      if (!sectionHasExportableContent(section) && !includeEmptySections) return;

      // Titulo da secao
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

      // Conteudo
      if (section.content) {
        const paragraphs = resolveExportContent(section.content, section.id).split('\n\n');
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

      // RichDoc addons — emit each markdown paragraph as a Word paragraph.
      const richDocMd = extractSectionRichDocMarkdown(section);
      if (richDocMd) {
        richDocMd.split('\n\n').forEach(para => {
          const trimmed = para.trim();
          if (!trimmed) return;
          children.push(
            new Paragraph({
              text: trimmed,
              spacing: { after: 200 }
            })
          );
        });
      }

      // Subsecoes
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

  const exportUnityJson = async () => {
    const { saveAs } = await import(/* webpackChunkName: "file-saver" */ 'file-saver');
    const payload = buildUnityExport(project);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    saveAs(blob, `${project.title}.unity-export.v1.json`);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      switch (selectedFormat) {
        case 'markdown':
          await exportMarkdown();
          break;
        case 'pdf':
          await exportPDF();
          break;
        case 'word':
          await exportWord();
          break;
        case 'unityJson':
          await exportUnityJson();
          break;
      }

      // Aguardar um pouco para o download comecar
      setTimeout(() => {
        router.push(`/projects/${projectId}`);
      }, 1000);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert(t('projectExport.errors.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  const formatLabel =
    selectedFormat === 'markdown'
      ? t('projectExport.formats.markdown.label')
      : selectedFormat === 'pdf'
        ? t('projectExport.formats.pdf.label')
        : selectedFormat === 'word'
          ? t('projectExport.formats.word.label')
          : t('projectExport.formats.unityJson.label', 'Unity JSON');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="text-purple-600 hover:text-purple-800 mb-4 flex items-center gap-2"
          >
            ← {t('projectExport.backToProject')}
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            📤 {t('projectExport.title')}
          </h1>
          <p className="text-gray-600">
            {t('projectExport.subtitlePrefix')} <strong>{project.title}</strong>
          </p>
        </div>

        {/* Format Selection */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('projectExport.selectFormat')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                <div className="font-semibold text-gray-900 mb-1">{t('projectExport.formats.markdown.label')}</div>
                <div className="text-xs text-gray-600">
                  {t('projectExport.formats.markdown.description')}
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
                <div className="font-semibold text-gray-900 mb-1">{t('projectExport.formats.pdf.label')}</div>
                <div className="text-xs text-gray-600">
                  {t('projectExport.formats.pdf.description')}
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
                <div className="font-semibold text-gray-900 mb-1">{t('projectExport.formats.word.label')}</div>
                <div className="text-xs text-gray-600">
                  {t('projectExport.formats.word.description')}
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedFormat('unityJson')}
              className={`p-6 rounded-lg border-2 transition-all ${
                selectedFormat === 'unityJson'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-300 hover:border-emerald-300'
              }`}
            >
              <div className="text-center">
                <div className="text-4xl mb-2">🎮</div>
                <div className="font-semibold text-gray-900 mb-1">{t('projectExport.formats.unityJson.label', 'Unity JSON')}</div>
                <div className="text-xs text-gray-600">
                  {t('projectExport.formats.unityJson.description', 'Tabela de balanceamento por level para integrar na engine.')}
                </div>
              </div>
            </button>
          </div>

          {/* Options */}
          <div className="border-t pt-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <ToggleSwitch
                checked={includeEmptySections}
                onChange={setIncludeEmptySections}
                ariaLabel={t('projectExport.includeEmptySections')}
              />
              {t('projectExport.includeEmptySections')}
            </label>
          </div>
        </div>

        {/* Preview Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">ℹ️ {t('projectExport.infoTitle')}</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>{t('projectExport.formats.markdown.label')}:</strong> {t('projectExport.info.markdown')}</li>
            <li>• <strong>{t('projectExport.formats.pdf.label')}:</strong> {t('projectExport.info.pdf')}</li>
            <li>• <strong>{t('projectExport.formats.word.label')}:</strong> {t('projectExport.info.word')}</li>
            <li>• <strong>{t('projectExport.formats.unityJson.label', 'Unity JSON')}:</strong> {t('projectExport.info.unityJson', 'Exporta curvas calculadas LV -> XP para uso direto na engine')}</li>
          </ul>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
        >
          {isExporting ? (
            <>⏳ {t('projectExport.exporting')}</>
          ) : (
            <>📥 {t('projectExport.exportAs')} {formatLabel}</>
          )}
        </button>
      </div>
    </div>
  );
}
