# Recorded weapon audio — sources and edits

All weapon audio is cut from real firearm recordings. It is not taken from commercial games.

## Source (CC0 1.0)

**The Free Firearm Sound Library** by **Ben Jaszczak, Brian Nelson, Kevin Heras, and Matthew Nanney** (Master Tracks, 192 kHz / 24-bit).

- Original page: https://opengameart.org/content/the-free-firearm-sound-library
- Mirror used for the masters: https://github.com/buddingmonkey/FreeFirearmsSFXLibrary
- Licence: https://creativecommons.org/publicdomain/zero/1.0/

The track IDs below (for example `D_27`) are the master-sheet IDs. The letter selects the firearm.

## Edits

- **Shots, own weapon (`<id>-shot.mp3`).** Two "behind shooter" stereo takes per weapon. Each is cut 4 ms before the transient and kept for about 1.6 s, so the natural room and outdoor tail stays. Both are normalised; the game alternates them.
- **Shots, other players (`<id>-fx.mp3`, cues `near` and `far`).** Mono takes from the near and far microphone positions. The game crossfades from near to far with distance and delays each shot by the speed of sound.
- **Handling (`<id>-fx.mp3`).** Each single handling event (magazine out/in, slide or bolt open/close, shell insert, port load, dry fire, bolt up/down) is high-passed at 150 Hz, trimmed around its peak and normalised.
- **Encoding.** Everything is resampled to 44.1 kHz and encoded as MP3. `manifest.json` lists the cue offsets and the source IDs.

These are designed sounds for fictional game weapons. Where an exact model was not recorded, the closest action type was used.

| Game weapon | Own shot | Near | Far | Handling |
|---|---|---|---|---|
| AR-7 | AR-15 `D_27`, AR-15 `D_29` | AR-15 `D_31` | AR-15 `D_25` | magout AR-15 `D_5`; magin AR-15 `D_4`; open AR-15 `D_9`; close AR-15 `D_13`; dry AR-15 `D_16` |
| KA-47 | AK-47 `C_39`, AK-47 `C_42` | AK-47 `C_25` | AK-47 `C_17` | magout AK-47 `C_11`; magin AK-47 `C_10`; open AK-47 `C_12`; close AK-47 `C_13`; dry AK-47 `C_7` |
| SC-17 | Springfield 1917 `B_17`, Springfield 1917 `B_18` | Springfield 1917 `B_23` | Springfield 1917 `B_21` | magout AR-15 `D_5`; magin AR-15 `D_4`; open SKS `U_3`; close SKS `U_4`; dry SKS `U_6` |
| MK-14 | Arisaka `E_20`, Arisaka `E_23` | Arisaka `E_22` | Arisaka `E_17` | magout Carl Gustav M45 `G_9`; magin Carl Gustav M45 `G_8`; open SKS `U_1`; close SKS `U_2`; dry SKS `U_6` |
| KR-98 | Mosin-Nagant `M_20`, Mosin-Nagant `M_22` | Mosin-Nagant `M_19` | Mosin-Nagant `M_23` | magout Tikka T3 `W_5`; magin Tikka T3 `W_4`; open Tikka T3 `W_9`; close Tikka T3 `W_12`; dry Tikka T3 `W_13`; up Tikka T3 `W_6`; down Mosin-Nagant `M_7` |
| S-12 | Benelli Nova `O_18`, Benelli Nova `O_20` | Benelli Nova `O_19` | Benelli Nova `O_15` | open Benelli Nova `O_4`; close Benelli Nova `O_5`; shell Benelli Nova `O_3`; port Benelli Nova `O_7`; dry Benelli Nova `O_8` |
| M-1014 | Winchester Model 12 `K_19`, Winchester Model 12 `K_21` | Winchester Model 12 `K_20` | Winchester Model 12 `K_16` | open SKS `U_1`; close SKS `U_2`; shell Winchester Model 12 `K_3`; port Winchester Model 12 `K_13`; dry Winchester Model 12 `K_7` |
| DB-2 | Mossberg 190 `N_27`, Mossberg 190 `N_29` | Mossberg 190 `N_28` | Mossberg 190 `N_24` | open Charles Daly pump `H_13`; close Charles Daly pump `H_1`; shell Charles Daly pump `H_7`; dry Charles Daly pump `H_8` |
| SA-12 | Charles Daly pump `H_18`, Charles Daly pump `H_20` | Charles Daly pump `H_19` | Charles Daly pump `H_15` | magout Mossberg 190 `N_11`; magin Mossberg 190 `N_10`; open AK-47 `C_0`; close AK-47 `C_1`; dry Mossberg 190 `N_18` |
| AA-12 | Charles Daly pump `H_20`, Charles Daly pump `H_18` | Charles Daly pump `H_21` | Charles Daly pump `H_17` | magout PPSh-41 `P_7`; magin PPSh-41 `P_6`; open PPSh-41 `P_8`; close SKS `U_2`; dry PPSh-41 `P_1` |
| P-92 | Bersa `F_44`, Bersa `F_45` | Bersa `F_46` | Bersa `F_42` | magout Bersa `F_5`; magin Bersa `F_4`; open Bersa `F_8`; close Bersa `F_17`; dry Bersa `F_23` |
| G-18 | Carl Gustav M45 `G_26`, Carl Gustav M45 `G_32` | Carl Gustav M45 `G_25` | Carl Gustav M45 `G_13` | magout Walther PPQ `X_5`; magin Walther PPQ `X_4`; open Walther PPQ `X_8`; close Walther PPQ `X_11`; dry Walther PPQ `X_18` |
| M-1911 | Colt 1911 `A_35`, Colt 1911 `A_36` | Colt 1911 `A_41` | Colt 1911 `A_39` | magout Colt 1911 `A_5`; magin Colt 1911 `A_4`; open Colt 1911 `A_8`; close Colt 1911 `A_11`; dry Colt 1911 `A_19` |
| DE-7 | Marlin Model 1894 `L_20`, Marlin Model 1894 `L_22` | Marlin Model 1894 `L_21` | Marlin Model 1894 `L_17` | magout Colt 1911 `A_5`; magin Colt 1911 `A_4`; open Colt 1911 `A_8`; close Colt 1911 `A_17`; dry Colt 1911 `A_19` |
| R-45 | S&W 642 `V_24`, S&W 642 `V_26` | S&W 642 `V_25` | S&W 642 `V_21` | open S&W 642 `V_9`; shell S&W 642 `V_3`; magin S&W 642 `V_2`; close S&W 642 `V_10`; dry S&W 642 `V_5` |

Fire-mode switch: AK-47 `C_4`.
