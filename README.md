# KansoRoom

## Shpacones MP3 tracks

KansoRoom can play MP3 files hosted with the site. You choose a track from the **"Or choose a Shpacones track…"** menu under the link box, then press **Play**. The record spins while the track plays.

### 1. Copy the MP3 files

Drag the files into this folder in Finder or VS Code:

```text
public/music/shpacones/
```

Filenames with letters, numbers and dashes, such as `01-opening-night.mp3`, are the least error-prone. Spaces work too.

### 2. Add each track to the manifest

Edit `public/music/shpacones/tracks.json`:

```json
{
  "artist": "The Shpacones",
  "artwork": "cover.jpg",
  "tracks": [
    { "file": "01-opening-night.mp3", "title": "Opening Night" },
    { "file": "02-faenza.mp3", "title": "Faenza" }
  ]
}
```

- `file` must match the MP3's filename exactly, including upper and lower case.
- `title` is the name shown in the menu. If it's left out, the menu shows the filename instead.
- Tracks appear in the menu in the order they're listed.
- `artwork` is optional. Put the image in the same folder and the record will show it. JPG, JPEG, PNG and WebP all work. If the listed file is missing, KansoRoom tries the same name with the other extensions, so `"cover.jpg"` still finds `cover.png`. A track can have its own `"artwork"` that overrides the album cover.
- JSON is strict. Separate entries with commas and don't put a comma after the last one. If the file is invalid, the menu shows "No Shpacones tracks yet."

You don't need to change any code. Reload the page to see the new tracks.

### 3. Commit the music to GitHub

```bash
git add public/music/shpacones
git commit -m "Add Shpacones tracks"
git push
```

GitHub rejects any single file over 100 MB and warns about files over 50 MB. A typical MP3 is 5–15 MB, so a whole album is fine. The files will be visible to anyone who can see the repository, so keep the repository private if the music shouldn't be public.

### 4. How Netlify serves the files

When the site is built (`npm run build`), Vite copies everything in `public/` into `dist/` unchanged. Netlify publishes `dist/`, so a track is served from its CDN at:

```text
https://kansoroom.netlify.app/music/shpacones/01-opening-night.mp3
```

The files aren't secret: anyone who has that address can download them.

If a file in the manifest is missing or can't be played, KansoRoom shows a short message under the track title instead of playing.

---

## React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
