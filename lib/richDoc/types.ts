/**
 * Tipos do editor de blocos (BlockNote) usados pela descrição de seção.
 *
 * Antes moravam em `lib/addons/types.ts` porque o editor nasceu como addon
 * "Documento Rico". Com a remoção dos addons, o editor de blocos passou a ser
 * infraestrutura do próprio documento — daí a mudança de casa.
 */

/** Bloco opaco do BlockNote — persistimos o que `editor.document` devolver. */
export type RichDocBlock = {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: RichDocBlock[];
};
