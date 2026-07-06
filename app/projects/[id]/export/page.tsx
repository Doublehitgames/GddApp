'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProjectStore, Project, Section } from '@/store/projectStore';
import { useI18n } from '@/lib/i18n/provider';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { resolveProjectSpecialTokensForProject } from '@/lib/addons/projectSpecialTokens';
import {
  extractSectionRichDocMarkdown,
  sectionHasExportableContent,
} from '@/lib/richDoc/exportSection';
import {
  collectEconomyConfigs,
  listEconomyConfigs,
} from '@/lib/addons/economySnapshot';

type ExportFormat = 'markdown' | 'pdf' | 'word' | 'economy';

function sanitizeFilename(name: string): string {
  return (name || 'export').replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'export';
}

/**
 * Trigger a browser download for a Blob without the `file-saver` dependency
 * (its `saveAs` export doesn't resolve in this build). Mirrors the Remote
 * Config panel's own download handler.
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const getProjectBySlug = useProjectStore((s) => s.getProjectBySlug);
  const projects = useProjectStore((s) => s.projects);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [includeEmptySections, setIncludeEmptySections] = useState(false);
  const [selectedConfigIds, setSelectedConfigIds] = useState<string[]>([]);

  const project = useMemo(() => getProjectBySlug(projectId), [getProjectBySlug, projectId, projects]);
  const realProjectId = project?.id ?? "";

  const economyConfigs = useMemo(
    () => (realProjectId ? listEconomyConfigs(projects, realProjectId) : []),
    [projects, realProjectId]
  );

  // Default to "all selected". Re-syncs if configs are added/removed, dropping
  // stale ids and keeping the user's picks among the ones that still exist.
  useEffect(() => {
    const ids = economyConfigs.map((c) => c.addonId);
    setSelectedConfigIds((prev) => {
      if (prev.length === 0) return ids;
      const known = new Set(ids);
      const kept = prev.filter((id) => known.has(id));
      return kept.length === prev.length ? prev : kept.length ? kept : ids;
    });
  }, [economyConfigs]);

  const toggleConfig = (addonId: string) =>
    setSelectedConfigIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );

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
    downloadBlob(blob, `${sanitizeFilename(project.title)}.md`);
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
    downloadBlob(blob, `${sanitizeFilename(project.title)}.docx`);
  };

  // Exportar economia (Remote Configs resolvidos) como JSON
  const exportEconomy = async () => {
    if (selectedConfigIds.length === 0) {
      alert(
        t('projectExport.economy.empty', 'Selecione ao menos um Remote Config para exportar.')
      );
      return;
    }

    const configs = collectEconomyConfigs(projects, realProjectId, {
      addonIds: selectedConfigIds,
    });

    if (configs.length === 0) {
      alert(t('projectExport.economy.empty', 'Nenhum Remote Config encontrado.'));
      return;
    }

    const allSelected = selectedConfigIds.length >= economyConfigs.length;
    const snapshot = {
      project: project.title,
      scope: allSelected
        ? t('projectExport.economy.wholeEconomy', 'Economia inteira')
        : t('projectExport.economy.customScope', 'Seleção personalizada'),
      exportedAt: new Date().toISOString(),
      configCount: configs.length,
      configs,
    };

    const suffix = allSelected ? 'economia' : `economia_${configs.length}`;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${sanitizeFilename(project.title)}_${suffix}.json`);
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
        case 'economy':
          await exportEconomy();
          break;
      }

      // Aguardar um pouco para o download comecar. A economia mantem o usuario
      // na pagina (ele pode querer exportar varios escopos em sequencia).
      if (selectedFormat !== 'economy') {
        setTimeout(() => {
          router.push(`/projects/${projectId}`);
        }, 1000);
      }
    } catch (error) {
      console.error('Erro ao exportar:', error);
      const detail = error instanceof Error ? `${error.message}` : String(error);
      alert(`${t('projectExport.errors.exportFailed')}\n\n${detail}`);
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
          : t('projectExport.formats.economy.label', 'Economia (JSON)');

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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

            {/* Economia (Remote Config JSON) */}
            <button
              onClick={() => setSelectedFormat('economy')}
              className={`p-6 rounded-lg border-2 transition-all ${
                selectedFormat === 'economy'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-300 hover:border-emerald-300'
              }`}
            >
              <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <div className="font-semibold text-gray-900 mb-1">
                  {t('projectExport.formats.economy.label', 'Economia (JSON)')}
                </div>
                <div className="text-xs text-gray-600">
                  {t(
                    'projectExport.formats.economy.description',
                    'Remote Configs resolvidos, prontos pra dar a um agente externo'
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* Options */}
          <div className="border-t pt-4">
            {selectedFormat === 'economy' ? (
              <div className="text-sm text-gray-700">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {t('projectExport.economy.scopeLabel', 'O que exportar')}{' '}
                    <span className="text-gray-500">
                      ({selectedConfigIds.length}/{economyConfigs.length})
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedConfigIds(economyConfigs.map((c) => c.addonId))}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                    >
                      {t('projectExport.economy.selectAll', 'Marcar tudo')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedConfigIds([])}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                    >
                      {t('projectExport.economy.clear', 'Limpar')}
                    </button>
                  </div>
                </div>
                {economyConfigs.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-500">
                    {t('projectExport.economy.none', 'Este projeto nao tem Remote Configs.')}
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                    {economyConfigs.map((c) => (
                      <label
                        key={c.addonId}
                        className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-gray-50"
                        style={{ paddingLeft: (12 + c.depth * 16) + 'px' }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedConfigIds.includes(c.addonId)}
                          onChange={() => toggleConfig(c.addonId)}
                          className="h-4 w-4 shrink-0 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          <span className="text-gray-900">{c.sectionTitle}</span>
                          {c.addonName && c.addonName !== c.sectionTitle && (
                            <span className="text-gray-400"> - {c.addonName}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <span className="mt-1.5 block text-xs text-gray-500">
                  {t(
                    'projectExport.economy.scopeHint',
                    'Baixa um .json so com os Remote Configs marcados. Entregue esse arquivo a um agente (ex: ChatGPT) para analisar o balanceamento.'
                  )}
                </span>
              </div>
            ) : (
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <ToggleSwitch
                  checked={includeEmptySections}
                  onChange={setIncludeEmptySections}
                  ariaLabel={t('projectExport.includeEmptySections')}
                />
                {t('projectExport.includeEmptySections')}
              </label>
            )}
          </div>
        </div>

        {/* Preview Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">ℹ️ {t('projectExport.infoTitle')}</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>{t('projectExport.formats.markdown.label')}:</strong> {t('projectExport.info.markdown')}</li>
            <li>• <strong>{t('projectExport.formats.pdf.label')}:</strong> {t('projectExport.info.pdf')}</li>
            <li>• <strong>{t('projectExport.formats.word.label')}:</strong> {t('projectExport.info.word')}</li>
            <li>• <strong>{t('projectExport.formats.economy.label', 'Economia (JSON)')}:</strong> {t('projectExport.info.economy', 'Junta todos os Remote Configs resolvidos num arquivo pra dar a um agente externo balancear.')}</li>
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
