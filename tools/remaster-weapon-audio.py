"""Build v74 from the checked-in CC0 recordings, without processing them twice.

Usage: python tools/remaster-weapon-audio.py [output-directory]
Requires ffmpeg, numpy, and the v73 source commit in git history.
"""
import ast
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "154d93d"
SR = 44100
# Target pitch, report decay, low-mid body frequency, body gain, presence gain.
# Keep the recording's character rather than the old extreme pitch shifts.
DESIGN = {
    "ar7": (1.00, .18, 190, 2.2, 2.0),
    "ka47": (.97, .23, 165, 3.0, 1.0),
    "sc17": (.96, .24, 150, 3.4, 1.8),
    "mk14": (1.00, .26, 175, 3.0, 2.8),
    "kr98": (.97, .40, 130, 3.8, 2.5),
    "s12": (.96, .27, 145, 3.8, 1.2),
    "m1014": (1.00, .22, 180, 3.0, 1.8),
    "db2": (.94, .34, 120, 4.0, .8),
    "sa12": (1.00, .20, 170, 2.8, 2.0),
    "aa12": (.96, .17, 145, 3.5, 1.4),
    "p92": (1.02, .15, 240, 1.5, 2.4),
    "g18": (1.03, .12, 260, 1.2, 2.8),
    "m1911": (.98, .19, 200, 2.8, 1.5),
    "de7": (.95, .31, 140, 4.0, 2.0),
    "r45": (.98, .27, 180, 3.2, 2.8),
}
ACTION = {"ar7": .048, "ka47": .058, "sc17": .055, "mk14": .06,
          "m1014": .065, "sa12": .07, "aa12": .075,
          "p92": .045, "g18": .032, "m1911": .055, "de7": .065}


def source_file(name):
    return subprocess.run(
        ["git", "show", f"{SOURCE}:{name}"], cwd=ROOT,
        capture_output=True, check=True).stdout


def ffmpeg(data, channels, filters="", decode=False):
    args = ["ffmpeg", "-v", "error"]
    if not decode:
        args += ["-f", "f32le", "-ar", str(SR), "-ac", str(channels)]
    args += ["-i", "-"]
    if filters:
        args += ["-af", filters]
    args += ["-ar", str(SR), "-ac", str(channels), "-f", "f32le", "-"]
    raw = subprocess.run(args, input=data, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, channels).copy()


def filter_pcm(pcm, filters):
    return ffmpeg(pcm.astype(np.float32).tobytes(), pcm.shape[1], filters)


def trim(pcm):
    peak = np.abs(pcm).max()
    active = np.flatnonzero(np.max(np.abs(pcm), axis=1) > peak * .08)
    if not len(active):
        raise ValueError("Silent source cue")
    return pcm[max(0, active[0] - int(.002 * SR)):].copy()


def finish(pcm, peak, tail=.035):
    pcm -= pcm.mean(axis=0, keepdims=True)
    n = min(len(pcm), int(tail * SR))
    pcm[-n:] *= np.linspace(1, 0, n)[:, None] ** 2
    n = min(len(pcm), int(.0006 * SR))
    pcm[:n] *= np.linspace(0, 1, n)[:, None]
    return pcm * (peak / max(1e-9, float(np.abs(pcm).max())))


def report(pcm, gid, kind, original):
    pitch, decay, body, boost, presence = DESIGN[gid]
    # Undo most of the old broad EQ and exaggerated pitch before shaping it.
    old = original[gid]
    eq = [f"asetrate={round(SR * pitch / old['pitch'])}", f"aresample={SR}"]
    eq += [f"equalizer=f={old[k][0] * pitch}:t=o:w={width}:g={-old[k][1] * .65}"
           for k, width in [("peak", 1.2), ("cut", 1.4)]]
    eq += [f"treble=g={-old['treble'] * .6}:f={5000 * pitch}:w=.7",
           "highpass=f=65:poles=2", "lowpass=f=11500:poles=2",
           f"equalizer=f={body}:t=o:w=1.5:g={boost}",
           "equalizer=f=650:t=o:w=1:g=-1.5",
           f"equalizer=f=2700:t=o:w=1.2:g={presence}"]
    pcm = trim(filter_pcm(pcm, ",".join(eq)))
    if kind != "far":
        # Parallel low-mid detail from the recording itself gives the report
        # weight on ordinary speakers, without an added synthesised bass note.
        low = filter_pcm(pcm, "highpass=f=90:poles=2,lowpass=f=1500:poles=2")
        n = min(len(pcm), int(.08 * SR))
        dry_rms = float(np.sqrt(np.mean(pcm[:n] ** 2)))
        low_rms = float(np.sqrt(np.mean(low[:n] ** 2)))
        pcm = pcm * .8 + low * (.65 * min(4, dry_rms / max(1e-9, low_rms)))
        pcm /= max(1e-9, float(np.abs(pcm).max()))
        pcm = np.tanh(pcm * 2.2) / np.tanh(2.2)
    if kind != "far":
        t = np.arange(len(pcm)) / SR
        # Preserve the first impact, then clear room for the next round.
        pcm *= np.exp(-np.maximum(0, t - .045) / (decay * (1.4 if kind == "near" else 1)))[:, None]
        pcm = pcm[:int((decay * 3.5 + .07) * SR)]
        dry = pcm.copy()
        # Short, quiet reflections, rather than a second audible gunshot.
        for delay, gain in [(.011, .065), (.023, .045), (.037, .025)]:
            n = int(delay * SR)
            pcm[n:] += dry[:-n] * gain
    else:
        pcm = pcm[:int(min(2.3, decay * 4 + .8) * SR)]
    if pcm.shape[1] == 2:
        mid = pcm.mean(axis=1, keepdims=True)
        pcm = mid + (pcm - mid) * .6
    return finish(pcm, .86 if kind.startswith("own") else .8)


