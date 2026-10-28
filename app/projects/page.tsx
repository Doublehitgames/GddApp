import { redirect } from "next/navigation";

// O antigo wizard de criação manual. Projeto novo hoje se cria pela home (só o
// nome) e começa pelas perguntas dos Primeiros passos.
export default function ProjectsPage() {
  redirect("/");
}
