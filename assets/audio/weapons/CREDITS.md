# Recorded weapon audio — sources and edits

These are independently licensed recordings, not audio extracted from commercial games.

## Firearm reports (CC0 1.0)

**The Free Firearm Sound Library** by **Ben Jaszczak, Brian Nelson, Kevin Heras, and Matthew Nanney**. Submitted to OpenGameArt by bart.

- Source and licence: https://opengameart.org/content/the-free-firearm-sound-library
- Original archive: https://opengameart.org/sites/default/files/Prepared%20SFX%20Library.7z
- Licence: https://creativecommons.org/publicdomain/zero/1.0/

The source library's `Prepared Master Sheet.csv` identifies each recording. `manifest.json` retains source filenames, SHA-256 hashes, crop onsets and mastering settings. Each game weapon uses two separately detected shot transients. We trim silence, fold to mono, retain the sharp attack, shape low-frequency body/high-frequency detail, leave headroom, fade only the boundaries and encode compact MP3 banks. Runtime playback alternates the two shots with slight variation.

| Game weapon | Representative source recording |
|---|---|
| AR-7 | AR-15 / D_32P.wav |
| KA-47 | AK-47 / C_28P.wav |
| SC-17 | SKS / U_19P.wav |
| MK-14 | Marlin 336 / I_22P.wav |
| KR-98 | Tikka T3 / W_29P.wav |
| S-12 | Winchester Model 12 / K_22P.wav |
| M-1014 | Benelli Nova / O_21P.wav |
| DB-2 | Mossberg Model 190 / N_30P.wav |
| SA-12 | Benelli Nova / O_21P.wav, separate mastering |
| AA-12 | Mossberg Model 190 / N_30P.wav, separate mastering |
| P-92 | Walther PPQ / X_39P.wav |
| G-18 | Bersa / F_47P.wav |
| M-1911 | 1911 / A_42P.wav |
| DE-7 | 1911 / A_42P.wav, heavier designed body |
| R-45 | Smith & Wesson 642 / V_27P.wav |

These are designed sounds for fictional game weapons. The table does not claim recordings of every exact represented model or calibre.

## Physical handling/foley (CC0 1.0)

**Gun reload sounds** by **SpringySpringo**.

- Source and licence: https://opengameart.org/content/gun-reload-sounds
- Originals: `gunreload1.wav`, `assaultriflereload1_0.wav`, `shotguncock_0.wav`
- The author describes these as recordings made with **airsoft guns**. We do not present these as live firearm mechanism recordings.

We crop individual magazine, slide/action, latch and handling transients into `foley.mp3`. Cues are layered and filtered by weapon: polymer pistol, steel rifle, heavy drum, bolt action, pump, break action and revolver. A complete prerecorded reload is never played over the animation. Each cue is triggered by the game's actual normalized event; cancelled reloads do not schedule later events.

Rebuild with Python + NumPy + FFmpeg:

```sh
python tools/build-weapon-audio.py /path/to/source-folder
```

The original archive and full source WAVs are not shipped with the game. This credit is voluntary under CC0.
