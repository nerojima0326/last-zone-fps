using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 소리 (웹판 core.js Audio + weapon-audio.js): 실총 녹음은 GunLibrary 의 클립, 나머지는 웹판과 같은 방법(잡음·발진기·필터)으로 미리 합성
    //  위치는 웹 좌표. listener = 카메라 위치
    public static class Sfx
    {
        public static Vector3 listener;
        public static GunLibrary lib;
        public static float master = 1, weaponsVol = 1, ambientVol = 1, uiVol = 1;
        public struct ReloadEvent { public float at; public string cue; public ReloadEvent(float a, string c) { at = a; cue = c; } }

        static Transform root;
        static readonly List<AudioSource> pool = new List<AudioSource>();
        static int poolIdx;
        static AudioSource ui;
        static readonly Dictionary<string, AudioClip[]> synth = new Dictionary<string, AudioClip[]>();
        static readonly Dictionary<string, AudioSource> loops = new Dictionary<string, AudioSource>();
        static readonly Dictionary<string, int> seq = new Dictionary<string, int>();
        static float budgetT; static int budgetN;
        static AudioLowPassFilter muffle; static float muffleT;

        public static void Init(Transform cam)
        {
            if (root != null) return;
            root = new GameObject("Sfx").transform;
            Object.DontDestroyOnLoad(root.gameObject);
            for (int i = 0; i < 40; i++)
            {
                var s = new GameObject("src").AddComponent<AudioSource>();
                s.transform.SetParent(root); s.playOnAwake = false; s.spatialBlend = 1; s.rolloffMode = AudioRolloffMode.Logarithmic; s.dopplerLevel = 0; s.maxDistance = 1500;
                s.gameObject.AddComponent<AudioLowPassFilter>().cutoffFrequency = 22000;
                pool.Add(s);
            }
            ui = new GameObject("ui").AddComponent<AudioSource>(); ui.transform.SetParent(root); ui.spatialBlend = 0; ui.playOnAwake = false;
            if (cam != null) { muffle = cam.gameObject.GetComponent<AudioLowPassFilter>(); if (muffle == null) muffle = cam.gameObject.AddComponent<AudioLowPassFilter>(); muffle.cutoffFrequency = 22000; }
        }

        public static void Tick(float dt)
        {
            if (muffle != null && muffleT > 0) { muffleT -= dt; muffle.cutoffFrequency = Mathf.Lerp(22000, 350, Mathf.Clamp01(muffleT / 2.5f)); }
            AudioListener.volume = master;
        }

        static bool Budget()
        {
            if (Time.time - budgetT > 0.1f) { budgetT = Time.time; budgetN = 0; }
            return ++budgetN <= 22;
        }

        // 한 번 재생: pos 가 null 이면 2D(내 소리)
        static AudioSource Play(AudioClip c, Vector3? pos, float vol, float refDist = 15, float delay = 0, float pitch = 1, float cut = 22000)
        {
            if (c == null || root == null) return null;
            if (pos == null) { ui.pitch = pitch; ui.PlayOneShot(c, vol); return ui; }
            float d = Vector3.Distance(pos.Value, listener);
            if (refDist / (refDist + d) * vol < 0.01f) return null;
            var s = pool[poolIdx = (poolIdx + 1) % pool.Count];
            s.transform.position = Conv.U(pos.Value);
            s.minDistance = refDist; s.clip = c; s.volume = vol; s.pitch = pitch;
            s.GetComponent<AudioLowPassFilter>().cutoffFrequency = Mathf.Min(cut, Mathf.Max(450, 20000 * Mathf.Exp(-d / 110)));
            if (delay > 0) s.PlayDelayed(delay); else s.Play();
            return s;
        }

        static GunLibrary.Entry E(string id) => lib != null && id != null ? lib.Get(id) : null;

        public static void Shot(string id, Vector3 pos, bool own, bool suppressed)
        {
            var e = E(id); if (e == null) { Play(Get("shot"), own ? (Vector3?)null : pos, 0.8f, 28); return; }
            float sg = suppressed ? 0.4f : 1, cut = suppressed ? 3200 : 22000;
            if (own)
            {
                int n = seq.TryGetValue(id, out var k) ? k : 0; seq[id] = n + 1;
                var c = n % 2 == 1 && e.shot1 != null ? e.shot1 : e.shot0;
                ui.pitch = 1 + (U.R() - 0.5f) * 0.02f; ui.PlayOneShot(c, 0.9f * sg * weaponsVol);
                if (suppressed && muffle != null) { }
                return;
            }
            if (!Budget()) return;
            float d = Vector3.Distance(pos, listener), far = U.Clamp((d - 45) / 90, 0, 1), delay = Mathf.Min(1.2f, d / 343);
            if (far < 1 && e.near != null) Play(e.near, pos, 1.15f * sg * (1 - far) * weaponsVol, 30, delay, 1 + (U.R() - 0.5f) * 0.03f, cut);
            if (far > 0 && e.far != null) Play(e.far, pos, 1.0f * sg * far * weaponsVol, 70, delay, 1, cut);
        }

        static readonly Dictionary<string, float> Level = new Dictionary<string, float> { { "magout", .15f }, { "magin", .19f }, { "open", .18f }, { "close", .2f }, { "shell", .14f }, { "port", .16f }, { "dry", .13f }, { "up", .13f }, { "down", .15f }, { "switch", .12f } };
        static readonly Dictionary<string, float> Mass = new Dictionary<string, float> { { "ar7", 1 }, { "ka47", 1.08f }, { "sc17", 1 }, { "mk14", 1.1f }, { "kr98", 1.05f }, { "s12", 1.05f }, { "m1014", 1 }, { "db2", 1.05f }, { "sa12", 1.08f }, { "aa12", 1.12f }, { "p92", .9f }, { "g18", .86f }, { "m1911", .95f }, { "de7", .85f }, { "r45", .95f } };
        static AudioClip CueClip(GunLibrary.Entry e, string cue)
        {
            switch (cue)
            {
                case "magout": return e.magout; case "magin": return e.magin; case "open": return e.open; case "close": return e.close; case "dry": return e.dry;
                case "shell": return e.shell != null ? e.shell : e.magin; case "port": return e.port != null ? e.port : (e.shell != null ? e.shell : e.magin); case "up": return e.up; case "down": return e.down;
            }
            return null;
        }
        // 총 조작음 (pos null = 내 총)
        public static void Event(string cue, string id, Vector3? pos)
        {
            var e = E(id);
            if (e == null) { Click(cue, pos); return; }
            float k = (Level.TryGetValue(cue, out var lv) ? lv : 0.3f) * (Mass.TryGetValue(id, out var ms) ? ms : 1) * 4.5f * weaponsVol;
            if (pos != null) { if (!Budget()) return; k *= 1.6f; }
            if (cue == "open" && e.up != null && pos == null) { Play(e.up, null, k * 0.75f); Play(CueClip(e, "open"), null, k, 5, 0.09f); return; }
            if (cue == "close" && e.down != null && pos == null) { Play(CueClip(e, "close"), null, k); Play(e.down, null, k * 0.75f, 5, 0.09f); return; }
            var c = CueClip(e, cue);
            if (c == null) { Click(cue, pos); return; }
            Play(c, pos, k, 5);
        }

        // 장전 소리 시각 (진행 비율)
        public static ReloadEvent[] ReloadEvents(string id, bool empty, string phase, bool port)
        {
            var d = Data.Gun(id);
            if (phase == null)
            {
                if (d.reloadType == ReloadType.Revolver) return new[] { new ReloadEvent(0.1f, "open"), new ReloadEvent(0.3f, "shell"), new ReloadEvent(0.62f, "magin"), new ReloadEvent(0.86f, "close") };
                return empty ? new[] { new ReloadEvent(0.16f, "magout"), new ReloadEvent(0.55f, "magin"), new ReloadEvent(0.8f, "close") } : new[] { new ReloadEvent(0.2f, "magout"), new ReloadEvent(0.68f, "magin") };
            }
            if (phase == "start") return port ? new[] { new ReloadEvent(0.25f, "open"), new ReloadEvent(0.55f, "port"), new ReloadEvent(0.75f, "close") } : new[] { new ReloadEvent(0.4f, "open") };
            if (phase == "load") return new[] { new ReloadEvent(0.55f, "shell") };
            return new[] { new ReloadEvent(0.45f, "close") };
        }

        public static void Click(string type, Vector3? pos)
        {
            if (type == "switch" && lib != null && lib.switchClip != null) { Play(lib.switchClip, pos, 0.6f); return; }
            Play(Get(type), pos, 0.5f * uiVol, 8);
        }
        public static void Hit(bool head, bool kill, bool armored)
        {
            Play(Get(armored && !kill ? (head ? "hitArmorHead" : "hitArmor") : head ? "hitHead" : "hit"), null, 0.4f);
            if (kill) Play(Get("kill"), null, 0.4f);
        }
        public static void Hurt() => Play(Get("hurt"), null, 0.6f);
        public static void Impact(Vector3 pos, SurfMat m)
        {
            if (!Budget()) return;
            string k = m == SurfMat.Metal ? "impMetal" : m == SurfMat.Flesh ? "impFlesh" : m == SurfMat.Wood ? "impWood" : "impHard";
            Play(Get(k), pos, 0.35f, 6);
        }
        public static void Whiz(Vector3 pos) => Play(Get("whiz"), pos, 0.45f, 4);
        public static void Footstep(Vector3? pos, SurfMat surf, float vol)
        {
            string k = surf == SurfMat.Wood ? "stepWood" : surf == SurfMat.Metal ? "stepMetal" : surf == SurfMat.Hard ? "stepHard" : surf == SurfMat.Water ? "stepWater" : "stepGrass";
            Play(Get(k), pos, vol, 4);
        }
        public static void Bounce(Vector3 pos) => Play(Get("bounce"), pos, 0.4f, 6);
        public static void Glass(Vector3 pos) => Play(Get("glass"), pos, 0.7f, 12);
        public static void SmokePop(Vector3 pos) => Play(Get("smokePop"), pos, 0.6f, 12);
        public static void Explosion(Vector3 pos) => Play(Get("explosion"), pos, 1.3f, 70);
        public static void FlashBang(Vector3 pos) => Play(Get("flashbang"), pos, 1.4f, 60);
        public static void Ring(float amt)
        {
            if (amt <= 0.05f) return;
            Play(Get("ring"), null, 0.18f * amt);
            muffleT = 1.5f + amt * 4;
        }

        // 루프 (바람·비행기·불·엔진·드리프트·보급기)
        public static void SetLoop(string name, float vol, Vector3? pos = null, float rate = 1)
        {
            if (root == null) return;
            if (!loops.TryGetValue(name, out var s))
            {
                if (vol <= 0.001f) return;
                s = new GameObject("loop_" + name).AddComponent<AudioSource>();
                s.transform.SetParent(root); s.loop = true; s.clip = Get("loop_" + name); s.volume = 0; s.playOnAwake = false; s.dopplerLevel = 0;
                s.Play();
                loops[name] = s;
            }
            float v = vol * ambientVol;
            if (pos != null) { s.spatialBlend = 1; s.minDistance = name == "airdrop" ? 150 : 14; s.maxDistance = 2000; s.transform.position = Conv.U(pos.Value); }
            else s.spatialBlend = 0;
            s.volume = Mathf.MoveTowards(s.volume, v, Time.deltaTime * 4);
            s.pitch = Mathf.Lerp(s.pitch, rate, 1 - Mathf.Exp(-12 * Time.deltaTime));
        }
        public static void StopLoops() { foreach (var s in loops.Values) s.volume = 0; }

        /* ---------------- 합성 (웹판 noise/tone 조합) ---------------- */
        static AudioClip Get(string k)
        {
            if (!synth.TryGetValue(k, out var arr)) { arr = Make(k); synth[k] = arr; }
            return arr == null || arr.Length == 0 ? null : arr[Random.Range(0, arr.Length)];
        }
        struct N { public float t, dur, a, attack, hp, lp, lp1, bp, bp1, q; public bool brown; }
        struct T { public float t, dur, a, attack, f0, f1; public int type; }   // 0 sine 1 tri 2 square 3 saw
        class Recipe { public List<N> n = new List<N>(); public List<T> t = new List<T>(); public float len; }
        static Recipe R(float len) => new Recipe { len = len };
        static Recipe Nz(this Recipe r, float t, float dur, float a, float hp = 0, float lp = 0, float lp1 = 0, float bp = 0, float bp1 = 0, float q = 1, bool brown = false, float attack = 0.002f) { r.n.Add(new N { t = t, dur = dur, a = a, hp = hp, lp = lp, lp1 = lp1, bp = bp, bp1 = bp1, q = q, brown = brown, attack = attack }); return r; }
        static Recipe Tn(this Recipe r, float t, float dur, float a, float f0, float f1 = 0, int type = 0, float attack = 0.002f) { r.t.Add(new T { t = t, dur = dur, a = a, f0 = f0, f1 = f1, type = type, attack = attack }); return r; }

        static AudioClip[] Make(string k)
        {
            Recipe Rc()
            {
                switch (k)
                {
                    case "dry": return R(0.06f).Tn(0, 0.02f, 0.12f, 1800, 0, 2).Nz(0, 0.02f, 0.2f, hp: 4000);
                    case "magout": return R(0.1f).Nz(0, 0.05f, 0.4f, bp: 1200, q: 3).Tn(0, 0.06f, 0.15f, 600, 300, 1);
                    case "magin": return R(0.1f).Nz(0, 0.04f, 0.6f, bp: 2200, q: 2).Tn(0.02f, 0.04f, 0.12f, 900, 500, 2);
                    case "open": return R(0.1f).Nz(0, 0.055f, 0.4f, bp: 2700, q: 2).Tn(0, 0.045f, 0.08f, 720, 420, 1);
                    case "close": return R(0.08f).Nz(0, 0.035f, 0.65f, bp: 1900, q: 2).Tn(0, 0.035f, 0.1f, 850, 380, 2);
                    case "shell": case "port": return R(0.1f).Nz(0, 0.05f, 0.35f, bp: 1500, q: 2).Tn(0.03f, 0.05f, 0.15f, 420, 0, 1);
                    case "pin": return R(0.12f).Tn(0, 0.04f, 0.12f, 3200, 0, 1).Nz(0.05f, 0.05f, 0.25f, hp: 3000);
                    case "switch": return R(0.16f).Nz(0, 0.07f, 0.25f, bp: 900, q: 1).Nz(0.1f, 0.04f, 0.3f, bp: 2500, q: 2);
                    case "pickup": return R(0.12f).Nz(0, 0.08f, 0.3f, bp: 1400, q: 1).Tn(0.02f, 0.07f, 0.08f, 700, 900);
                    case "ui": return R(0.08f).Tn(0, 0.06f, 0.12f, 900, 1200);
                    case "heal": return R(0.3f).Nz(0, 0.25f, 0.2f, bp: 2500, q: 0.8f);
                    case "healdone": return R(0.35f).Tn(0, 0.12f, 0.15f, 660).Tn(0.1f, 0.2f, 0.15f, 990);
                    case "throw": return R(0.3f).Nz(0, 0.25f, 0.35f, bp: 500, bp1: 1800, q: 1.2f);
                    case "chute": return R(0.6f).Nz(0, 0.5f, 0.8f, lp: 900, brown: true).Nz(0.05f, 0.3f, 0.3f, bp: 700, q: 1);
                    case "land": return R(0.2f).Nz(0, 0.15f, 0.6f, lp: 500, brown: true);
                    case "punch": return R(0.15f).Nz(0, 0.12f, 0.4f, bp: 400, bp1: 1200, q: 1);
                    case "hit": return R(0.08f).Tn(0, 0.05f, 0.25f, 1500, 0, 1);
                    case "hitHead": return R(0.2f).Tn(0, 0.18f, 0.35f, 2400).Tn(0, 0.12f, 0.15f, 3600);
                    case "hitArmor": return R(0.1f).Tn(0, 0.07f, 0.28f, 520, 300, 1).Nz(0, 0.03f, 0.25f, bp: 2600, q: 3).Tn(0, 0.05f, 0.25f, 1500, 0, 1);
                    case "hitArmorHead": return R(0.2f).Tn(0, 0.07f, 0.28f, 1250, 700, 1).Nz(0, 0.03f, 0.25f, bp: 2600, q: 3).Tn(0, 0.18f, 0.35f, 2400);
                    case "kill": return R(0.42f).Tn(0.06f, 0.15f, 0.3f, 880).Tn(0.14f, 0.25f, 0.3f, 1320);
                    case "hurt": return R(0.2f).Nz(0, 0.15f, 0.6f, lp: 500, brown: true).Tn(0, 0.12f, 0.4f, 120, 60);
                    case "impMetal": return R(0.15f).Tn(0, 0.12f, 0.3f, Random.Range(1200, 2200), 800, 1).Nz(0, 0.04f, 0.3f, hp: 3000);
                    case "impFlesh": return R(0.1f).Nz(0, 0.07f, 0.5f, lp: 700);
                    case "impWood": return R(0.08f).Nz(0, 0.06f, 0.4f, bp: 900, q: 1.2f);
                    case "impHard": return R(0.08f).Nz(0, 0.06f, 0.4f, bp: 1600, q: 1.2f);
                    case "whiz": return R(0.12f).Nz(0, 0.09f, 0.6f, bp: 4200, bp1: 1800, q: 2.5f);
                    case "stepWood": return R(0.08f).Nz(0, 0.06f, 0.5f, bp: 500, q: 1.5f).Tn(0, 0.05f, 0.2f, 140, 90);
                    case "stepMetal": return R(0.08f).Nz(0, 0.05f, 0.45f, bp: 1800, q: 2).Tn(0, 0.06f, 0.08f, 600, 0, 1);
                    case "stepHard": return R(0.07f).Nz(0, 0.05f, 0.45f, bp: 1500, q: 1);
                    case "stepWater": return R(0.2f).Nz(0, 0.16f, 0.4f, bp: 900, bp1: 400, q: 0.8f);
                    case "stepGrass": return R(0.1f).Nz(0, 0.08f, 0.45f, lp: 1100, hp: 150);
                    case "bounce": return R(0.1f).Tn(0, 0.07f, 0.25f, Random.Range(700, 1100), 400, 1).Nz(0, 0.04f, 0.25f, bp: 1500, q: 2);
                    case "glass": { var r = R(0.7f).Nz(0, 0.35f, 0.6f, hp: 2500).Nz(0, 0.6f, 0.5f, lp: 900, brown: true); for (int i = 0; i < 4; i++) r.Tn(i * 0.03f, 0.15f, 0.08f, Random.Range(3000, 6000)); return r; }
                    case "smokePop": return R(2.7f).Nz(0, 0.05f, 0.4f, hp: 1500).Nz(0.03f, 2.5f, 0.35f, bp: 2500, q: 0.4f, attack: 0.15f);
                    case "explosion": return R(2f).Nz(0, 0.08f, 1, hp: 200, lp: 6000).Nz(0, 1.8f, 1, lp: 1400, lp1: 120, brown: true).Tn(0, 0.9f, 1.3f, 75, 22).Nz(0.05f, 0.6f, 0.25f, hp: 1800, lp: 7000);
                    case "flashbang": return R(0.8f).Nz(0, 0.12f, 1, hp: 600).Nz(0, 0.7f, 0.6f, lp: 3000, lp1: 200).Tn(0, 0.3f, 0.8f, 120, 40);
                    case "ring": return R(5.5f).Tn(0, 5f, 1, 3600, 0, 0, 0.05f).Tn(0, 4.5f, 0.5f, 3650, 0, 0, 0.05f);
                    case "shot": return R(0.5f).Nz(0, 0.05f, 1, hp: 500, lp: 9000).Nz(0, 0.18f, 0.7f, lp: 1600, lp1: 300).Tn(0, 0.15f, 0.6f, 90, 38).Nz(0.015f, 0.3f, 0.22f, lp: 800, lp1: 200, attack: 0.03f);
                }
                return null;
            }
            if (k.StartsWith("loop_")) return new[] { MakeLoop(k.Substring(5)) };
            int variants = k.StartsWith("imp") || k.StartsWith("step") || k == "bounce" || k == "glass" ? 3 : 1;
            var list = new List<AudioClip>();
            for (int v = 0; v < variants; v++) { var r = Rc(); if (r == null) return null; list.Add(Render(k + v, r)); }
            return list.ToArray();
        }

        const int SR = 44100;
        static AudioClip Render(string name, Recipe r)
        {
            int n = Mathf.CeilToInt(r.len * SR) + 64;
            var buf = new float[n];
            foreach (var x in r.n) AddNoise(buf, x);
            foreach (var x in r.t) AddTone(buf, x);
            float peak = 0; foreach (var v in buf) peak = Mathf.Max(peak, Mathf.Abs(v));
            if (peak > 1) for (int i = 0; i < n; i++) buf[i] /= peak;
            var c = AudioClip.Create(name, n, 1, SR, false);
            c.SetData(buf, 0);
            return c;
        }
        static float Env(float t, float a, float attack, float dur)
        {
            if (t < 0) return 0;
            if (t < attack) return Mathf.Lerp(0.0001f, a, t / attack);
            float k = (t - attack) / dur; if (k > 1) return 0;
            return a * Mathf.Pow(0.0001f / Mathf.Max(0.0002f, a), k);
        }
        class Biquad
        {
            float b0, b1, b2, a1, a2, x1, x2, y1, y2;
            public void Set(int type, float f, float q)
            {
                f = Mathf.Clamp(f, 20, SR * 0.45f);
                float w = 2 * Mathf.PI * f / SR, c = Mathf.Cos(w), s = Mathf.Sin(w), al = s / (2 * q), a0;
                if (type == 0) { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }        // lowpass
                else if (type == 1) { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; } // highpass
                else { b0 = al; b1 = 0; b2 = -al; }                                          // bandpass
                a0 = 1 + al; a1 = -2 * c; a2 = 1 - al;
                b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
            }
            public float Run(float x) { float y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }
        }
        static void AddNoise(float[] buf, N o)
        {
            int s0 = (int)(o.t * SR), len = (int)((o.attack + o.dur) * SR);
            Biquad hp = o.hp > 0 ? new Biquad() : null, lp = o.lp > 0 ? new Biquad() : null, bp = o.bp > 0 ? new Biquad() : null;
            hp?.Set(1, o.hp, 0.707f); lp?.Set(0, o.lp, 0.707f); bp?.Set(2, o.bp, o.q);
            float br = 0;
            for (int i = 0; i < len && s0 + i < buf.Length; i++)
            {
                float t = i / (float)SR, k = t / Mathf.Max(0.001f, o.attack + o.dur);
                if (lp != null && o.lp1 > 0 && (i & 31) == 0) lp.Set(0, o.lp * Mathf.Pow(o.lp1 / o.lp, k), 0.707f);
                if (bp != null && o.bp1 > 0 && (i & 31) == 0) bp.Set(2, o.bp * Mathf.Pow(o.bp1 / o.bp, k), o.q);
                float x = Random.value * 2 - 1;
                if (o.brown) { br = (br + 0.02f * x) / 1.02f; x = br * 3.5f; }
                if (hp != null) x = hp.Run(x);
                if (lp != null) x = lp.Run(x);
                if (bp != null) x = bp.Run(x) * 2;
                buf[s0 + i] += x * Env(t, o.a, o.attack, o.dur);
            }
        }
        static void AddTone(float[] buf, T o)
        {
            int s0 = (int)(o.t * SR), len = (int)((o.attack + o.dur) * SR);
            float ph = 0;
            for (int i = 0; i < len && s0 + i < buf.Length; i++)
            {
                float t = i / (float)SR, k = t / Mathf.Max(0.001f, o.attack + o.dur);
                float f = o.f1 > 0 ? o.f0 * Mathf.Pow(Mathf.Max(1, o.f1) / o.f0, k) : o.f0;
                ph += f / SR; ph -= Mathf.Floor(ph);
                float x = o.type == 0 ? Mathf.Sin(ph * Mathf.PI * 2) : o.type == 1 ? 1 - 4 * Mathf.Abs(ph - 0.5f) : o.type == 2 ? (ph < 0.5f ? 1 : -1) : ph * 2 - 1;
                buf[s0 + i] += x * Env(t, o.a, o.attack, o.dur);
            }
        }
        static AudioClip MakeLoop(string name)
        {
            int n = SR * 3; var buf = new float[n];
            var lp = new Biquad(); var bp = new Biquad(); float br = 0;
            switch (name)
            {
                case "wind": lp.Set(0, 700, 0.707f); break;
                case "fire": lp.Set(0, 1800, 0.707f); break;
                case "skid": bp.Set(2, 1400, 2.5f); break;
                default: lp.Set(0, 420, 0.707f); break;
            }
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)SR, x = Random.value * 2 - 1;
                switch (name)
                {
                    case "wind": br = (br + 0.02f * x) / 1.02f; buf[i] = lp.Run(br * 3.5f) * (0.7f + 0.3f * Mathf.Sin(t * 2 * Mathf.PI / 3)); break;
                    case "fire": buf[i] = lp.Run(x) * 0.4f + (Random.value < 0.0015f ? (Random.value - 0.5f) * 1.6f : 0); break;
                    case "skid": buf[i] = bp.Run(x) * 3; break;
                    case "engine": case "engineBot":
                        { float f = 55; buf[i] = (Mathf.Sin(t * f * 2 * Mathf.PI) * 0.5f + ((t * f * 2) % 1 - 0.5f) * 0.4f + lp.Run(x) * 0.6f) * 0.6f; break; }
                    default: // plane · airdrop
                        { float f = 74; buf[i] = (Mathf.Sin(t * f * 2 * Mathf.PI) * 0.35f + ((t * f * 3) % 1 - 0.5f) * 0.15f + lp.Run(x) * 0.9f) * 0.6f; break; }
                }
            }
            // 이음매 부드럽게
            int fade = SR / 10;
            for (int i = 0; i < fade; i++) { float k = i / (float)fade; buf[i] = buf[i] * k + buf[n - fade + i] * (1 - k); }
            var c = AudioClip.Create("loop_" + name, n - fade, 1, SR, false);
            var outb = new float[n - fade]; System.Array.Copy(buf, outb, n - fade); c.SetData(outb, 0);
            return c;
        }
    }
}
