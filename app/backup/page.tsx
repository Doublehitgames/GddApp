'use client';

import { useRouter } from 'next/navigation';
import { useProjectStore, Project } from '@/store/projectStore';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { projectPath } from '@/lib/utils/slug';

export default function GlobalBackupPage() {
  const router = useRouter();
  const { locale } = useI18n();
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
      
      setRestoreMessage(tr('✅ Backup completo criado com sucesso!', '✅ Full backup created successfully!', '✅ ¡Backup completo creado con éxito!'));
      setTimeout(() => setRestoreMessage(''), 3000);
    } catch (error) {
      console.error(tr('Erro ao exportar todos os projetos:', 'Error exporting all projects:', 'Error al exportar todos los proyectos:'), error);
      setRestoreMessage(tr('❌ Erro ao exportar backup completo.', '❌ Failed to export full backup.', '❌ Error al exportar el backup completo.'));
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
        throw new Error(tr('Arquivo de backup inválido: falta metadata', 'Invalid backup file: metadata missing', 'Archivo de backup inválido: falta metadata'));
      }

      // Check if it's single project or all projects backup
      if (data.project) {
        // Single project backup
        const restoredProject = data.project as Project;
        
        // Check for duplicate name
        const existingProject = allProjects.find((p) => p.title === restoredProject.title && p.id !== restoredProject.id);
        if (existingProject) {
          const shouldReplace = confirm(
            tr(
              `Já existe um projeto com o nome "${restoredProject.title}". Deseja substituir?`,
              `A project named "${restoredProject.title}" already exists. Do you want to replace it?`,
              `Ya existe un proyecto con el nombre "${restoredProject.title}". ¿Quieres reemplazarlo?`
            )
          );
          if (!shouldReplace) {
            setRestoreMessage(tr('❌ Importação cancelada.', '❌ Import cancelled.', '❌ Importación cancelada.'));
            setIsRestoring(false);
            event.target.value = '';
            return;
          }
          // Remove existing project
          removeProject(existingProject.id);
        }

        // Import project with persistence
        importProject(restoredProject);

        setRestoreMessage(tr(`✅ Projeto "${restoredProject.title}" restaurado com sucesso!`, `✅ Project "${restoredProject.title}" restored successfully!`, `✅ ¡Proyecto "${restoredProject.title}" restaurado con éxito!`));
        setTimeout(() => {
          router.push(projectPath(restoredProject));
        }, 2000);
      } else if (data.projects) {
        // All projects backup
        const restoredProjects = data.projects as Project[];
        
        const shouldReplace = confirm(
          tr(
            `Este backup contém ${restoredProjects.length} projeto(s). Deseja substituir TODOS os projetos existentes?`,
            `This backup contains ${restoredProjects.length} project(s). Do you want to replace ALL existing projects?`,
            `Este backup contiene ${restoredProjects.length} proyecto(s). ¿Quieres reemplazar TODOS los proyectos existentes?`
          )
        );
        if (!shouldReplace) {
          setRestoreMessage(tr('❌ Importação cancelada.', '❌ Import cancelled.', '❌ Importación cancelada.'));
          setIsRestoring(false);
          event.target.value = '';
          return;
        }
        
        // Import all projects with persistence
        importAllProjects(restoredProjects);

        setRestoreMessage(tr(`✅ ${restoredProjects.length} projeto(s) restaurado(s) com sucesso!`, `✅ ${restoredProjects.length} project(s) restored successfully!`, `✅ ${restoredProjects.length} proyecto(s) restaurado(s) con éxito!`));
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        throw new Error(tr('Formato de backup não reconhecido', 'Unrecognized backup format', 'Formato de backup no reconocido'));
      }
    } catch (error) {
      console.error(tr('Erro ao restaurar backup:', 'Error restoring backup:', 'Error al restaurar backup:'), error);
      setRestoreMessage(`❌ ${tr('Erro', 'Error', 'Error')}: ${error instanceof Error ? error.message : tr('Arquivo inválido', 'Invalid file', 'Archivo inválido')}`);
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
          <h1 className="text-3xl font-bold">💾 {tr('Backup e Restauração', 'Backup and Restore', 'Backup y restauración')}</h1>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition"
          >
            ← {tr('Voltar', 'Back', 'Volver')}
          </button>
        </div>

        {/* Stats */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-2">📊 {tr('Status do Sistema', 'System Status', 'Estado del sistema')}</h2>
          <p className="text-gray-400 text-sm">
            {tr(`${allProjects.length} projeto(s) no sistema`, `${allProjects.length} project(s) in the system`, `${allProjects.length} proyecto(s) en el sistema`)}
          </p>
        </div>

        {/* Restore Section - FIRST */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">📥 {tr('Restaurar Backup', 'Restore Backup', 'Restaurar backup')}</h2>
          <p className="text-gray-400 mb-6">
            {tr(
              'Importe um arquivo de backup JSON para restaurar projetos deletados. O sistema detecta automaticamente se é um projeto único ou backup completo.',
              'Import a JSON backup file to restore deleted projects. The system automatically detects whether it is a single project or a full backup.',
              'Importa un archivo JSON de backup para restaurar proyectos eliminados. El sistema detecta automáticamente si es un proyecto único o un backup completo.'
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
            className={`w-full p-8 bg-gradient-to-r from-green-600 to-green-700 rounded-lg hover:from-green-700 hover:to-green-800 transition text-center border-2 border-dashed border-green-400 ${
              isRestoring ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <span className="text-5xl block mb-3">📂</span>
            <h3 className="text-xl font-semibold mb-2">
              {isRestoring
                ? tr('Restaurando...', 'Restoring...', 'Restaurando...')
                : tr('Selecionar Arquivo de Backup', 'Select Backup File', 'Seleccionar archivo de backup')}
            </h3>
            <p className="text-green-200">
              {tr('Clique para escolher um arquivo .json', 'Click to choose a .json file', 'Haz clic para elegir un archivo .json')}
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
          <h2 className="text-2xl font-semibold mb-4">📤 {tr('Criar Backup', 'Create Backup', 'Crear backup')}</h2>
          <p className="text-gray-400 mb-6">
            {tr(
              'Exporte todos os seus projetos em formato JSON para backup seguro. Todos os dados serão preservados: IDs, ordem, hierarquia e conteúdo.',
              'Export all your projects in JSON format for a safe backup. All data is preserved: IDs, order, hierarchy, and content.',
              'Exporta todos tus proyectos en formato JSON para un backup seguro. Se conservan todos los datos: IDs, orden, jerarquía y contenido.'
            )}
          </p>

          <button
            onClick={exportAllProjectsAsJSON}
            disabled={isExporting || allProjects.length === 0}
            className="w-full p-6 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg hover:from-purple-700 hover:to-purple-800 transition disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-1">
                  {tr('Fazer Backup de TODOS os Projetos', 'Backup ALL Projects', 'Hacer backup de TODOS los proyectos')}
                </h3>
                <p className="text-purple-200 text-sm">
                  {allProjects.length === 0 
                    ? tr('Nenhum projeto para fazer backup', 'No projects to back up', 'No hay proyectos para hacer backup')
                    : tr(`Salva todos os ${allProjects.length} projeto(s) do sistema`, `Saves all ${allProjects.length} project(s) in the system`, `Guarda todos los ${allProjects.length} proyecto(s) del sistema`)
                  }
                </p>
              </div>
              <span className="text-3xl">📚</span>
            </div>
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <h3 className="font-semibold text-blue-200 mb-2">ℹ️ {tr('Sobre o Sistema de Backup', 'About the Backup System', 'Sobre el sistema de backup')}</h3>
          <ul className="text-sm text-blue-300 space-y-1">
            <li>• <strong>{tr('Projeto único', 'Single project', 'Proyecto único')}:</strong> {tr('Backup individual feito na página do projeto', 'Individual backup created on the project page', 'Backup individual creado en la página del proyecto')}</li>
            <li>• <strong>{tr('Todos os projetos', 'All projects', 'Todos los proyectos')}:</strong> {tr('Backup completo feito aqui', 'Full backup created here', 'Backup completo creado aquí')}</li>
            <li>• {tr('Backups são arquivos JSON com 100% de fidelidade', 'Backups are JSON files with 100% fidelity', 'Los backups son archivos JSON con 100% de fidelidad')}</li>
            <li>• {tr('Todos os IDs, ordem e hierarquia são preservados', 'All IDs, order, and hierarchy are preserved', 'Se conservan todos los IDs, el orden y la jerarquía')}</li>
            <li>• {tr('Você pode restaurar projetos deletados a qualquer momento', 'You can restore deleted projects at any time', 'Puedes restaurar proyectos eliminados en cualquier momento')}</li>
            <li>• {tr('Para PDFs bonitos, use "Ver como Documento" e imprima', 'For polished PDFs, use "View as Document" and print', 'Para PDFs bien presentados, usa "Ver como documento" e imprime')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
