// Versie 2 gebruikt geen GitHub token in de browser.
// De echte upload gebeurt veilig via Supabase Edge Function: sync-photo-to-github.
// Laat dit bestand staan als waarschuwing/documentatie voor toekomstige aanpassingen.

export function neverPutGithubTokenInFrontend() {
  return "Gebruik altijd Supabase Secrets, GitHub Actions secrets of een eigen backend.";
}
