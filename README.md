# Meals Memories App

Mobiele webapp in de stijl van een moderne memories/foto-app: witte achtergrond, afgeronde kaarten, filtertabs, masonry-grid en vaste onderste navigatie.

## Openen

Open `index.html` lokaal in je browser of zet de map `meals-app` in je GitHub Pages repository.

## Supabase

De configuratie staat in `supabase.js`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_BUCKET = meal-photos`
- `MEMORIES_TABLE = memories`

Verwachte tabel:

```sql
create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  title text,
  type text,
  image_url text,
  storage_path text,
  thought text,
  created_at timestamptz default now()
);
```

Verwachte storage bucket:

```txt
meal-photos
```

Maak de bucket public als je de afbeeldingen direct via public URL in de app wil tonen.

## GitHub upload later

Zet nooit een GitHub token in frontendcode. Browsercode is zichtbaar voor iedereen.

Veilige vervolgstap:

1. Maak een GitHub personal access token met alleen toegang tot de juiste repo.
2. Zet die token als secret in Supabase Edge Functions of GitHub Actions.
3. Laat de frontend alleen een veilige Edge Function of backend-endpoint aanroepen.

Zie `github-upload-placeholder.js` voor de voorbereidende placeholderfuncties.

## Edge Function: foto naar GitHub syncen

Deze versie bevat een Supabase Edge Function:

```txt
supabase/functions/sync-photo-to-github/index.ts
```

De frontend roept deze functie na een upload aan via `syncPhotoToGithub()` in `supabase.js`.

Benodigde Supabase Edge Function secrets:

```txt
GITHUB_PHOTO_TOKEN=je_github_token
GITHUB_OWNER=je_github_gebruikersnaam_of_organisatie
GITHUB_REPO=je_repository_naam
GITHUB_BRANCH=main
GITHUB_PHOTO_PATH=assets/meals
SUPABASE_URL=https://mnpifthygbwxenxydeyv.supabase.co
SUPABASE_BUCKET=meal-photos
SUPABASE_SERVICE_ROLE_KEY=je_supabase_service_role_key
```

`SUPABASE_SERVICE_ROLE_KEY` is aanbevolen als de bucket later niet publiek is. Voor testen met een publieke bucket kan de function ook via de public URL downloaden.

Deploy via Supabase CLI:

```bash
supabase login
supabase link --project-ref mnpifthygbwxenxydeyv
supabase functions deploy sync-photo-to-github
```

Test daarna opnieuw met de Save-knop in de app.
