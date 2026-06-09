# Maaltjes

Mobiele foto-app voor maaltjes. De app toont alleen foto's. Bij één klik op een foto verschijnt de naam. Bij twee keer klikken verschijnt het recept.

## Belangrijkste bestanden

```txt
index.html
styles.css
app.js
supabase.js
manifest.webmanifest
service-worker.js
assets/icon.png
assets/icons/icon-192.png
assets/icons/icon-512.png
supabase/functions/sync-photo-to-github/index.ts
```

## Supabase tabel

```sql
create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  title text,
  type text default 'photo',
  image_url text,
  github_path text,
  thought text,
  created_at timestamptz default now()
);
```

`title` wordt gebruikt als naam van het maaltje. `thought` wordt gebruikt als recept.

## Supabase Edge Function secrets

```txt
GITHUB_PHOTO_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
GITHUB_PHOTO_PATH
APP_SUPABASE_URL
APP_SUPABASE_SERVICE_ROLE_KEY
```

## Deploy Edge Function

```bash
supabase login
supabase link --project-ref mnpifthygbwxenxydeyv
supabase functions deploy sync-photo-to-github
```

## App installeren

De app bevat een manifest, app-iconen en service worker. Zet de bestanden in GitHub Pages, open de site op telefoon of desktop en kies in de browser voor installeren/toevoegen aan startscherm.
