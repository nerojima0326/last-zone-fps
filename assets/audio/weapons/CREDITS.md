# Weapon audio — original reports and CC0 handling

## Current firing reports (v75)

All 15 firing reports are original synthesized sounds authored for LAST ZONE. `js/weapon-sound-design.js` creates the pressure front, shaped gas/crack/body noise and diffuse reflections without loading any previous firing waveform. Each weapon has four firing variants plus near/far perspectives: 90 new reports in 15 `*-report-v75.mp3` banks.

`node tools/build-original-weapon-audio.cjs` renders these banks with ffmpeg. The browser uses the same deterministic generator when a bank is missing or its manifest is obsolete. Recorded handling sounds remain from the CC0 sources below. The retired near/far regions in those handling atlases have no firing cues and are never selected by the v75 firing mixer.

The following recording table and processing notes document the retained handling and historical v43–v74 firing banks.

## Source (CC0 1.0)

**The Free Firearm Sound Library** by **Ben Jaszczak, Brian Nelson, Kevin Heras, and Matthew Nanney** (Master Tracks, 192 kHz / 24-bit).

- Original page: https://opengameart.org/content/the-free-firearm-sound-library
- Mirror used for the masters: https://github.com/buddingmonkey/FreeFirearmsSFXLibrary
- Licence: https://creativecommons.org/publicdomain/zero/1.0/

The track IDs below (for example `D_27`) are the master-sheet IDs. The letter selects the firearm.

## Edits

### Historical mix (v74)

`tools/remaster-weapon-audio.py` rebuilds the historical v74 banks from the immutable v73 CC0 banks at commit `154d93d`. It never processes its own output again. Run `python tools/remaster-weapon-audio.py` with ffmpeg and numpy installed.

- **Reports:** restore near-natural recording pitches (0.94–1.03×), soften most of the previous exaggerated EQ, extract a parallel 90–1500 Hz body layer from the recording itself, and add gentle saturation. Preserve the initial impact, then decay the report so automatic fire remains distinct. No synthesised bass note is added in this pass.
- **Space:** own reports keep a centred stereo image with quiet reflections at 11, 23 and 37 ms. Distant recordings keep their captured space, with distance filtering and propagation delay in the game.
- **Handling:** high-pass at 105 Hz, emphasise the body and metal contact, and add very small 6/14 ms contact resonances. Magazine removal/insertion, bolt/slide travel, shell loading and dry-fire keep their separate cues and animation events.
- **Mix:** alternate two firing takes, reduce older shot tails during automatic fire, and add a quiet recorded action contact for self-loading weapons. Suppressed reports reduce the muzzle blast while leaving the close mechanical action audible. Handling stays below the gun report in the production compressor.
- **Encoding:** 44.1 kHz; 160 kbps stereo shot banks and 112 kbps mono effect banks, with 200 ms cue padding. Stereo-aware decoder alignment preserves whichever channel leads and clamps playback to each cue's original end.

### Source-bank edits (v43–v45)

- **Shots, own weapon (`<id>-shot.mp3`).** Two "behind shooter" stereo takes per weapon. Each is cut 4 ms before the transient and kept for about 1.6 s, so the natural room and outdoor tail stays. Both are normalised; the game alternates them.
- **Shots, other players (`<id>-fx.mp3`, cues `near` and `far`).** Mono takes from the near and far microphone positions. The game crossfades from near to far with distance and delays each shot by the speed of sound.
- **Handling (`<id>-fx.mp3`).** Each single handling event (magazine out/in, slide or bolt open/close, shell insert, port load, dry fire, bolt up/down) is high-passed at 150 Hz, trimmed around its peak and normalised.
- **Per-weapon character (v43, stronger in v44).** Every shot (own, near, far) is given its own voice so no two weapons sound alike, audible on small speakers: a playback-rate change (pitch and length), a mid-band boost and a mid-band cut at weapon-specific frequencies, a 5 kHz treble shelf, soft saturation for heavy weapons, an early reflection (echo), an optional shorter tail, and a short low-frequency "thump". The values are the `CHAR` table in `tools/build-weapon-audio.py` (G-18 is the highest and driest, DE-7 / DB-2 / AA-12 the deepest). SA-12 and AA-12 share Charles Daly recordings but get opposite treatments. In v45 the KR-98 shot moved from the Mosin-Nagant to the Tikka T3 bolt-action recordings (the same rifle as its bolt and magazine sounds), with a sharp 2.2 kHz crack and the longest, widest tail.
- **Encoding.** Everything is resampled to 44.1 kHz and encoded as MP3. `manifest.json` lists the cue offsets and the source IDs.

These are designed sounds for fictional game weapons. Where an exact model was not recorded, the closest action type was used.

