'use client';

import { useRouter } from 'next/navigation';
import { useProjectStore, Project } from '@/store/projectStore';
import { useState } from 'react';

export default function GlobalBackupPage() {
  const router = useRouter();
  const allProjects = useProjectStore((state) => state.projects);
  const removeProject = useProjectStore((state) => state.removeProject);
  const importProject = useProjectStore((state) => state.importProject);
  const importAllProjects = useProjectStore((state) => state.importAllProjects);

  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState('');

  const exportAllProjectsAsJSON = () => {
    setIsExporting(true);
    try {
      const backupData = {
        projects: allProjects,
        exportDate: new Date().toISOString(),
        version: '1.0',
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all_projects_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setRestoreMessage('✅ Backup completo criado com sucesso!');
      setTimeout(() => setRestoreMessage(''), 3000);
    } catch (error) {
      console.error('Erro ao exportar todos os projetos:', error);
      setRestoreMessage('❌ Erro ao exportar backup completo.');
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
      if (!data.version || !data.exportDate) {
        throw new Error('Arquivo de backup inválido: falta metadata');
      }

      // Check if it's single project or all projects backup
      if (data.project) {
        // Single project backup
        const restoredProject = data.project as Project;
        
        // Check for duplicate name
        const existingProject = allProjects.find((p) => p.title === restoredProject.title && p.id !== restoredProject.id);
        if (existingProject) {
          const shouldReplace = confirm(
            `Já existe um projeto com o nome "${restoredProject.title}". Deseja substituir?`
          );
          if (!shouldReplace) {
            setRestoreMessage('❌ Importação cancelada.');
            setIsRestoring(false);
            event.target.value = '';
            return;
          }
          // Remove existing project
          removeProject(existingProject.id);
        }

        // Import project with persistence
        importProject(restoredProject);

        setRestoreMessage(`✅ Projeto "${restoredProject.title}" restaurado com sucesso!`);
        setTimeout(() => {
          router.push(`/projects/${restoredProject.id}`);
        }, 2000);
      } else if (data.projects) {
        // All projects backup
        const restoredProjects = data.projects as Project[];
        
        const shouldReplace = confirm(
          `Este backup contém ${restoredProjects.length} projeto(s). Deseja substituir TODOS os projetos existentes?`
        );
        if (!shouldReplace) {
          setRestoreMessage('❌ Importação cancelada.');
          setIsRestoring(false);
          event.target.value = '';
          return;
        }
        
        // Import all projects with persistence
        importAllProjects(restoredProjects);

        setRestoreMessage(`✅ ${restoredProjects.length} projeto(s) restaurado(s) com sucesso!`);
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        throw new Error('Formato de backup não reconhecido');
      }
    } catch (error) {
      console.error('Erro ao restaurar backup:', error);
      setRestoreMessage(`❌ Erro: ${error instanceof Error ? error.message : 'Arquivo inválido'}`);
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
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition"
          >
            ← Voltar
          </button>
        </div>

        {/* Stats */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-2">📊 Status do Sistema</h2>
          <p className="text-gray-400 text-sm">
            {allProjects.length} projeto(s) no sistema
          </p>
        </div>

        {/* Restore Section - FIRST */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">📥 Restaurar Backup</h2>
          <p className="text-gray-400 mb-6">
            Importe um arquivo de backup JSON para restaurar projetos deletados. 
            O sistema detecta automaticamente se é um projeto único ou backup completo.
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
            className={`w-full p-8 bg-gradient-to-r from-green-600 to-green-700 rounded-lg hover:from-green-700 hover:to-green-800 transition text-center border-2 border-dashed border-green-400 ${
              isRestoring ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <span className="text-5xl block mb-3">📂</span>
            <h3 className="text-xl font-semibold mb-2">
              {isRestoring ? 'Restaurando...' : 'Selecionar Arquivo de Backup'}
            </h3>
            <p className="text-green-200">
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

        {/* Export Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">📤 Criar Backup</h2>
          <p className="text-gray-400 mb-6">
            Exporte todos os seus projetos em formato JSON para backup seguro. 
            Todos os dados serão preservados: IDs, ordem, hierarquia e conteúdo.
          </p>

          <button
            onClick={exportAllProjectsAsJSON}
            disabled={isExporting || allProjects.length === 0}
            className="w-full p-6 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg hover:from-purple-700 hover:to-purple-800 transition disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-1">
                  Fazer Backup de TODOS os Projetos
                </h3>
                <p className="text-purple-200 text-sm">
                  {allProjects.length === 0 
                    ? 'Nenhum projeto para fazer backup' 
                    : `Salva todos os ${allProjects.length} projeto(s) do sistema`
                  }
                </p>
              </div>
              <span className="text-3xl">📚</span>
            </div>
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <h3 className="font-semibold text-blue-200 mb-2">ℹ️ Sobre o Sistema de Backup</h3>
          <ul className="text-sm text-blue-300 space-y-1">
            <li>• <strong>Projeto único:</strong> Backup individual feito na página do projeto</li>
            <li>• <strong>Todos os projetos:</strong> Backup completo feito aqui</li>
            <li>• Backups são arquivos JSON com 100% de fidelidade</li>
            <li>• Todos os IDs, ordem e hierarquia são preservados</li>
            <li>• Você pode restaurar projetos deletados a qualquer momento</li>
            <li>• Para PDFs bonitos, use "Ver como Documento" e imprima</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