def handling(pcm, gid, kind):
    _, _, body, _, presence = DESIGN[gid]
    # Close mechanical detail: remove rumble, keep the contact and metal ring.
    eq = (f"highpass=f=105:poles=2,lowpass=f=10000:poles=2,"
          f"equalizer=f={body * 2.5}:t=o:w=1.4:g=2.5,"
          f"equalizer=f=2300:t=o:w=1.2:g={2 + presence * .35}")
    pcm = trim(filter_pcm(pcm, eq))
    dry = pcm.copy()
    # A short contact resonance, not a repeated magazine/bolt action.
    if kind not in ("dry", "switch"):
        for delay, gain in [(.006, .09), (.014, .035)]:
            n = int(delay * SR)
            pcm[n:] += dry[:-n] * gain
    return finish(pcm, .76, .02)


def encode(cues, channels, dest):
    pad = np.zeros((int(.2 * SR), channels), np.float32)
    parts, metadata, frames = [pad], {}, len(pad)
    for name, pcm in cues:
        metadata[name] = {"offset": round(frames / SR, 6), "duration": round(len(pcm) / SR, 6)}
        parts += [pcm, pad]
        frames += len(pcm) + len(pad)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR),
                    "-ac", str(channels), "-i", "-", "-codec:a", "libmp3lame",
                    "-b:a", "160k" if channels == 2 else "112k", str(dest)],
                   input=np.concatenate(parts).astype(np.float32).tobytes(), check=True)
    return {"path": dest.name, "sha": hashlib.sha256(dest.read_bytes()).hexdigest()[:12], "cues": metadata}


def build(out):
    out.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(source_file("assets/audio/weapons/manifest.json"))
    tree = ast.parse(source_file("tools/build-weapon-audio.py"))
    table = next(n.value for n in tree.body if isinstance(n, ast.Assign)
                 and any(isinstance(t, ast.Name) and t.id == "CHAR" for t in n.targets))
    # Only read literal keyword values from the source's dict(...) entries.
    original = {ast.literal_eval(key): {kw.arg: ast.literal_eval(kw.value) for kw in value.keywords}
                for key, value in zip(table.keys, table.values)}
    for gid, weapon in manifest["weapons"].items():
        for bank, channels in [("shot", 2), ("fx", 1)]:
            old = weapon[bank]
            pcm = ffmpeg(source_file("assets/audio/weapons/" + old["path"]), channels, decode=True)
            cues = []
            for name, cue in old["cues"].items():
                segment = pcm[round(cue["offset"] * SR):round((cue["offset"] + cue["duration"]) * SR)]
                sound = report(segment, gid, name, original) if name.startswith("own") or name in ("near", "far") else handling(segment, gid, name)
                cues.append((name, sound))
            weapon[bank] = encode(cues, channels, out / old["path"])
        weapon["mix"] = {"shot": .86, "action": ACTION.get(gid), "handling": .8}
        print(gid, flush=True)
    old = manifest["switch"]
    pcm = ffmpeg(source_file("assets/audio/weapons/" + old["path"]), 1, decode=True)
    cue = old["cues"]["switch"]
    segment = pcm[round(cue["offset"] * SR):round((cue["offset"] + cue["duration"]) * SR)]
    manifest["switch"] = {**encode([("switch", handling(segment, "ar7", "switch"))], 1, out / old["path"]), "src": old["src"]}
    manifest["edition"] = 74
    manifest["design"] = {"sourceCommit": SOURCE, "style": "tight reports and close mechanical detail", "tool": "tools/remaster-weapon-audio.py"}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "assets/audio/weapons")
