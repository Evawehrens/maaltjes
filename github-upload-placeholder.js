/*
  GitHub upload voorbereiding
  ---------------------------
  Zet NOOIT een GitHub token of personal access token in frontend JavaScript.
  Iedereen kan browsercode bekijken. Een token in deze file zou dus direct lekken.

  Veilige routes voor later:
  1. Supabase Edge Function met secret GITHUB_TOKEN.
  2. GitHub Actions workflow met repository secret GITHUB_TOKEN of eigen PAT.
  3. Eigen backend/serverless endpoint dat de token geheim houdt.

  De frontend mag later alleen een veilig endpoint aanroepen, bijvoorbeeld:
  POST /functions/v1/sync-photo-to-github
*/

async function uploadPhotoToGithubLater(memory) {
  console.info("GitHub upload is nog niet actief. Later aanroepen via veilige backend/Edge Function.", memory);
  return { ok: false, reason: "placeholder_only" };
}

async function syncSupabasePhotoToGithubLater(memory) {
  console.info("Supabase → GitHub sync placeholder. Voeg later Supabase Edge Function of GitHub Action toe.", memory);
  return { ok: false, reason: "placeholder_only" };
}

window.MealsGithubSync = {
  uploadPhotoToGithubLater,
  syncSupabasePhotoToGithubLater
};
