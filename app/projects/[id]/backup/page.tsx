'use client';

import { useParams, useRouter } from 'next/navigation';
import { useProjectStore, Project } from '@/store/projectStore';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';

export default function BackupPage() {
  const params = useParams();
  const router = useRouter();
  const { locale } = useI18n();
  const isPt = locale === 'pt-BR';
  const isEs = locale === 'es';
  const tr = (pt: string, en: string, es?: string) => (isPt ? pt : isEs ? (es ?? en) : en);
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
          <h1 className="text-2xl font-bold text-red-400">{tr('Projeto não encontrado', 'Project not found')}</h1>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition"
          >
            {tr('Voltar', 'Back')}
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
      
      setRestoreMessage(tr('✅ Backup criado com sucesso!', '✅ Backup created successfully!'));
      setTimeout(() => setRestoreMessage(''), 3000);
    } catch (error) {
      console.error(tr('Erro ao exportar backup:', 'Error exporting backup:'), error);
      setRestoreMessage(tr('❌ Erro ao exportar backup.', '❌ Error exporting backup.'));
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
        throw new Error(tr('Arquivo de backup inválido', 'Invalid backup file'));
      }

      const restoredProject = data.project as Project;
      
      // Validate if backup is from the current project
      if (restoredProject.id !== projectId) {
        setRestoreMessage(
          tr(
            `❌ Este backup é do projeto "${restoredProject.title}". Você só pode restaurar backups deste projeto ("${project.title}").`,
            `❌ This backup belongs to project "${restoredProject.title}". You can only restore backups for this project ("${project.title}").`
          )
        );
        setIsRestoring(false);
        event.target.value = '';
        return;
      }
      
      const shouldReplace = confirm(
        tr(
          `Deseja restaurar o backup de "${restoredProject.title}"? Isso vai substituir o estado atual do projeto.`,
          `Do you want to restore the backup for "${restoredProject.title}"? This will replace the project's current state.`
        )
      );
      
      if (!shouldReplace) {
        setRestoreMessage(tr('❌ Restauração cancelada.', '❌ Restore canceled.'));
        setIsRestoring(false);
        event.target.value = '';
        return;
      }

      // Import project with persistence (replaces if same ID)
      importProject(restoredProject);

      setRestoreMessage(tr('✅ Projeto restaurado com sucesso!', '✅ Project restored successfully!'));
      setTimeout(() => {
        router.push(`/projects/${restoredProject.id}`);
      }, 2000);
    } catch (error) {
      console.error(tr('Erro ao restaurar backup:', 'Error restoring backup:'), error);
      setRestoreMessage(
        `${tr('❌ Erro', '❌ Error', '❌ Error')}: ${
          error instanceof Error
            ? error.message
            : tr('Arquivo inválido ou backup de múltiplos projetos', 'Invalid file or backup from multiple projects', 'Archivo inválido o backup de múltiples proyectos')
        }`
      );
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
          <h1 className="text-3xl font-bold">{tr('💾 Backup e Restauração', '💾 Backup and Restore')}</h1>
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition"
          >
            {tr('← Voltar', '← Back')}
          </button>
        </div>

        {/* Project Info */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-2">{project.title}</h2>
          <p className="text-gray-400 text-sm">
            {tr(
              `${sections.length} seção/seções • ID: ${projectId}`,
              `${sections.length} section(s) • ID: ${projectId}`,
              `${sections.length} sección(es) • ID: ${projectId}`
            )}
          </p>
        </div>

        {/* Export Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">{tr('📤 Criar Backup', '📤 Create Backup')}</h2>
          <p className="text-gray-400 mb-6">
            {tr(
              'Faça backup deste projeto em formato JSON. Todos os dados serão preservados: IDs, ordem, hierarquia e conteúdo.',
              'Back up this project in JSON format. All data will be preserved: IDs, order, hierarchy, and content.'
            )}
          </p>

          <button
            onClick={exportProjectAsJSON}
            disabled={isExporting}
            className="w-full p-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h3 className="text-xl font-semibold mb-2">
                  {tr('💾 Fazer Backup', '💾 Create Backup')}
                </h3>
                <p className="text-blue-200">
                  {tr(
                    `Salva "${project.title}" e todas as suas seções`,
                    `Save "${project.title}" and all its sections`
                  )}
                </p>
              </div>
              <span className="text-5xl">📦</span>
            </div>
          </button>
        </div>

        {/* Restore Section */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">{tr('📥 Restaurar Backup', '📥 Restore Backup')}</h2>
          <p className="text-gray-400 mb-6">
            {tr(
              'Importe o arquivo de backup JSON deste projeto para restaurá-lo. Apenas backups deste projeto específico serão aceitos.',
              'Import this project backup JSON file to restore it. Only backups from this specific project are accepted.'
            )}
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
              {isRestoring ? tr('Restaurando...', 'Restoring...') : tr('Selecionar Arquivo de Backup', 'Select Backup File')}
            </h3>
            <p className="text-green-200 text-sm">
              {tr('Clique para escolher um arquivo .json', 'Click to choose a .json file')}
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
          <h3 className="font-semibold text-blue-200 mb-2">{tr('ℹ️ Sobre Backup Deste Projeto', 'ℹ️ About This Project Backup')}</h3>
          <ul className="text-sm text-blue-300 space-y-1">
            <li>{tr('• Backup salva apenas este projeto em formato JSON', '• Backup saves only this project in JSON format')}</li>
            <li>{tr('• Restaurar substitui o projeto atual pelo backup', '• Restoring replaces the current project with the backup')}</li>
            <li>{tr('• Todos os IDs, ordem e hierarquia são preservados', '• All IDs, order, and hierarchy are preserved')}</li>
            <li>{tr('• Para backup de todos os projetos, use o botão na página inicial', '• For a backup of all projects, use the button on the home page')}</li>
            <li>{tr('• Para PDFs bonitos, use "Ver como Documento" e imprima', '• For polished PDFs, use "View as Document" and print')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
