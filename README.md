# Piano Studio

Application web pour apprendre le piano avec des notes qui tombent, façon Synthesia.

## Lancer

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173 dans **Chrome ou Edge**, les seuls navigateurs qui gèrent le Web MIDI.

## Jouer

- **Clavier MIDI** : branche-le en USB avant d'ouvrir la page, puis autorise l'accès MIDI quand le navigateur le demande.
- **Souris / tactile** : clique sur les touches du clavier dessiné.
- **Clavier d'ordinateur** (deux octaves et demie) :
  - octave grave : touches blanches sur la rangée du bas (W X C V B N , en AZERTY), noires sur la rangée du milieu (S D, G H J) ;
  - octave suivante : touches blanches sur la rangée A Z E R T Y U I O P, noires sur les chiffres.

  La lettre à taper est écrite sur chaque note qui tombe. Le clavier se décale tout seul quand le morceau change de registre. Une flèche jaune ◀ ou ▶ signale une note hors de portée, comme un accord trop écarté à deux mains : joue-la à la souris ou travaille les mains séparément. Les flèches ← → changent d'octave à la main, ce qui désactive le décalage automatique.

| Raccourci | Action |
|---|---|
| Espace | Lecture / pause |
| Retour arrière | Recommencer |
| ↑ / ↓ | Tempo ± 5 % |
| Échap | Fermer une fenêtre |

## Modes

- **Attente** : le morceau s'arrête sur chaque note jusqu'à ce que tu la joues.
- **Temps réel** : le morceau avance en rythme ; chaque note est notée parfaite, bonne ou ratée.
- **Écoute** : le morceau est joué pour toi.

Choisis la main gauche ou la main droite pour la travailler seule : l'autre main est jouée automatiquement.

## Jeu libre

Le bouton **Jeu libre** ouvre un piano sans morceau : tu joues ce que tu veux, et les notes montent au-dessus du clavier. Le bouton ● ou la touche Espace lance et arrête l'enregistrement. À l'arrêt, tu donnes un nom au morceau, puis il est ajouté à la bibliothèque. Les mains sont séparées au Do central, et tu peux t'entraîner dessus comme sur les autres morceaux. Un métronome réglable aide à garder le rythme pendant l'enregistrement.

Tu peux aussi importer n'importe quel fichier `.mid` depuis la bibliothèque. Les meilleurs scores et les réglages sont enregistrés dans le navigateur.

## Structure

- `src/engine.ts` : logique de jeu (modes, score)
- `src/renderer.ts` : dessin canvas des notes et du clavier
- `src/audio.ts` : synthétiseur de piano (Web Audio)
- `src/midi-input.ts` : clavier MIDI (Web MIDI)
- `src/midi-file.ts` : lecture des fichiers `.mid`
- `src/songs.ts` : morceaux intégrés
- `src/main.ts` : interface et branchements
