const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type MemoryRecord = {
  title: string;
  type: string;
  image_url: string;
  github_path: string;
  thought: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Alleen POST is toegestaan." }, 405);
  }

  try {
    const token = mustGetEnv("GITHUB_PHOTO_TOKEN");
    const owner = mustGetEnv("GITHUB_OWNER");
    const repo = mustGetEnv("GITHUB_REPO");
    const branch = Deno.env.get("GITHUB_BRANCH") || "main";
    const basePath = (Deno.env.get("GITHUB_PHOTO_PATH") || "assets/meals").replace(/^\/+|\/+$/g, "");
    const supabaseUrl = mustGetEnv("SUPABASE_URL");
    const serviceRoleKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");

    const formData = await req.formData();
    const title = cleanText(formData.get("title"), "Nieuwe memory");
    const type = cleanText(formData.get("type"), "photo").toLowerCase();
    const thought = cleanText(formData.get("thought"), "");
    const file = formData.get("file");

    let githubPath = "";
    let imageUrl = "";

    if (file instanceof File && file.size > 0) {
      const ext = getExtension(file.name, file.type);
      const safeBase = slugify(title) || "memory";
      const now = new Date();
      const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
      const unique = crypto.randomUUID().slice(0, 8);
      githubPath = `${basePath}/${datePath}/${safeBase}-${unique}.${ext}`;

      const bytes = new Uint8Array(await file.arrayBuffer());
      const content = toBase64(bytes);

      const uploadRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(githubPath)}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          message: `Add meal photo: ${title}`,
          content,
          branch,
        }),
      });

      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        console.error("GitHub upload fout", uploadData);
        return json({ error: `GitHub upload lukte niet: ${uploadData?.message || uploadRes.status}` }, 500);
      }

      imageUrl = uploadData?.content?.download_url || `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${githubPath}`;
    }

    const memory: MemoryRecord = {
      title,
      type,
      image_url: imageUrl,
      github_path: githubPath,
      thought,
    };

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/memories`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify(memory),
    });

    const inserted = await insertRes.json().catch(() => []);
    if (!insertRes.ok) {
      console.error("Supabase insert fout", inserted);
      return json({ error: `Memory opslaan in Supabase lukte niet: ${inserted?.message || insertRes.status}` }, 500);
    }

    return json({ ok: true, memory: Array.isArray(inserted) ? inserted[0] : inserted });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Onbekende fout." }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mustGetEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret ontbreekt: ${name}`);
  return value;
}

function cleanText(value: FormDataEntryValue | null, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function getExtension(filename: string, mimeType: string): string {
  const fromName = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName && fromName.length <= 5) return fromName === "jpeg" ? "jpg" : fromName;
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "jpg";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
