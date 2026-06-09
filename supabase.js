const SUPABASE_URL = "https://mnpifthygbwxenxydeyv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucGlmdGh5Z2J3eGVueHlkZXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTQ2NTIsImV4cCI6MjA5NjU5MDY1Mn0.3fkk2tCNW9hgAaJZggwdMQXB04QDGR6I715wum-5s8Y";
const SUPABASE_BUCKET = "meal-photos";
const MEMORIES_TABLE = "memories";
const GITHUB_SYNC_FUNCTION = "sync-photo-to-github";

let supabaseClient = null;

function initSupabase() {
  if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.info("Supabase is niet geladen. De app gebruikt voorbeelddata.");
    return null;
  }

  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseClient;
  } catch (error) {
    console.info("Supabase initialiseren lukte niet. De app gebruikt voorbeelddata.", error);
    return null;
  }
}

async function fetchMemories() {
  if (!supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from(MEMORIES_TABLE)
    .select("id,title,type,image_url,storage_path,thought,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.info("Supabase memories ophalen lukte niet. Waarschijnlijk bestaat de tabel nog niet.", error.message);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

async function uploadPhotoToSupabase(file) {
  if (!supabaseClient || !file) return null;

  const extension = file.name.split(".").pop() || "jpg";
  const safeName = `${crypto.randomUUID()}.${extension}`;
  const storagePath = `uploads/${safeName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(SUPABASE_BUCKET)
    .upload(storagePath, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    console.info("Upload naar Supabase Storage lukte niet. Bestaat bucket meal-photos al?", uploadError.message);
    return null;
  }

  const { data } = supabaseClient.storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
  return {
    storage_path: storagePath,
    image_url: data?.publicUrl || ""
  };
}

async function createMemoryRecord(memory) {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient
    .from(MEMORIES_TABLE)
    .insert(memory)
    .select()
    .single();

  if (error) {
    console.info("Memory opslaan in Supabase lukte niet. Bestaat de tabel memories al?", error.message);
    return null;
  }

  return data;
}

async function syncPhotoToGithub(memory) {
  if (!supabaseClient || !memory?.storage_path) return null;

  const filename = memory.storage_path.split("/").pop() || `${crypto.randomUUID()}.jpg`;

  const { data, error } = await supabaseClient.functions.invoke(GITHUB_SYNC_FUNCTION, {
    body: {
      storage_path: memory.storage_path,
      image_url: memory.image_url || "",
      filename,
      title: memory.title || "Meal photo",
      memory_id: memory.id || ""
    }
  });

  if (error) {
    console.info("Sync naar GitHub lukte niet.", error.message || error);
    return null;
  }

  if (!data?.ok) {
    console.info("GitHub sync gaf geen succesvolle reactie.", data);
    return null;
  }

  return data;
}

async function deleteMemory(id) {
  if (!supabaseClient || !id) return false;

  const { error } = await supabaseClient
    .from(MEMORIES_TABLE)
    .delete()
    .eq("id", id);

  if (error) {
    console.info("Memory verwijderen lukte niet.", error.message);
    return false;
  }

  return true;
}

window.MealsSupabase = {
  initSupabase,
  fetchMemories,
  uploadPhotoToSupabase,
  createMemoryRecord,
  syncPhotoToGithub,
  deleteMemory
};
