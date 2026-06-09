// supabase/functions/sync-photo-to-github/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "memory";
}

function getExtension(fileName: string, mimeType: string) {
  const fromName = fileName.split(".").pop()?.toLowerCase();

  if (fromName && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";

  return "jpg";
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

function githubPathFromImageUrl(imageUrl: string, githubOwner: string, githubRepo: string, githubBranch: string) {
  if (!imageUrl) return "";

  try {
    const url = new URL(imageUrl);

    // https://raw.githubusercontent.com/OWNER/REPO/BRANCH/path/to/file.jpg
    if (url.hostname === "raw.githubusercontent.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      const owner = parts[0];
      const repo = parts[1];
      const branch = parts[2];
      if (owner === githubOwner && repo === githubRepo && branch === githubBranch) {
        return parts.slice(3).join("/");
      }
    }

    // https://github.com/OWNER/REPO/raw/BRANCH/path/to/file.jpg
    if (url.hostname === "github.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      const owner = parts[0];
      const repo = parts[1];
      const marker = parts[2];
      const branch = parts[3];
      if (owner === githubOwner && repo === githubRepo && marker === "raw" && branch === githubBranch) {
        return parts.slice(4).join("/");
      }
    }
  } catch (_error) {
    return "";
  }

  return "";
}

async function getGithubFileSha(apiUrl: string, githubToken: string, githubBranch: string) {
  const response = await fetch(`${apiUrl}?ref=${encodeURIComponent(githubBranch)}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${githubToken}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "supabase-edge-function-meals-app",
    },
  });

  if (!response.ok) return null;
  const result = await response.json();
  return result?.sha || null;
}

async function deleteGithubFile(githubPath: string, githubToken: string, githubOwner: string, githubRepo: string, githubBranch: string) {
  if (!githubPath) {
    return { skipped: true, reason: "Geen github_path aanwezig." };
  }

  const githubApiUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${githubPath}`;
  const sha = await getGithubFileSha(githubApiUrl, githubToken, githubBranch);

  if (!sha) {
    return { skipped: true, reason: "Bestand niet gevonden in GitHub." };
  }

  const response = await fetch(githubApiUrl, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${githubToken}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "supabase-edge-function-meals-app",
    },
    body: JSON.stringify({
      message: `Delete meal memory photo: ${githubPath}`,
      sha,
      branch: githubBranch,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      error: true,
      status: response.status,
      message: result?.message || "GitHub verwijderen mislukt.",
    };
  }

  return { success: true };
}

Deno.serve(async (req) => {
  console.log("sync-photo-to-github gestart v35");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Alleen POST is toegestaan." }, 405);
  }

  try {
    const githubToken = Deno.env.get("GITHUB_PHOTO_TOKEN");
    const githubOwner = Deno.env.get("GITHUB_OWNER");
    const githubRepo = Deno.env.get("GITHUB_REPO");
    const githubBranch = Deno.env.get("GITHUB_BRANCH") || "main";
    const githubPhotoPath = Deno.env.get("GITHUB_PHOTO_PATH") || "assets/meals";

    const supabaseUrl = Deno.env.get("APP_SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("APP_SUPABASE_SERVICE_ROLE_KEY");

    const missingSecrets: string[] = [];

    if (!githubToken) missingSecrets.push("GITHUB_PHOTO_TOKEN");
    if (!githubOwner) missingSecrets.push("GITHUB_OWNER");
    if (!githubRepo) missingSecrets.push("GITHUB_REPO");
    if (!supabaseUrl) missingSecrets.push("APP_SUPABASE_URL");
    if (!serviceRoleKey) missingSecrets.push("APP_SUPABASE_SERVICE_ROLE_KEY");

    if (missingSecrets.length > 0) {
      console.error("Ontbrekende secrets:", missingSecrets);
      return jsonResponse({ error: "Ontbrekende secrets.", missing: missingSecrets }, 500);
    }

    const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();

      if (body?.action === "list") {
        const { data, error } = await supabase
          .from("memories")
          .select("id,title,type,image_url,github_path,thought,created_at")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Supabase list mislukt:", error);
          return jsonResponse({ error: "Ophalen uit Supabase is mislukt.", supabase_message: error.message }, 500);
        }

        return jsonResponse({ success: true, memories: data || [] });
      }

      if (body?.action !== "delete") {
        return jsonResponse({ error: "Onbekende actie." }, 400);
      }

      const id = String(body.id || "").trim();

      if (!id) {
        return jsonResponse({ error: "Geen geldig id ontvangen." }, 400);
      }

      const { data: memory, error: lookupError } = await supabase
        .from("memories")
        .select("id,title,image_url,github_path")
        .eq("id", id)
        .single();

      if (lookupError || !memory) {
        console.error("Supabase lookup voor delete mislukt:", lookupError);
        return jsonResponse({ error: "Maaltje niet gevonden in Supabase.", supabase_message: lookupError?.message }, 404);
      }

      let githubPath = String(memory.github_path || body.github_path || "").trim();
      if (!githubPath) {
        githubPath = githubPathFromImageUrl(String(memory.image_url || body.image_url || ""), githubOwner!, githubRepo!, githubBranch);
      }

      const githubDelete = await deleteGithubFile(githubPath, githubToken!, githubOwner!, githubRepo!, githubBranch);

      if (githubDelete?.error) {
        console.error("GitHub delete mislukt:", githubDelete);
        return jsonResponse({
          error: "Verwijderen uit GitHub is mislukt.",
          github_status: githubDelete.status,
          github_message: githubDelete.message,
        }, 500);
      }

      const { error: deleteError } = await supabase.from("memories").delete().eq("id", id);

      if (deleteError) {
        console.error("Supabase delete mislukt:", deleteError);
        return jsonResponse({ error: "Verwijderen uit Supabase is mislukt.", supabase_message: deleteError.message }, 500);
      }

      return jsonResponse({ success: true, deleted_id: id, github_delete: githubDelete });
    }

    const formData = await req.formData();

    const file = formData.get("file");
    const title = String(formData.get("title") || "Nieuwe memory");
    const type = "photo";
    const thought = String(formData.get("thought") || "");

    if (!(file instanceof File)) {
      console.error("Geen geldig bestand ontvangen");
      return jsonResponse({ error: "Geen geldig bestand ontvangen. Verwacht FormData met veld 'file'." }, 400);
    }

    console.log("Bestand ontvangen:", file.name, file.type, file.size);

    if (!file.type.startsWith("image/")) {
      return jsonResponse({ error: "Alleen afbeeldingen zijn toegestaan." }, 400);
    }

    const maxSizeMb = 8;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      return jsonResponse({ error: `Afbeelding is te groot. Maximaal ${maxSizeMb} MB.` }, 400);
    }

    const buffer = await file.arrayBuffer();
    const contentBase64 = arrayBufferToBase64(buffer);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const timestamp = now.toISOString().replace(/[:.]/g, "-");

    const originalName = file.name || "memory.jpg";
    const extension = getExtension(originalName, file.type);
    const safeName = slugify(title || originalName);

    const githubPath = `${githubPhotoPath}/${year}/${month}/${day}/${timestamp}-${safeName}.${extension}`;
    const githubApiUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${githubPath}`;

    console.log("Upload naar GitHub:", githubPath);

    const githubResponse = await fetch(githubApiUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${githubToken}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "supabase-edge-function-meals-app",
      },
      body: JSON.stringify({
        message: `Add meal memory photo: ${title}`,
        content: contentBase64,
        branch: githubBranch,
      }),
    });

    const githubResult = await githubResponse.json();

    if (!githubResponse.ok) {
      console.error("GitHub upload mislukt:", githubResponse.status, githubResult);
      return jsonResponse({
        error: "Upload naar GitHub is mislukt.",
        github_status: githubResponse.status,
        github_message: githubResult?.message || "Onbekende GitHub-fout.",
      }, 500);
    }

    const imageUrl = githubResult?.content?.download_url ||
      `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${githubBranch}/${githubPath}`;

    console.log("GitHub upload gelukt:", imageUrl);

    const { data, error } = await supabase
      .from("memories")
      .insert({
        title,
        type,
        thought,
        image_url: imageUrl,
        github_path: githubPath,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase insert mislukt:", error);
      return jsonResponse({
        error: "Foto staat in GitHub, maar opslaan in Supabase memories is mislukt.",
        supabase_message: error.message,
        image_url: imageUrl,
        github_path: githubPath,
      }, 500);
    }

    console.log("Memory opgeslagen:", data?.id);

    return jsonResponse({
      success: true,
      memory: data,
      image_url: imageUrl,
      github_path: githubPath,
    });
  } catch (error) {
    console.error("Onverwachte fout:", error);
    return jsonResponse({
      error: "Onverwachte fout in Edge Function.",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
