# Piano Studio

Application web pour apprendre le piano avec des notes qui tombent, façon Synthesia.

## Lancer

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173 dans **Chrome ou Edge**, les seuls navigateurs qui gèrent le Web MIDI.

## Sur téléphone

- Le clavier affiché est plus étroit, avec des touches assez larges pour les doigts, et il **suit le morceau tout seul**. En Jeu libre, les boutons ◀ ▶ changent d'octave.
- En **paysage**, le piano couvre environ 3 octaves : c'est la meilleure position pour jouer à deux mains. En portrait, l'appli convient mieux au travail d'une main à la fois.
- Le mode, les mains et le tempo se règlent dans le bouton **Options**.
- **Installer l'appli** : sur Android, ouvre le menu de Chrome puis « Installer l'application » ou « Ajouter à l'écran d'accueil ». Sur iPhone, ouvre le menu Partager de Safari puis « Sur l'écran d'accueil ». L'appli s'ouvre alors en plein écran et fonctionne hors connexion.
- Sur iPhone, coupe le mode silencieux pour entendre le son. Le clavier MIDI n'est pas pris en charge par Safari ; il fonctionne sur Android avec un adaptateur USB OTG.

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

Le bouton **Jeu libre** ouvre un piano sans morceau : tu joues ce que tu veux, et les notes montent au-dessus du clavier. Le bouton ● ou la touche Espace lance et arrête l'enregistrement. À l'arrêt, tu donnes un nom au morceau, puis il est ajouté à la bibliothèque. Les mains sont séparées au Do central, et tu peux t'entraîner dessus comme sur les autres morceaux. ### Instruments

Le piano peut être remplacé par l'un des 15 instruments, choisi dans le Jeu libre ou dans les Options d'un morceau :

- **Claviers** : piano, piano électrique, orgue, accordéon, synthé.
- **Vents** : flûte, trompette, saxophone.
- **Cordes** : cordes (violons), guitare, harpe, kora, basse.
- **Percussions** : balafon / marimba.
- **Voix** : chœur.

Tous sont synthétisés par l'appli. Un enregistrement garde son instrument, et l'export `.mid` le transmet au format General MIDI, que les autres logiciels de musique reconnaissent.

### Rythmes de batterie

En Jeu libre, choisis l'un des 38 rythmes, rangés par familles :

- **Bases** : métronome à 4 ou 3 temps, ballade, valse.
- **Afrique** : seben, rumba congolaise, ndombolo, coupé-décalé, zouglou, makossa, highlife, afrobeats, afrobeat, amapiano, bikutsi, mbalax.
- **Gospel** : louange, adoration.
- **Caraïbes & Amérique latine** : zouk, kompa, reggae, dancehall, salsa, bossa nova, samba, cumbia, merengue, bachata.
- **Pop & urbain** : pop, rock, hip-hop, R&B, trap, funk, disco, afro house, blues, jazz.

Lance le rythme avec ▶, règle le tempo en BPM et joue ta mélodie par-dessus. Si tu enregistres pendant que le rythme tourne, il est gardé avec le morceau (🥁 dans la bibliothèque). La batterie rejoue alors en mesure en modes Temps réel et Écoute, mais pas en mode Attente, puisque le morceau s'y arrête à chaque note. Son volume se règle dans les Réglages. Les sons de batterie sont produits par l'appli : rien n'est téléchargé.

Tu peux aussi importer n'importe quel fichier `.mid` depuis la bibliothèque. Le bouton ⬇ d'un morceau l'exporte en `.mid`, par exemple pour transférer tes enregistrements vers un autre appareil ou un autre navigateur. Les meilleurs scores et les réglages sont enregistrés dans le navigateur.

## Structure

- `src/engine.ts` : logique de jeu (modes, score)
- `src/renderer.ts` : dessin canvas des notes et du clavier
- `src/audio.ts` : synthétiseur de piano (Web Audio)
- `src/midi-input.ts` : clavier MIDI (Web MIDI)
- `src/midi-file.ts` : lecture des fichiers `.mid`
- `src/songs.ts` : morceaux intégrés
- `src/main.ts` : interface et branchements
