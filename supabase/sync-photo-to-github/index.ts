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

Deno.serve(async (req) => {
  console.log("sync-photo-to-github gestart");

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
    const serviceRoleKey = Deno.env.get("APP_SERVICE_ROLE_KEY");

    const missingSecrets: string[] = [];

    if (!githubToken) missingSecrets.push("GITHUB_PHOTO_TOKEN");
    if (!githubOwner) missingSecrets.push("GITHUB_OWNER");
    if (!githubRepo) missingSecrets.push("GITHUB_REPO");
    if (!supabaseUrl) missingSecrets.push("APP_SUPABASE_URL");
    if (!serviceRoleKey) missingSecrets.push("APP_SERVICE_ROLE_KEY");

    if (missingSecrets.length > 0) {
      console.error("Ontbrekende secrets:", missingSecrets);

      return jsonResponse(
        {
          error: "Ontbrekende secrets.",
          missing: missingSecrets,
        },
        500,
      );
    }

    console.log("Secrets aanwezig");

    const formData = await req.formData();

    const file = formData.get("file");
    const title = String(formData.get("title") || "Nieuwe memory");
    const type = String(formData.get("type") || "photo");
    const thought = String(formData.get("thought") || "");

    if (!(file instanceof File)) {
      console.error("Geen geldig bestand ontvangen");

      return jsonResponse(
        {
          error: "Geen geldig bestand ontvangen. Verwacht FormData met veld 'file'.",
        },
        400,
      );
    }

    console.log("Bestand ontvangen:", file.name, file.type, file.size);

    if (!file.type.startsWith("image/")) {
      return jsonResponse(
        {
          error: "Alleen afbeeldingen zijn toegestaan.",
        },
        400,
      );
    }

    const maxSizeMb = 8;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      return jsonResponse(
        {
          error: `Afbeelding is te groot. Maximaal ${maxSizeMb} MB.`,
        },
        400,
      );
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

    const githubPath =
      `${githubPhotoPath}/${year}/${month}/${day}/${timestamp}-${safeName}.${extension}`;

    const githubApiUrl =
      `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${githubPath}`;

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

      return jsonResponse(
        {
          error: "Upload naar GitHub is mislukt.",
          github_status: githubResponse.status,
          github_message: githubResult?.message || "Onbekende GitHub-fout.",
        },
        500,
      );
    }

    const imageUrl =
      githubResult?.content?.download_url ||
      `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${githubBranch}/${githubPath}`;

    console.log("GitHub upload gelukt:", imageUrl);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    console.log("Opslaan in memories-tabel");

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

      return jsonResponse(
        {
          error: "Foto staat in GitHub, maar opslaan in Supabase memories is mislukt.",
          supabase_message: error.message,
          image_url: imageUrl,
          github_path: githubPath,
        },
        500,
      );
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

    return jsonResponse(
      {
        error: "Onverwachte fout in Edge Function.",
        message: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
