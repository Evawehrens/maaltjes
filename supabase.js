const SUPABASE_URL = "https://mnpifthygbwxenxydeyv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucGlmdGh5Z2J3eGVueHlkZXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTQ2NTIsImV4cCI6MjA5NjU5MDY1Mn0.3fkk2tCNW9hgAaJZggwdMQXB04QDGR6I715wum-5s8Y";

let supabaseClient = null;

function initSupabase() {
  if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("Supabase client is niet beschikbaar. De app gebruikt voorbeelddata.");
    return null;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

async function fetchMemoriesFromSupabase() {
  if (!supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from("memories")
    .select("id,title,type,image_url,github_path,thought,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Memories ophalen lukte niet. Controleer of de tabel public.memories bestaat.", error.message);
    return [];
  }

  return data || [];
}

async function createMemoryViaEdgeFunction({ title, type, thought, file }) {
  if (!supabaseClient) {
    throw new Error("Supabase is nog niet geladen.");
  }

  const formData = new FormData();
  formData.append("title", title);
  formData.append("type", type || "photo");
  formData.append("thought", thought || "");
  if (file) formData.append("file", file);

  const { data, error } = await supabaseClient.functions.invoke("sync-photo-to-github", {
    body: formData,
  });

  if (error) {
    console.error("Edge Function sync-photo-to-github gaf een fout.", error);
    throw new Error(error.message || "Opslaan via Edge Function lukte niet.");
  }

  if (!data || data.error) {
    throw new Error(data?.error || "Opslaan lukte niet.");
  }

  return data.memory;
}

window.MealsSupabase = {
  initSupabase,
  fetchMemoriesFromSupabase,
  createMemoryViaEdgeFunction,
};
