'use client';

import { useParams, useRouter } from 'next/navigation';
import { useProjectStore, Project } from '@/store/projectStore';
import { useState } from 'react';

export default function BackupPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const project = useProjectStore((state) =>
    state.projects.find((p) => p.id === projectId)
  );
  const sections = project?.sections || [];
  const importProject = useProjectStore((state) => state.importProject);

  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState('');

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-red-400">Projeto não encontrado</h1>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const exportProjectAsJSON = () => {
    if (!project) return;
    
    setIsExporting(true);
    try {
      const backupData = {
        project,
        exportDate: new Date().toISOString(),
        version: '1.0',
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.title.replace(/[^a-z0-9]/gi, '_')}_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setRestoreMessage('✅ Backup criado com sucesso!');
      setTimeout(() => setRestoreMessage(''), 3000);
    } catch (error) {
      console.error('Erro ao exportar backup:', error);
      setRestoreMessage('❌ Erro ao exportar backup.');
    } finally {
      setIsExporting(false);
    }
  };

  const restoreFromJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setRestoreMessage('');

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate structure
      if (!data.version || !data.exportDate || !data.project) {
        throw new Error('Arquivo de backup inválido');
      }

      const restoredProject = data.project as Project;
      
      // Validate if backup is from the current project
      if (restoredProject.id !== projectId) {
        setRestoreMessage(`❌ Este backup é do projeto "${restoredProject.title}". Você só pode restaurar backups deste projeto ("${project.title}").`);
        setIsRestoring(false);
        event.target.value = '';
        return;
      }
      
      const shouldReplace = confirm(
        `Deseja restaurar o backup de "${restoredProject.title}"? Isso vai substituir o estado atual do projeto.`
      );
      
      if (!shouldReplace) {
        setRestoreMessage('❌ Restauração cancelada.');
        setIsRestoring(false);
        event.target.value = '';
        return;
      }

      // Import project with persistence (replaces if same ID)
      importProject(restoredProject);

      setRestoreMessage(`✅ Projeto restaurado com sucesso!`);
      setTimeout(() => {
        router.push(`/projects/${restoredProject.id}`);
      }, 2000);
    } catch (error) {
      console.error('Erro ao restaurar backup:', error);
      setRestoreMessage(`❌ Erro: ${error instanceof Error ? error.message : 'Arquivo inválido ou backup de múltiplos projetos'}`);
    } finally {
      setIsRestoring(false);
      event.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">💾 Backup e Restauração</h1>
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition"
          >
            ← Voltar
          </button>
        </div>

        {/* Project Info */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-2">{project.title}</h2>
          <p className="text-gray-400 text-sm">
            {sections.length} seção/seções • ID: {projectId}
          </p>
        </div>

        {/* Export Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">📤 Criar Backup</h2>
          <p className="text-gray-400 mb-6">
            Faça backup deste projeto em formato JSON. 
            Todos os dados serão preservados: IDs, ordem, hierarquia e conteúdo.
          </p>

          <button
            onClick={exportProjectAsJSON}
            disabled={isExporting}
            className="w-full p-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h3 className="text-xl font-semibold mb-2">
                  💾 Fazer Backup
                </h3>
                <p className="text-blue-200">
                  Salva "{project.title}" e todas as suas seções
                </p>
              </div>
              <span className="text-5xl">📦</span>
            </div>
          </button>
        </div>

        {/* Restore Section */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">📥 Restaurar Backup</h2>
          <p className="text-gray-400 mb-6">
            Importe o arquivo de backup JSON deste projeto para restaurá-lo. 
            Apenas backups deste projeto específico serão aceitos.
          </p>

          <input
            type="file"
            accept=".json"
            onChange={restoreFromJSON}
            disabled={isRestoring}
            className="hidden"
            id="restore-file"
          />
          <div
            onClick={() => !isRestoring && document.getElementById('restore-file')?.click()}
            className={`w-full p-6 bg-gradient-to-r from-green-600 to-green-700 rounded-lg hover:from-green-700 hover:to-green-800 transition text-center border-2 border-dashed border-green-400 ${
              isRestoring ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <span className="text-3xl block mb-2">📂</span>
            <h3 className="text-lg font-semibold mb-1">
              {isRestoring ? 'Restaurando...' : 'Selecionar Arquivo de Backup'}
            </h3>
            <p className="text-green-200 text-sm">
              Clique para escolher um arquivo .json
            </p>
          </div>

          {/* Restore Message */}
          {restoreMessage && (
            <div className={`mt-4 p-4 rounded-lg ${
              restoreMessage.startsWith('✅') 
                ? 'bg-green-900/50 text-green-200 border border-green-700' 
                : 'bg-red-900/50 text-red-200 border border-red-700'
            }`}>
              {restoreMessage}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <h3 className="font-semibold text-blue-200 mb-2">ℹ️ Sobre Backup Deste Projeto</h3>
          <ul className="text-sm text-blue-300 space-y-1">
            <li>• Backup salva apenas este projeto em formato JSON</li>
            <li>• Restaurar substitui o projeto atual pelo backup</li>
            <li>• Todos os IDs, ordem e hierarquia são preservados</li>
            <li>• Para backup de todos os projetos, use o botão na página inicial</li>
            <li>• Para PDFs bonitos, use "Ver como Documento" e imprima</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
