using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 효과 (웹판 effects.js): 불꽃·연기·흙먼지·피·파편 입자, 예광탄, 탄흔, 탄피, 섬광 빛, 타이어 자국, 화면 흔들림
    //  입력 좌표는 모두 웹 좌표 → 유니티로 바꿔 그린다
    public static class Fx
    {
        public static float shakeAmt;
        static ParticleSystem addShrink, addGrow, normGrow, normShrink, heavy;
        static Transform root;
        static readonly List<LineRenderer> tracers = new List<LineRenderer>();
        static readonly Stack<int> freeTr = new Stack<int>();
        static readonly List<(int i, float at)> delayedFree = new List<(int, float)>();
        static Transform[] decals; static int decalIdx;
        static Transform[] skids; static int skidIdx;
        class ShellObj { public Transform t; public Vector3 pos, vel, rot, spin; public float life; public bool on; }
        static readonly List<ShellObj> shells = new List<ShellObj>(); static int shellIdx;
        class L { public Light l; public float life, t, k0; }
        static readonly List<L> lights = new List<L>(); static int lightIdx;
        static Material decalMat, skidMat, shellMat, shellRedMat, tracerMat;
        public static int quality = 3;

        public static void Init()
        {
            if (root != null) return;
            root = new GameObject("Fx").transform;
            var soft = SoftTex();
            addShrink = MakePS("addShrink", soft, true, Curve(1, 0.25f), 0);
            addGrow = MakePS("addGrow", soft, true, Curve(1, 3f), 0);
            normGrow = MakePS("normGrow", soft, false, Curve(1, 3f), 0);
            normShrink = MakePS("normShrink", soft, false, Curve(1, 0.4f), 0);
            heavy = MakePS("heavy", soft, false, Curve(1, 1), 1);
            tracerMat = Mat(true, null); tracerMat.color = new Color(1f, 0.82f, 0.5f, 1f);
            decalMat = Mat(false, SoftTex(true)); decalMat.color = new Color(0.05f, 0.05f, 0.05f, 0.85f);
            skidMat = Mat(false, null); skidMat.color = new Color(0.05f, 0.05f, 0.05f, 0.45f);
            shellMat = Lit(new Color(0.78f, 0.6f, 0.25f)); shellRedMat = Lit(new Color(0.7f, 0.12f, 0.1f));
            decals = new Transform[260];
            for (int i = 0; i < decals.Length; i++) decals[i] = Quad("decal", decalMat, 0.09f).transform;
            skids = new Transform[700];
            for (int i = 0; i < skids.Length; i++) skids[i] = Quad("skid", skidMat, 1).transform;
            for (int i = 0; i < 40; i++)
            {
                var g = GameObject.CreatePrimitive(PrimitiveType.Cylinder); Object.Destroy(g.GetComponent<Collider>());
                g.transform.SetParent(root); g.transform.localScale = new Vector3(0.011f, 0.012f, 0.011f); g.SetActive(false);
                g.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                shells.Add(new ShellObj { t = g.transform });
            }
            for (int i = 0; i < 10; i++)
            {
                var l = new GameObject("fxLight").AddComponent<Light>(); l.transform.SetParent(root); l.type = LightType.Point; l.enabled = false; l.shadows = LightShadows.None;
                lights.Add(new L { l = l });
            }
        }

        static AnimationCurve Curve(float a, float b) { var c = new AnimationCurve(new Keyframe(0, a), new Keyframe(1, b)); return c; }
        static Texture2D SoftTex(bool hard = false)
        {
            const int S = 64; var t = new Texture2D(S, S, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < S; y++) for (int x = 0; x < S; x++)
                {
                    float dx = (x + 0.5f) / S * 2 - 1, dy = (y + 0.5f) / S * 2 - 1, d = Mathf.Sqrt(dx * dx + dy * dy);
                    float a = hard ? Mathf.Clamp01((1 - d) * 4) : Mathf.Pow(Mathf.Clamp01(1 - d), 1.6f);
                    t.SetPixel(x, y, new Color(1, 1, 1, a));
                }
            t.Apply(true);
            return t;
        }
        static Material Mat(bool additive, Texture tex)
        {
            var sh = Shader.Find("Universal Render Pipeline/Particles/Unlit");
            if (sh == null) sh = Shader.Find("Sprites/Default");
            var m = new Material(sh);
            if (tex != null) { m.mainTexture = tex; if (m.HasProperty("_BaseMap")) m.SetTexture("_BaseMap", tex); }
            if (m.HasProperty("_Surface"))
            {
                m.SetFloat("_Surface", 1); m.SetFloat("_Blend", additive ? 2 : 0);
                m.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
                m.SetInt("_DstBlend", (int)(additive ? UnityEngine.Rendering.BlendMode.One : UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha));
                m.SetInt("_ZWrite", 0);
                m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
                if (additive) m.EnableKeyword("_BLENDMODE_ADD"); else m.EnableKeyword("_BLENDMODE_ALPHA");
                m.renderQueue = 3000;
            }
            return m;
        }
        static Material Lit(Color c)
        {
            var sh = Shader.Find("Universal Render Pipeline/Lit"); if (sh == null) sh = Shader.Find("Standard");
            var m = new Material(sh) { color = c }; if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", 0.8f); if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", 0.6f);
            return m;
        }
        static GameObject Quad(string name, Material m, float s)
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Quad); Object.Destroy(g.GetComponent<Collider>());
            g.name = name; g.transform.SetParent(root); g.transform.localScale = Vector3.one * s;
            var r = g.GetComponent<Renderer>(); r.sharedMaterial = m; r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; r.receiveShadows = false;
            g.SetActive(false);
            return g;
        }
        static ParticleSystem MakePS(string name, Texture tex, bool additive, AnimationCurve size, float grav)
        {
            var g = new GameObject(name); g.transform.SetParent(root);
            var ps = g.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main; main.loop = false; main.playOnAwake = false; main.maxParticles = 6000; main.simulationSpace = ParticleSystemSimulationSpace.World; main.gravityModifier = grav;
            var em = ps.emission; em.enabled = false;
            var sh = ps.shape; sh.enabled = false;
            var sol = ps.sizeOverLifetime; sol.enabled = true; sol.size = new ParticleSystem.MinMaxCurve(1, size);
            var col = ps.colorOverLifetime; col.enabled = true;
            var gr = new Gradient(); gr.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) }, new[] { new GradientAlphaKey(additive ? 1 : 0.0f, 0), new GradientAlphaKey(1, 0.12f), new GradientAlphaKey(0.6f, 0.6f), new GradientAlphaKey(0, 1) });
            col.color = gr;
            var lim = ps.limitVelocityOverLifetime; lim.enabled = true; lim.drag = 0.6f; lim.multiplyDragByParticleSize = false; lim.multiplyDragByParticleVelocity = true;
            var rot = ps.rotationOverLifetime; rot.enabled = true; rot.z = new ParticleSystem.MinMaxCurve(-0.6f, 0.6f);
            var r = g.GetComponent<ParticleSystemRenderer>(); r.sharedMaterial = Mat(additive, tex); r.renderMode = ParticleSystemRenderMode.Billboard; r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; r.receiveShadows = false; r.sortingFudge = additive ? -10 : 0;
            ps.Play();
            return ps;
        }

        static void Emit(ParticleSystem ps, Vector3 wpos, Vector3 wvel, float life, float size, Color c)
        {
            if (ps == null) return;
            var e = new ParticleSystem.EmitParams { position = Conv.U(wpos), velocity = Conv.U(wvel), startLifetime = life, startSize = size, startColor = c, rotation = Random.Range(0, 360f) };
            ps.Emit(e, 1);
        }

        // 웹판 G.FX.add/norm.spawn 대응
        public static void Particle(Vector3 pos, Vector3 vel, float life, float s0, float s1, Color c, bool additive)
        {
            var ps = additive ? (s1 >= s0 ? addGrow : addShrink) : (s1 >= s0 ? normGrow : normShrink);
            Emit(ps, pos, vel, life, s0, c);
        }
        public static void Smoke(Vector3 pos, Vector3 vel, float life, float s0, float s1, Color c) => Emit(normGrow, pos, vel, life, Mathf.Max(s0, s1 * 0.35f), c);
        public static void Dust(Vector3 pos, Vector3 vel, Color c, float size, int n = 1)
        {
            for (int i = 0; i < n; i++) Emit(normGrow, pos + Random.insideUnitSphere * 0.2f, vel + Random.insideUnitSphere * 0.3f, 1.4f + Random.value, size * 0.5f, new Color(c.r, c.g, c.b, 0.55f));
        }

        public static void Impact(Vector3 p, Vector3 n, SurfMat m)
        {
            if (n.sqrMagnitude < 1e-6f) n = Vector3.up;
            Color dust = m == SurfMat.Wood ? new Color(0.45f, 0.34f, 0.22f) : m == SurfMat.Terrain ? new Color(0.42f, 0.36f, 0.27f) : m == SurfMat.Soft ? new Color(0.55f, 0.5f, 0.38f) : new Color(0.62f, 0.6f, 0.57f);
            int k = quality >= 2 ? 5 : 3;
            for (int i = 0; i < k; i++) Emit(normGrow, p + n * 0.05f, n * Random.Range(0.6f, 2.2f) + Random.insideUnitSphere * 0.8f, 0.6f + Random.value * 0.5f, 0.14f, new Color(dust.r, dust.g, dust.b, 0.7f));
            if (m == SurfMat.Metal || m == SurfMat.Hard)
                for (int i = 0; i < 4; i++) Emit(heavy, p + n * 0.03f, (n * 2 + Random.insideUnitSphere * 2.5f) * 1.5f, 0.25f, 0.03f, new Color(1f, 0.75f, 0.35f, 1f));
            if (m == SurfMat.Flesh || m == SurfMat.Water) return;
            var d = decals[decalIdx = (decalIdx + 1) % decals.Length];
            d.gameObject.SetActive(true);
            var un = Conv.U(n);
            d.position = Conv.U(p) + un * 0.012f;
            d.rotation = Quaternion.LookRotation(-un) * Quaternion.Euler(0, 0, Random.Range(0, 360));
            d.localScale = Vector3.one * Random.Range(0.06f, 0.1f);
        }
        public static void Blood(Vector3 p, Vector3 dir, int n)
        {
            for (int i = 0; i < n; i++) Emit(heavy, p, dir * Random.Range(1, 3) + Random.insideUnitSphere * 1.5f + Vector3.up, 0.5f + Random.value * 0.3f, 0.06f + Random.value * 0.05f, new Color(0.45f, 0.02f, 0.02f, 0.9f));
            Emit(normGrow, p, dir * 0.5f, 0.5f, 0.25f, new Color(0.5f, 0.05f, 0.05f, 0.5f));
        }
        public static void Splash(Vector3 p)
        {
            for (int i = 0; i < 8; i++) Emit(heavy, p, new Vector3(Random.Range(-1f, 1f), Random.Range(2, 4.5f), Random.Range(-1f, 1f)), 0.6f, 0.08f, new Color(0.85f, 0.9f, 0.95f, 0.8f));
        }
        public static void Muzzle(Vector3 p, Vector3 d, bool shotgun, bool own)
        {
            for (int i = 0; i < (shotgun ? 6 : 3); i++) Emit(addShrink, p + d * (0.05f * i), d * Random.Range(2, 6) + Random.insideUnitSphere * 0.5f, 0.05f, shotgun ? 0.35f : 0.22f, new Color(1f, 0.65f, 0.25f, 1));
            Emit(normGrow, p + d * 0.2f, d * 1.2f + Vector3.up * 0.3f, 0.8f, 0.15f, new Color(0.6f, 0.6f, 0.6f, 0.25f));
            if (Vector3.Distance(p, Sfx.listener) < 80) Light(p, new Color(1f, 0.67f, 0.33f), 1.4f, 0.05f, 10);
        }
        public static void Explosion(Vector3 p)
        {
            for (int i = 0; i < 26; i++) Emit(addShrink, p + Random.insideUnitSphere * 0.6f, Random.insideUnitSphere * 7 + Vector3.up * 3, 0.35f + Random.value * 0.35f, 2.2f + Random.value * 1.4f, new Color(1f, 0.55f + Random.value * 0.2f, 0.2f, 1));
            for (int i = 0; i < 22; i++) Emit(normGrow, p + Random.insideUnitSphere * 1.2f + Vector3.up * 0.5f, Random.insideUnitSphere * 2.5f + Vector3.up * 2.2f, 3 + Random.value * 3, 1.8f + Random.value * 1.5f, new Color(0.18f, 0.17f, 0.16f, 0.75f));
            Debris(p, 18);
            Light(p, new Color(1f, 0.6f, 0.25f), 14, 0.45f, 40);
        }
        public static void Debris(Vector3 p, int n)
        {
            for (int i = 0; i < n; i++) Emit(heavy, p + Vector3.up * 0.3f, Random.insideUnitSphere * 9 + Vector3.up * 6, 1.2f + Random.value, 0.06f + Random.value * 0.08f, new Color(0.12f, 0.1f, 0.08f, 1));
        }
        public static void Flashbang(Vector3 p)
        {
            for (int i = 0; i < 10; i++) Emit(addShrink, p, Random.insideUnitSphere * 3, 0.25f, 3.5f, new Color(1, 1, 1, 1));
            Light(p, Color.white, 30, 0.3f, 50);
        }
        public static void Shake(float a) { shakeAmt = Mathf.Max(shakeAmt, a); }

        public static void Light(Vector3 p, Color c, float intensity, float life, float range)
        {
            var L = lights[lightIdx = (lightIdx + 1) % lights.Count];
            L.l.enabled = true; L.l.transform.position = Conv.U(p); L.l.color = c; L.l.range = range; L.k0 = intensity; L.l.intensity = intensity; L.life = life; L.t = 0;
        }

        public static int GetTracer()
        {
            if (freeTr.Count > 0) return freeTr.Pop();
            var g = new GameObject("tracer"); g.transform.SetParent(root);
            var lr = g.AddComponent<LineRenderer>(); lr.sharedMaterial = tracerMat; lr.positionCount = 2; lr.useWorldSpace = true;
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; lr.receiveShadows = false; lr.numCapVertices = 2;
            lr.startColor = new Color(1, 0.9f, 0.6f, 1); lr.endColor = new Color(1, 0.7f, 0.3f, 0);
            tracers.Add(lr);
            return tracers.Count - 1;
        }
        public static void SetTracer(int i, Vector3 head, Vector3 tail, bool vis)
        {
            if (i < 0 || i >= tracers.Count) return;
            var lr = tracers[i]; lr.enabled = vis;
            if (!vis) return;
            lr.SetPosition(0, Conv.U(head)); lr.SetPosition(1, Conv.U(tail));
            float w = 0.016f + Mathf.Min(0.03f, Vector3.Distance(head, Sfx.listener) * 0.0004f);
            lr.startWidth = w; lr.endWidth = w * 0.6f;
        }
        public static void FreeTracer(int i, float delay = 0)
        {
            if (i < 0 || i >= tracers.Count) return;
            if (delay > 0) { delayedFree.Add((i, Time.time + delay)); return; }
            tracers[i].enabled = false; freeTr.Push(i);
        }

        public static void Shell(Vector3 pos, Vector3 vel, bool red)
        {
            var s = shells[shellIdx = (shellIdx + 1) % shells.Count];
            s.on = true; s.pos = pos; s.vel = vel; s.life = 1.6f; s.rot = new Vector3(Random.value * 360, Random.value * 360, 0); s.spin = Random.insideUnitSphere * 900;
            s.t.gameObject.SetActive(true);
            s.t.localScale = red ? new Vector3(0.02f, 0.03f, 0.02f) : new Vector3(0.011f, 0.012f, 0.011f);
            s.t.GetComponent<Renderer>().sharedMaterial = red ? shellRedMat : shellMat;
        }

        public static void SkidMark(Vector3 a, Vector3 b)
        {
            var t = skids[skidIdx = (skidIdx + 1) % skids.Length];
            t.gameObject.SetActive(true);
            var ua = Conv.U(a); var ub = Conv.U(b); var mid = (ua + ub) * 0.5f;
            t.position = mid;
            t.rotation = Quaternion.LookRotation(Vector3.down, (ub - ua).normalized);
            t.localScale = new Vector3(0.24f, Vector3.Distance(ua, ub) + 0.05f, 1);
        }

        public static void Update(float dt)
        {
            shakeAmt = Mathf.Max(0, shakeAmt - dt * 1.8f);
            for (int i = 0; i < delayedFree.Count; i++) if (Time.time >= delayedFree[i].at) { FreeTracer(delayedFree[i].i); delayedFree.RemoveAt(i--); }
            foreach (var L in lights)
            {
                if (!L.l.enabled) continue;
                L.t += dt;
                if (L.t >= L.life) { L.l.enabled = false; continue; }
                L.l.intensity = L.k0 * (1 - L.t / L.life);
            }
            foreach (var s in shells)
            {
                if (!s.on) continue;
                s.life -= dt;
                if (s.life <= 0) { s.on = false; s.t.gameObject.SetActive(false); continue; }
                s.vel.y -= 9.8f * dt; s.pos += s.vel * dt; s.rot += s.spin * dt;
                float g = World.Ready ? World.Ground(s.pos.x, s.pos.z, s.pos.y + 0.3f, 0.05f, 0.3f) : -100;
                if (s.pos.y < g + 0.01f) { s.pos.y = g + 0.01f; if (s.vel.y < -1.2f) Sfx.Click("shellDrop", s.pos); s.vel = new Vector3(s.vel.x * 0.4f, -s.vel.y * 0.25f, s.vel.z * 0.4f); s.spin *= 0.5f; }
                s.t.position = Conv.U(s.pos); s.t.rotation = Quaternion.Euler(s.rot);
            }
        }

        public static void ResetAll()
        {
            foreach (var s in shells) { s.on = false; s.t.gameObject.SetActive(false); }
            foreach (var t in tracers) t.enabled = false;
            freeTr.Clear(); for (int i = 0; i < tracers.Count; i++) freeTr.Push(i);
            delayedFree.Clear();
            if (decals != null) foreach (var d in decals) d.gameObject.SetActive(false);
            if (skids != null) foreach (var d in skids) d.gameObject.SetActive(false);
            foreach (var ps in new[] { addShrink, addGrow, normGrow, normShrink, heavy }) if (ps != null) ps.Clear();
        }
    }
}
