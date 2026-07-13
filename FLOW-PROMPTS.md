# Chifbay — clips à générer dans Google Flow (Veo)

Six plans, un par chapitre. **Sans texte, sans logo, sans musique.** Format **16:9, 1080p minimum**, 8 s.
Chaque plan doit être **lent** : la page les ralentit encore (playbackRate 0.6) et les fait se fondre l'un dans l'autre.

Une fois générés, déposer les fichiers ici, exactement sous ces noms :

```
assets/v/hero.mp4      assets/v/story.mp4     assets/v/vessel.mp4
assets/v/tours.mp4     assets/v/golden.mp4    assets/v/book.mp4
```

Je les ré-encode (H.264 + WebM, ~2 Mo chacun, poster JPEG) et la page les prend automatiquement :
chaque chapitre charge sa vidéo si elle existe, sinon il retombe sur la photo. Rien d'autre à toucher.

---

### 1. `hero.mp4` — Arrivée (grand large)
> Cinematic aerial drone shot flying low over the deep blue Atlantic ocean, midday sun high, calm long swell, sunlight glittering on the water, distant volcanic coastline of Madeira on the horizon. Slow forward push, no camera shake. Photorealistic, natural colour, documentary look, 24fps, shallow haze.

### 2. `story.mp4` — La côte
> Cinematic aerial shot rising slowly along a towering black volcanic sea cliff plunging straight into the ocean, waves breaking white at its base, green vegetation on top, Madeira. Late morning light. Slow vertical rise, photorealistic, natural colour, no people.

### 3. `vessel.mp4` — Le bateau
> Cinematic tracking shot of a modern white sport boat cruising fast across open blue sea, white wake behind it, spray catching the afternoon sun, volcanic coastline blurred in the background. Camera travels alongside at water level. Photorealistic, natural colour, no branding.

### 4. `tours.mp4` — Les criques
> Cinematic top-down aerial shot slowly descending over a hidden turquoise cove, crystal-clear water over volcanic rock, gentle white foam on the rocks, sunlight rays through the water. Photorealistic, natural colour, no people, no boat.

### 5. `golden.mp4` — Golden hour
> Cinematic shot from the water at golden hour, the sun low and huge over the Atlantic, a long copper path of light on the calm sea, warm haze, silhouetted cliffs far on the left. Very slow drift forward. Photorealistic, warm natural colour, film grain.

### 6. `book.mp4` — Heure bleue
> Cinematic shot of the Atlantic at blue hour just after sunset, deep indigo sea and sky, last warm orange glow on the horizon, first stars appearing, calm water, the lights of Funchal glowing faintly in the distance. Static camera, almost still. Photorealistic, moody, film grain.

---

**Conseils Flow** : générer chaque plan 2–3 fois et garder le meilleur (Veo rate souvent l'eau).
Rejeter tout plan avec du texte incrusté, un morphing bizarre de la coque, ou un mouvement de caméra rapide —
le fond doit être calme, c'est un décor, pas une pub.
