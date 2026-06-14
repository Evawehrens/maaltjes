const SUPABASE_URL = "https://mnpifthygbwxenxydeyv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucGlmdGh5Z2J3eGVueHlkZXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTQ2NTIsImV4cCI6MjA5NjU5MDY1Mn0.3fkk2tCNW9hgAaJZggwdMQXB04QDGR6I715wum-5s8Y";

let supabaseClient = null;

function initSupabase() {
  if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("Supabase client is niet beschikbaar.");
    return null;
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

async function fetchMemoriesFromSupabase() {
  if (!supabaseClient) return [];

  try {
    const { data, error } = await supabaseClient.functions.invoke("sync-photo-to-github", {
      body: { action: "list" },
    });

    if (error) {
      console.warn("Memories ophalen via Edge Function lukte niet.", error.message);
      return [];
    }

    if (!data || data.error) {
      console.warn("Memories ophalen lukte niet.", data?.error || "Onbekende fout");
      return [];
    }

    return data.memories || [];
  } catch (error) {
    console.warn("Memories ophalen lukte niet.", error);
    return [];
  }
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

async function deleteMemoryViaEdgeFunction(meal) {
  if (!supabaseClient) {
    throw new Error("Supabase is nog niet geladen.");
  }

  if (!meal || !meal.id) {
    throw new Error("Geen geldig maaltje gekozen.");
  }

  const { data, error } = await supabaseClient.functions.invoke("sync-photo-to-github", {
    body: {
      action: "delete",
      id: meal.id,
      github_path: meal.github_path || "",
      image_url: meal.image_url || "",
      title: meal.title || "",
    },
  });

  if (error) {
    console.error("Edge Function delete gaf een fout.", error);
    throw new Error(error.message || "Verwijderen via Edge Function lukte niet.");
  }

  if (!data || data.error) {
    throw new Error(data?.error || "Verwijderen lukte niet.");
  }

  return data;
}

async function updateMemoryViaEdgeFunction(meal) {
  if (!supabaseClient) {
    throw new Error("Supabase is nog niet geladen.");
  }

  if (!meal || !meal.id) {
    throw new Error("Geen geldig maaltje gekozen.");
  }

  const payload = {
    action: "update",
    id: meal.id,
    title: meal.title || "",
    thought: meal.thought || "",
    type: meal.type || "photo",
    image_url: meal.image_url || "",
    github_path: meal.github_path || "",
  };

  const { data, error } = await supabaseClient.functions.invoke("sync-photo-to-github", {
    body: payload,
  });

  if (error) {
    console.warn("Edge Function update gaf een fout. Probeer directe Supabase-update.", error.message);
    return updateMemoryDirectly(payload);
  }

  if (data && data.error) {
    console.warn("Edge Function update lukte niet. Probeer directe Supabase-update.", data.error);
    return updateMemoryDirectly(payload);
  }

  return data?.memory || payload;
}

async function updateMemoryDirectly(meal) {
  if (!supabaseClient) {
    throw new Error("Supabase is nog niet geladen.");
  }

  const { data, error } = await supabaseClient
    .from("memories")
    .update({
      title: meal.title || "",
      thought: meal.thought || "",
    })
    .eq("id", meal.id)
    .select()
    .single();

  if (error) {
    console.error("Directe Supabase-update gaf een fout.", error);
    throw new Error(error.message || "Bewerken lukte niet.");
  }

  return data || meal;
}

window.MealsSupabase = {
  initSupabase,
  fetchMemoriesFromSupabase,
  createMemoryViaEdgeFunction,
  updateMemoryViaEdgeFunction,
  deleteMemoryViaEdgeFunction,
};