| Game weapon | Own shot | Near | Far | Handling |
|---|---|---|---|---|
| AR-7 | AR-15 `D_27`, AR-15 `D_29` | AR-15 `D_31` | AR-15 `D_25` | magout AR-15 `D_5`; magin AR-15 `D_4`; open AR-15 `D_9`; close AR-15 `D_13`; dry AR-15 `D_16` |
| KA-47 | AK-47 `C_39`, AK-47 `C_42` | AK-47 `C_25` | AK-47 `C_17` | magout AK-47 `C_11`; magin AK-47 `C_10`; open AK-47 `C_12`; close AK-47 `C_13`; dry AK-47 `C_7` |
| SC-17 | Springfield 1917 `B_17`, Springfield 1917 `B_18` | Springfield 1917 `B_23` | Springfield 1917 `B_21` | magout AR-15 `D_5`; magin AR-15 `D_4`; open SKS `U_3`; close SKS `U_4`; dry SKS `U_6` |
| MK-14 | SKS `U_13`, SKS `U_15` | SKS `U_12` | SKS `U_16` | magout Carl Gustav M45 `G_9`; magin Carl Gustav M45 `G_8`; open SKS `U_1`; close SKS `U_2`; dry SKS `U_6` |
| KR-98 | Tikka T3 `W_26`, Tikka T3 `W_28` | Tikka T3 `W_27` | Tikka T3 `W_23` | magout Tikka T3 `W_5`; magin Tikka T3 `W_4`; open Tikka T3 `W_9`; close Tikka T3 `W_12`; dry Tikka T3 `W_13`; up Tikka T3 `W_6`; down Mosin-Nagant `M_7` |
| S-12 | Benelli Nova `O_18`, Benelli Nova `O_20` | Benelli Nova `O_19` | Benelli Nova `O_15` | open Benelli Nova `O_4`; close Benelli Nova `O_5`; shell Benelli Nova `O_3`; port Benelli Nova `O_7`; dry Benelli Nova `O_8` |
| M-1014 | Winchester Model 12 `K_19`, Winchester Model 12 `K_21` | Winchester Model 12 `K_20` | Winchester Model 12 `K_16` | open SKS `U_1`; close SKS `U_2`; shell Winchester Model 12 `K_3`; port Winchester Model 12 `K_13`; dry Winchester Model 12 `K_7` |
| DB-2 | Mossberg 190 `N_27`, Mossberg 190 `N_29` | Mossberg 190 `N_28` | Mossberg 190 `N_24` | open Charles Daly pump `H_13`; close Charles Daly pump `H_1`; shell Charles Daly pump `H_7`; dry Charles Daly pump `H_8` |
| SA-12 | Charles Daly pump `H_18`, Charles Daly pump `H_20` | Charles Daly pump `H_19` | Charles Daly pump `H_15` | magout Mossberg 190 `N_11`; magin Mossberg 190 `N_10`; open AK-47 `C_0`; close AK-47 `C_1`; dry Mossberg 190 `N_18` |
| AA-12 | Charles Daly pump `H_20`, Charles Daly pump `H_18` | Charles Daly pump `H_21` | Charles Daly pump `H_17` | magout PPSh-41 `P_7`; magin PPSh-41 `P_6`; open PPSh-41 `P_8`; close SKS `U_2`; dry PPSh-41 `P_1` |
| P-92 | Bersa `F_44`, Bersa `F_45` | Bersa `F_46` | Bersa `F_42` | magout Bersa `F_5`; magin Bersa `F_4`; open Bersa `F_8`; close Bersa `F_17`; dry Bersa `F_23` |
| G-18 | Walther PPQ `X_38`, Walther PPQ `X_40` | Walther PPQ `X_39` | Walther PPQ `X_31` | magout Walther PPQ `X_5`; magin Walther PPQ `X_4`; open Walther PPQ `X_8`; close Walther PPQ `X_11`; dry Walther PPQ `X_18` |
| M-1911 | Colt 1911 `A_35`, Colt 1911 `A_36` | Colt 1911 `A_41` | Colt 1911 `A_39` | magout Colt 1911 `A_5`; magin Colt 1911 `A_4`; open Colt 1911 `A_8`; close Colt 1911 `A_11`; dry Colt 1911 `A_19` |
| DE-7 | Marlin Model 1894 `L_20`, Marlin Model 1894 `L_22` | Marlin Model 1894 `L_21` | Marlin Model 1894 `L_17` | magout Colt 1911 `A_5`; magin Colt 1911 `A_4`; open Colt 1911 `A_8`; close Colt 1911 `A_17`; dry Colt 1911 `A_19` |
| R-45 | S&W 642 `V_24`, S&W 642 `V_26` | S&W 642 `V_25` | S&W 642 `V_21` | open S&W 642 `V_9`; shell S&W 642 `V_3`; magin S&W 642 `V_2`; close S&W 642 `V_10`; dry S&W 642 `V_5` |

Fire-mode switch: AK-47 `C_4`.
