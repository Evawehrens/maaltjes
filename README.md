# Meals Memories — versie 2

Mobiele food/memories-app in dezelfde stijl als de screenshot: rustige witte app, afgeronde foto-grid, tabs en onderin een vaste navigatiebalk.

## Wat is aangepast in versie 2

- De uploadmodal staat standaard dicht.
- Er staat geen bucket-waarschuwing meer onderin.
- De uploadknop is vervangen door een groot mobiel uploadvlak met preview.
- De app gebruikt geen Supabase bucket meer.
- Foto's worden via een Supabase Edge Function direct naar GitHub geplaatst.
- Supabase bewaart alleen de memory-informatie in de tabel `memories`.
- De GitHub-token staat nergens in frontendcode.

## Bestanden

```txt
index.html
styles.css
app.js
supabase.js
manifest.webmanifest
github-upload-placeholder.js
supabase/functions/sync-photo-to-github/index.ts
```

## Supabase tabel

Voer dit uit in Supabase SQL Editor:

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

Voor simpel lezen vanaf de frontend kun je tijdens testen RLS uit laten. Wil je RLS aanzetten, voeg dan een select-policy toe voor publieke leesrechten.

## Supabase Secrets

Controleer bij Edge Functions → Secrets dat deze bestaan:

```txt
GITHUB_PHOTO_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
GITHUB_PHOTO_PATH
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Voor deze repo waarschijnlijk:

```txt
GITHUB_OWNER=Evawehrens
GITHUB_REPO=maaltjes
GITHUB_BRANCH=main
GITHUB_PHOTO_PATH=assets/meals
SUPABASE_URL=https://mnpifthygbwxenxydeyv.supabase.co
```

Zet de `SUPABASE_SERVICE_ROLE_KEY` alleen in Supabase Secrets. Niet in de HTML-app.

## Edge Function deployen

In de hoofdmap van dit project:

```bash
supabase login
supabase link --project-ref mnpifthygbwxenxydeyv
supabase functions deploy sync-photo-to-github
```

Daarna upload je de frontendbestanden naar GitHub Pages.

## Verwachte flow

```txt
Foto kiezen in app
↓
App roept Supabase Edge Function aan
↓
Edge Function uploadt foto naar GitHub
↓
Edge Function schrijft record naar Supabase memories
↓
App toont de nieuwe memory
```

## Veiligheid

Plaats nooit een GitHub-token in `index.html`, `app.js` of `supabase.js`. Iedereen kan frontendcode bekijken. Gebruik alleen Supabase Secrets of GitHub Actions Secrets.
