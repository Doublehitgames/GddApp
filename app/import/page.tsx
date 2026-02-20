'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/store/projectStore';
import { useAIConfig } from '@/hooks/useAIConfig';
import AIConfigWarning from '@/components/AIConfigWarning';

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
        setError('Formato não suportado. Use .docx (Word/Google Docs), .pdf, .txt ou .md');
        setFile(null);
        return;
      }
      
      // Validar tamanho (máximo 50MB)
      const maxSize = 50 * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        setError('Arquivo muito grande. Tamanho máximo: 50MB');
        setFile(null);
        return;
      }
      
      setFile(selectedFile);
      setError('');
      setPreviewData(null);
    }
  };

  const analyzeDocument = async (additionalRequest?: string, useCreativity?: boolean) => {
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

      const response = await fetch('/api/ai/import-project', {
        method: 'POST',
        headers: getAIHeaders(),
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // Tratamento especial para rate limit
        if (response.status === 429 || data.type === 'rate_limit') {
          setError('⏱️ Limite de tokens atingido! A Groq permite ~14K tokens/min. Aguarde 1 minuto e tente novamente.');
        } else {
          setError(data.error || 'Erro ao analisar documento');
        }
        return;
      }

      setPreviewData(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao processar documento';
      if (errorMsg.includes('rate_limit') || errorMsg.includes('429')) {
        setError('⏱️ Limite de tokens atingido! Aguarde 1 minuto e tente novamente.');
      } else {
        setError(errorMsg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = () => {
    analyzeDocument();
  };

  const handleRequestModification = async () => {
    if (!modificationRequest.trim()) {
      setError('Digite uma solicitação de modificação');
      return;
    }

    setIsModifying(true);
    setError('');

    try {
      await analyzeDocument(modificationRequest, true); // true = usar criatividade
      setModificationRequest('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao modificar');
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
      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError('Erro ao criar projeto: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
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
            ← Voltar
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            ✨ Importar Projeto com IA
          </h1>
          <p className="text-gray-600">
            Envie seu documento e deixe a IA estruturar automaticamente em um GDD completo
          </p>
        </div>

        {/* Verificar configuração de IA */}
        {!hasValidConfig && (
          <AIConfigWarning className="mb-8" />
        )}
            Faça upload de um documento e deixe a IA estruturar automaticamente seu GDD
          </p>
        </div>

        {!previewData ? (
          /* Upload Section */
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="space-y-6">
              {/* File Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selecione seu documento
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
                              Formatos: .docx (Google Docs/Word), .pdf, .txt, .md | Máx: 50MB
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
                  <h3 className="font-semibold text-blue-900 mb-2">💡 Dica: Exportando do Google Docs</h3>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Abra seu documento no Google Docs</li>
                    <li>Vá em Arquivo → Fazer download → Microsoft Word (.docx)</li>
                    <li>Faça upload do arquivo .docx aqui</li>
                  </ol>
                </div>
                <div className="border-t border-blue-200 pt-3">
                  <h3 className="font-semibold text-amber-900 mb-2">⏱️ Sobre Limites de Tokens</h3>
                  <p className="text-sm text-amber-800">
                    A Groq (IA gratuita) permite ~14K tokens/minuto. Documentos grandes podem atingir esse limite. 
                    Se isso acontecer, aguarde 1 minuto e tente novamente.
                  </p>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className={`border rounded-lg p-4 ${
                  error.includes('⏱️') || error.includes('Aguarde') 
                    ? 'bg-amber-50 border-amber-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <p className={`text-sm ${
                    error.includes('⏱️') || error.includes('Aguarde')
                      ? 'text-amber-800'
                      : 'text-red-800'
                  }`}>{error}</p>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleAnalyze}
                disabled={!file || isAnalyzing}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isAnalyzing ? (
                  <>⏳ Analisando documento...</>
                ) : (
                  <>🚀 Analisar e Estruturar com IA</>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Preview Section */
          <div className="space-y-6">
            {/* Project Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{previewData.title}</h2>
              <p className="text-gray-600">{previewData.description}</p>
            </div>

            {/* Sections Preview */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📑 Estrutura Proposta</h3>
              <div className="space-y-4">
                {previewData.sections.map((section, idx) => (
                  <div key={idx} className="border-l-4 border-purple-400 pl-4">
                    <h4 className="font-semibold text-gray-900">{section.title}</h4>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{section.content}</p>
                    {section.subsections && section.subsections.length > 0 && (
                      <div className="mt-2 ml-4 space-y-2">
                        {section.subsections.map((sub, subIdx) => (
                          <div key={subIdx} className="border-l-2 border-blue-300 pl-3">
                            <h5 className="text-sm font-medium text-gray-700">{sub.title}</h5>
                            <p className="text-xs text-gray-500 line-clamp-1">{sub.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modification Request */}
            <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Solicitar modificações (opcional)
                </label>
                <textarea
                  value={modificationRequest}
                  onChange={(e) => setModificationRequest(e.target.value)}
                  placeholder="Ex: Adicionar seção de Multiplayer, reorganizar seções..."
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none text-gray-900 placeholder-gray-400"
                  rows={3}
                />
              </div>

              {/* Creativity Level Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Nível de Criatividade da IA nas Modificações
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
                      <div className="font-semibold text-sm text-gray-900">Fiel</div>
                      <div className="text-xs text-gray-600">Mantém conteúdo original</div>
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
                      <div className="font-semibold text-sm text-gray-900">Balanceado</div>
                      <div className="text-xs text-gray-600">Ajustes moderados</div>
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
                      <div className="font-semibold text-sm text-gray-900">Criativo</div>
                      <div className="text-xs text-gray-600">Liberdade para criar</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

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
                ✕ Cancelar
              </button>
              <button
                onClick={handleRequestModification}
                disabled={isModifying || !modificationRequest.trim()}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isModifying ? '⏳ Modificando...' : '🔄 Modificar'}
              </button>
              <button
                onClick={handleConfirmImport}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all"
              >
                ✓ Confirmar e Criar Projeto
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
