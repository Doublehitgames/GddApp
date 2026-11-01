"use client";

import { LegalHeader } from "@/components/legal/LegalArticle";
import { useI18n } from "@/lib/i18n/provider";
import { pick } from "@/lib/legal/pages";
import { PRIVACY_BODY } from "./content";

/**
 * Política de privacidade. É o link da tela de consentimento do Google, então
 * precisa estar completa e bater com o código: cada afirmação do texto em
 * ./content.tsx saiu de um arquivo do repo (schema SQL, rota de sync, store).
 * Ao mudar o que o app guarda, mudar aqui e trocar LEGAL_UPDATED_AT.
 */
export default function PrivacyPolicy() {
  const { locale } = useI18n();
  const renderBody = pick(PRIVACY_BODY, locale);

  return (
    <article>
      <LegalHeader slug="privacidade" />
      {renderBody()}
    </article>
  );
}
