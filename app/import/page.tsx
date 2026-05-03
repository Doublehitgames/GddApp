'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useProjectStore } from '@/store/projectStore';
import { useAIConfig } from '@/hooks/useAIConfig';
import AIConfigWarning from '@/components/AIConfigWarning';
import { useI18n } from '@/lib/i18n/provider';
import { toSlug } from '@/lib/utils/slug';

interface ImportedSection {
  title: string;
  content: string;
  subsections?: ImportedSection[];
}

interface ImportedProject {
  title: string;
  description: string;
  sections: ImportedSection[];
}

export default function ImportProjectPage() {
  const { hasValidConfig, getAIHeaders } = useAIConfig();
  const { locale, t } = useI18n();
  const tr = (pt: string, en: string, es: string) => {
    switch (locale) {
      case 'es':
        return es;
      case 'en':
        return en;
      default:
        return pt;
    }
  };
  const router = useRouter();
  const addProject = useProjectStore((s) => s.addProject);
  const addSection = useProjectStore((s) => s.addSection);
  const addSubsection = useProjectStore((s) => s.addSubsection);
  
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState<ImportedProject | null>(null);
  const [modificationRequest, setModificationRequest] = useState('');
  const [isModifying, setIsModifying] = useState(false);
  const [creativityLevel, setCreativityLevel] = useState<'faithful' | 'balanced' | 'creative'>('balanced');

  const isDeterministicImportFile = (selectedFile: File | null) => {
    if (!selectedFile) return false;
    const lowerName = selectedFile.name.toLowerCase();
    return (
      selectedFile.type === 'text/plain' ||
      selectedFile.type === 'text/markdown' ||
      selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.md') ||
      lowerName.endsWith('.docx')
    );
  };

  const deterministicImportMode = isDeterministicImportFile(file);

  const isRateLimitMessage = (message: string) =>
    message.includes('⏱️') ||
    message.includes('Aguarde') ||
    message.includes('Wait') ||
    message.includes('Espera');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validar tipo de arquivo
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'text/plain',
        'text/markdown'
      ];
      
      const allowedExtensions = ['.pdf', '.docx', '.txt', '.md'];
      const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
      
      if (!allowedTypes.includes(selectedFile.type) && !allowedExtensions.includes(fileExtension)) {
        setError(tr('Formato não suportado. Use .docx (Word/Google Docs), .pdf, .txt ou .md', 'Unsupported format. Use .docx (Word/Google Docs), .pdf, .txt, or .md', 'Formato no compatible. Usa .docx (Word/Google Docs), .pdf, .txt o .md'));
        setFile(null);
        return;
      }
      
      // Validar tamanho (máximo 50MB)
      const maxSize = 50 * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        setError(tr('Arquivo muito grande. Tamanho máximo: 50MB', 'File too large. Maximum size: 50MB', 'Archivo demasiado grande. Tamaño máximo: 50MB'));
        setFile(null);
        return;
      }
      
      setFile(selectedFile);
      setError('');
      setPreviewData(null);
    }
  };

  const analyzeDocument = async (additionalRequest?: string, useCreativity?: boolean, forceAI?: boolean) => {
    if (!file) return;

    setIsAnalyzing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('document', file);
      if (additionalRequest) {
        formData.append('additionalRequest', additionalRequest);
        // Se está fazendo modificação, passa o nível de criatividade
        if (useCreativity) {
          formData.append('creativityLevel', creativityLevel);
        }
      }
      if (forceAI) {
        formData.append('forceAI', '1');
      }

      const response = await fetch('/api/ai/import-project', {
        method: 'POST',
        headers: getAIHeaders(),
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // Tratamento especial para rate limit
        if (response.status === 429 || data.type === 'rate_limit') {
          setError(tr('⏱️ Limite de tokens atingido! A Groq permite ~14K tokens/min. Aguarde 1 minuto e tente novamente.', '⏱️ Token limit reached! Groq allows ~14K tokens/min. Wait 1 minute and try again.', '⏱️ ¡Límite de tokens alcanzado! Groq permite ~14K tokens/min. Espera 1 minuto e inténtalo nuevamente.'));
        } else {
          setError(data.error || tr('Erro ao analisar documento', 'Failed to analyze document', 'Error al analizar el documento'));
        }
        return;
      }

      setPreviewData(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : tr('Erro ao processar documento', 'Failed to process document', 'Error al procesar el documento');
      if (errorMsg.includes('rate_limit') || errorMsg.includes('429')) {
        setError(tr('⏱️ Limite de tokens atingido! Aguarde 1 minuto e tente novamente.', '⏱️ Token limit reached! Wait 1 minute and try again.', '⏱️ ¡Límite de tokens alcanzado! Espera 1 minuto e inténtalo nuevamente.'));
      } else {
        setError(errorMsg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = () => {
    if (!deterministicImportMode && !hasValidConfig) {
      setError(tr('Configure sua IA para importar arquivos que precisam de análise com IA.', 'Configure your AI to import files that need AI analysis.', 'Configura tu IA para importar archivos que necesitan análisis con IA.'));
      return;
    }

    analyzeDocument();
  };

  const handleAnalyzeWithAI = () => {
    if (!file) return;

    if (!hasValidConfig) {
      setError(tr('Configure sua IA para usar a análise com IA.', 'Configure your AI to use AI analysis.', 'Configura tu IA para usar el análisis con IA.'));
      return;
    }

    analyzeDocument(undefined, false, true);
  };

  const handleRequestModification = async () => {
    if (deterministicImportMode) {
      setError(tr('Neste modo sem IA, não há modificações automáticas. Ajuste o Markdown e importe novamente.', 'In no-AI mode, automatic modifications are unavailable. Adjust the Markdown and import again.', 'En modo sin IA no hay modificaciones automáticas. Ajusta el Markdown e impórtalo nuevamente.'));
      return;
    }

    if (!modificationRequest.trim()) {
      setError(tr('Digite uma solicitação de modificação', 'Type a modification request', 'Escribe una solicitud de modificación'));
      return;
    }

    setIsModifying(true);
    setError('');

    try {
      await analyzeDocument(modificationRequest, true); // true = usar criatividade
      setModificationRequest('');
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('Erro ao modificar', 'Failed to modify', 'Error al modificar'));
    } finally {
      setIsModifying(false);
    }
  };

  const handleConfirmImport = () => {
    if (!previewData) return;

    try {
      // Criar projeto
      const projectId = addProject(previewData.title, previewData.description || '');

      // Criar seções e subseções recursivamente
      const createSections = (sections: ImportedSection[], parentId?: string) => {
        sections.forEach(section => {
          let sectionId: string;

          if (parentId) {
            // É uma subseção
            sectionId = addSubsection(projectId, parentId, section.title, section.content);
          } else {
            // É uma seção principal
            sectionId = addSection(projectId, section.title, section.content);
          }

          // Se tem subseções, criar recursivamente
          if (section.subsections && section.subsections.length > 0) {
            createSections(section.subsections, sectionId);
          }
        });
      };

      createSections(previewData.sections);

      // Redirecionar para o projeto criado
      router.push(`/projects/${toSlug(previewData.title)}`);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('structural_limit')) {
        const msg = err.message === 'structural_limit_projects' ? t('limits.projects')
          : err.message === 'structural_limit_sections_per_project' ? t('limits.sectionsPerProject')
          : err.message === 'structural_limit_sections_total' ? t('limits.sectionsTotal')
          : t('limits.sectionsTotal');
        setError(msg);
      } else {
        setError(tr('Erro ao criar projeto: ', 'Failed to create project: ', 'Error al crear el proyecto: ') + (err instanceof Error ? err.message : tr('Erro desconhecido', 'Unknown error', 'Error desconocido')));
      }
    }
  };

  const handleCancel = () => {
    setPreviewData(null);
    setModificationRequest('');
  };

  const handleBack = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleBack}
            className="text-purple-600 hover:text-purple-800 mb-4 flex items-center gap-2"
          >
            ← {tr('Voltar', 'Back', 'Volver')}
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            ✨ {tr('Importar Projeto', 'Import Project', 'Importar proyecto')}
          </h1>
          <p className="text-gray-600">
            {deterministicImportMode
              ? tr('Arquivo Markdown/TXT/DOCX detectado: importação estruturada sem IA (mais rápida e sem custo de token).', 'Markdown/TXT/DOCX detected: structured import without AI (faster and no token cost).', 'Markdown/TXT/DOCX detectado: importación estructurada sin IA (más rápida y sin costo de tokens).')
              : tr('Envie seu documento e deixe a IA estruturar automaticamente em um GDD completo', 'Upload your document and let AI automatically structure it into a complete GDD', 'Sube tu documento y deja que la IA lo estructure automáticamente en un GDD completo')}
          </p>
        </div>

        {/* Verificar configuração de IA */}
        {!hasValidConfig && !deterministicImportMode && (
          <AIConfigWarning className="mb-8" />
        )}

        {!previewData ? (
          /* Upload Section */
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="space-y-6">
              {/* File Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tr('Selecione seu documento', 'Select your document', 'Selecciona tu documento')}
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.txt,.md"
                    className="hidden"
                    id="fileInput"
                  />
                  <label htmlFor="fileInput" className="cursor-pointer">
                    <div className="space-y-2">
                      <div className="text-4xl">📄</div>
                      <div className="text-sm text-gray-600">
                        {file ? (
                          <span className="text-purple-600 font-medium">{file.name}</span>
                        ) : (
                          <>
                            Clique para selecionar ou arraste um arquivo<br />
                            <span className="text-xs text-gray-500">
                              {tr('Formatos: .docx (Google Docs/Word), .pdf, .txt, .md | Máx: 50MB', 'Formats: .docx (Google Docs/Word), .pdf, .txt, .md | Max: 50MB', 'Formatos: .docx (Google Docs/Word), .pdf, .txt, .md | Máx: 50MB')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2">{tr('💡 Dica: Exportando do Google Docs', '💡 Tip: Exporting from Google Docs', '💡 Consejo: Exportando desde Google Docs')}</h3>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>{tr('Abra seu documento no Google Docs', 'Open your document in Google Docs', 'Abre tu documento en Google Docs')}</li>
                    <li>{tr('Vá em Arquivo → Fazer download → Microsoft Word (.docx)', 'Go to File → Download → Microsoft Word (.docx)', 'Ve a Archivo → Descargar → Microsoft Word (.docx)')}</li>
                    <li>{tr('Faça upload do arquivo .docx aqui', 'Upload the .docx file here', 'Sube aquí el archivo .docx')}</li>
                  </ol>
                </div>
                {!deterministicImportMode && (
                  <div className="border-t border-blue-200 pt-3">
                    <h3 className="font-semibold text-amber-900 mb-2">{tr('⏱️ Sobre Limites de Tokens', '⏱️ About Token Limits', '⏱️ Sobre límites de tokens')}</h3>
                    <p className="text-sm text-amber-800">
                      {tr('A Groq (IA gratuita) permite ~14K tokens/minuto. Documentos grandes podem atingir esse limite. Se isso acontecer, aguarde 1 minuto e tente novamente.', 'Groq (free AI) allows ~14K tokens/minute. Large documents may hit this limit. If that happens, wait 1 minute and try again.', 'Groq (IA gratuita) permite ~14K tokens/minuto. Los documentos grandes pueden alcanzar este límite. Si eso ocurre, espera 1 minuto e inténtalo de nuevo.')}
                    </p>
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className={`border rounded-lg p-4 ${
                  isRateLimitMessage(error)
                    ? 'bg-amber-50 border-amber-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <p className={`text-sm ${
                    isRateLimitMessage(error)
                      ? 'text-amber-800'
                      : 'text-red-800'
                  }`}>{error}</p>
                </div>
              )}

              {deterministicImportMode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={handleAnalyze}
                    disabled={!file || isAnalyzing}
                    className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isAnalyzing
                      ? tr('⏳ Importando...', '⏳ Importing...', '⏳ Importando...')
                      : tr('📑 Importar e Estruturar (sem IA)', '📑 Import and Structure (no AI)', '📑 Importar y estructurar (sin IA)')}
                  </button>
                  <button
                    onClick={handleAnalyzeWithAI}
                    disabled={!file || isAnalyzing}
                    className="w-full py-3 px-4 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white rounded-lg font-medium hover:from-fuchsia-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isAnalyzing
                      ? tr('⏳ Analisando com IA...', '⏳ Analyzing with AI...', '⏳ Analizando con IA...')
                      : tr('🤖 Analisar e Estruturar com IA', '🤖 Analyze and Structure with AI', '🤖 Analizar y estructurar con IA')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAnalyze}
                  disabled={!file || isAnalyzing}
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isAnalyzing ? (
                    <>{tr('⏳ Analisando documento...', '⏳ Analyzing document...', '⏳ Analizando documento...')}</>
                  ) : (
                    <>{tr('🚀 Analisar e Estruturar com IA', '🚀 Analyze and Structure with AI', '🚀 Analizar y estructurar con IA')}</>
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Preview Section */
          <div className="space-y-6">
            {/* Project Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{previewData.title}</h2>
              <div className="text-gray-600">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw as any]}>
                  {previewData.description || ''}
                </ReactMarkdown>
              </div>
            </div>

            {/* Sections Preview */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📑 {tr('Estrutura Proposta', 'Proposed Structure', 'Estructura propuesta')}</h3>
              <div className="space-y-4">
                {previewData.sections.map((section, idx) => (
                  <div key={idx} className="border-l-4 border-purple-400 pl-4">
                    <h4 className="font-semibold text-gray-900">{section.title}</h4>
                    <div className="text-sm text-gray-600 mt-1 max-h-32 overflow-auto">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw as any]}>
                        {section.content || ''}
                      </ReactMarkdown>
                    </div>
                    {section.subsections && section.subsections.length > 0 && (
                      <div className="mt-2 ml-4 space-y-2">
                        {section.subsections.map((sub, subIdx) => (
                          <div key={subIdx} className="border-l-2 border-blue-300 pl-3">
                            <h5 className="text-sm font-medium text-gray-700">{sub.title}</h5>
                            <div className="text-xs text-gray-500 max-h-24 overflow-auto">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw as any]}>
                                {sub.content || ''}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {!deterministicImportMode && (
              <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {tr('Solicitar modificações (opcional)', 'Request changes (optional)', 'Solicitar cambios (opcional)')}
                  </label>
                  <textarea
                    value={modificationRequest}
                    onChange={(e) => setModificationRequest(e.target.value)}
                    placeholder={tr('Ex: Adicionar seção de Multiplayer, reorganizar seções...', 'Ex: Add Multiplayer section, reorganize sections...', 'Ej: Agregar sección de Multijugador, reorganizar secciones...')}
                    className="w-full p-3 border border-gray-300 rounded-lg resize-none text-gray-900 placeholder-gray-400"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {tr('Nível de Criatividade da IA nas Modificações', 'AI Creativity Level for Modifications', 'Nivel de creatividad de la IA en las modificaciones')}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setCreativityLevel('faithful')}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        creativityLevel === 'faithful'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-1">📋</div>
                        <div className="font-semibold text-sm text-gray-900">{tr('Fiel', 'Faithful', 'Fiel')}</div>
                        <div className="text-xs text-gray-600">{tr('Mantém conteúdo original', 'Keeps original content', 'Mantiene el contenido original')}</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setCreativityLevel('balanced')}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        creativityLevel === 'balanced'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-300 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-1">⚖️</div>
                        <div className="font-semibold text-sm text-gray-900">{tr('Balanceado', 'Balanced', 'Equilibrado')}</div>
                        <div className="text-xs text-gray-600">{tr('Ajustes moderados', 'Moderate changes', 'Ajustes moderados')}</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setCreativityLevel('creative')}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        creativityLevel === 'creative'
                          ? 'border-pink-500 bg-pink-50'
                          : 'border-gray-300 hover:border-pink-300'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-1">✨</div>
                        <div className="font-semibold text-sm text-gray-900">{tr('Criativo', 'Creative', 'Creativo')}</div>
                        <div className="text-xs text-gray-600">{tr('Liberdade para criar', 'Freedom to create', 'Libertad para crear')}</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleCancel}
                className="flex-1 py-3 px-4 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                ✕ {tr('Cancelar', 'Cancel', 'Cancelar')}
              </button>
              {!deterministicImportMode && (
                <button
                  onClick={handleRequestModification}
                  disabled={isModifying || !modificationRequest.trim()}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isModifying ? tr('⏳ Modificando...', '⏳ Modifying...', '⏳ Modificando...') : tr('🔄 Modificar', '🔄 Modify', '🔄 Modificar')}
                </button>
              )}
              <button
                onClick={handleConfirmImport}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all"
              >
                ✓ {tr('Confirmar e Criar Projeto', 'Confirm and Create Project', 'Confirmar y crear proyecto')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
