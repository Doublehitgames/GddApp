"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/lib/i18n/provider";

export default function ProjectsPage() {
  const router = useRouter();
  const addProject = useProjectStore((state) => state.addProject);
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string>("");

  function save() {
    if (!name.trim()) {
      setNameError(t("projectsPage.errors.required"));
      return;
    }
    if (name.trim().length < 3) {
      setNameError(t("projectsPage.errors.minLength"));
      return;
    }
    setNameError("");
    try {
      const id = addProject(name, description);
      router.push(`/projects/${id}`);
    } catch (e) {
      if (e instanceof Error && e.message === "structural_limit_projects") {
        setNameError(t("limits.projects"));
      } else {
        throw e;
      }
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
      <button
        onClick={() => router.push("/")}
        className="mb-4 text-gray-400 hover:text-white transition-colors"
      >
        ← {t("common.back")}
      </button>
      <h1 className="text-3xl font-bold mb-4">{t("projectsPage.title")}</h1>

      <div className="flex flex-col gap-4 w-80">
        <div className="flex flex-col gap-1">
          <input
            type="text"
            placeholder={t("projectsPage.form.namePlaceholder")}
            className={`p-3 rounded bg-gray-800 text-white border ${nameError ? "border-red-500" : "border-transparent"}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!e.target.value.trim()) {
                setNameError(t("projectsPage.errors.required"));
              } else if (e.target.value.trim().length < 3) {
                setNameError(t("projectsPage.errors.minLength"));
              } else {
                setNameError("");
              }
            }}
          />
          {nameError && (
            <span className="text-red-400 text-sm">{nameError}</span>
          )}
        </div>

        <textarea
          placeholder={t("projectsPage.form.descriptionPlaceholder")}
          className="p-3 rounded bg-gray-800 text-white"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <button
          onClick={save}
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          disabled={!!nameError}
        >
          {t("projectsPage.form.save")}
        </button>
      </div>
    </main>
  );
}
