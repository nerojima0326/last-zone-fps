using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 수류탄 · 연막탄 · 화염병 · 섬광탄 (웹판 throwables.js)
    public static class Throwables
    {
        const float GRAV = 18, FLASH_R = 45;
        public static readonly Dictionary<string, float> FUSE = new Dictionary<string, float> { { "frag", 3.5f }, { "smoke", 1.6f }, { "flash", 1.8f }, { "molotov", 6 } };

        public class T { public Actor owner; public int team; public string kind; public Vector3 pos, vel, spin, rot; public float t, fuse, lastBounce; public bool rest, done; public GameObject view; }
        public class Smoke { public Vector3 pos; public float t, r, acc; public T src; }
        public class Fire { public Vector3 pos; public float r, t, tick, lt; public List<Vector3> patches; public Actor owner; public int team; }

        public static readonly List<T> list = new List<T>();
        public static readonly List<Smoke> smokes = new List<Smoke>();
        public static readonly List<Fire> fires = new List<Fire>();
        public static System.Action<T> onSpawn, onRemove;
        public static System.Action<T> onDetonate;

        static Throwables() { World.smokeBlocks = SmokeBlocks; }

        public static void Reset()
        {
            foreach (var o in list) onRemove?.Invoke(o);
            list.Clear(); smokes.Clear(); fires.Clear();
            Sfx.SetLoop("fire", 0);
        }

        // fuse < 0 이면 기본 시간
        public static void Throw(Actor owner, string kind, Vector3 pos, Vector3 vel, float fuse)
        {
            var o = new T { owner = owner, team = owner.team, kind = kind, pos = pos, vel = vel, fuse = fuse >= 0 ? fuse : FUSE[kind], spin = new Vector3(U.Rand(-12, 12), U.Rand(-6, 6), U.Rand(-12, 12)) };
            list.Add(o);
            onSpawn?.Invoke(o);
            Sfx.Click("throw", pos);
        }

        public static Vector3 Aim(Vector3 from, Vector3 to, float maxSpeed)
        {
            float dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
            float dist = Mathf.Sqrt(dx * dx + dz * dz);
            float t = U.Clamp(dist / 13, 0.55f, 2.4f);
            var o = new Vector3(dx / t, dy / t + 0.5f * GRAV * t, dz / t);
            float s = o.magnitude;
            if (s > maxSpeed) o *= maxSpeed / s;
            return o;
        }

        public static void Update(float dt)
        {
            for (int i = 0; i < list.Count; i++)
            {
                var o = list[i];
                o.t += dt;
                if (!o.rest)
                {
                    o.vel.y -= GRAV * dt;
                    float sp = o.vel.magnitude, L = sp * dt;
                    var d = o.vel / (sp > 0 ? sp : 1);
                    if (L > 0 && World.Raycast(o.pos, d, L + 0.06f))
                    {
                        var n = World.hit.normal;
                        if (o.kind == "molotov") { o.pos = World.hit.point + n * 0.1f; Detonate(o); onRemove?.Invoke(o); list.RemoveAt(i--); continue; }
                        o.pos = World.hit.point + n * 0.06f;
                        float vn = Vector3.Dot(o.vel, n);
                        o.vel = (o.vel + n * (-1.45f * vn)) * 0.55f;
                        if (sp > 2.5f && o.t - o.lastBounce > 0.08f) { Sfx.Bounce(o.pos); o.lastBounce = o.t; }
                        o.spin *= 0.6f;
                        if (n.y > 0.65f && o.vel.magnitude < 1.3f) { o.rest = true; o.vel = Vector3.zero; }
                    }
                    else o.pos += o.vel * dt;
                    float wl = World.WaterAt(o.pos.x, o.pos.z);
                    if (o.pos.y < wl - 0.3f && World.HeightAt(o.pos.x, o.pos.z) < wl - 0.3f) { o.vel *= 0.8f; o.vel.y = Mathf.Max(o.vel.y, -1.5f); }
                    o.rot += o.spin * dt;
                }
                if (o.kind == "molotov") Fx.Particle(o.pos + Vector3.up * 0.12f, new Vector3(0, 0.8f, 0), 0.25f, 0.12f, 0.04f, new Color(1f, 0.45f, 0.12f, 0.8f), true);
                if (o.t >= o.fuse && !o.done)
                {
                    Detonate(o);
                    if (o.kind != "smoke") { onRemove?.Invoke(o); list.RemoveAt(i--); continue; }
                }
                if (o.kind == "smoke" && o.done && o.t > o.fuse + 20) { onRemove?.Invoke(o); list.RemoveAt(i--); continue; }
            }
            // 연막
            for (int i = 0; i < smokes.Count; i++)
            {
                var s = smokes[i];
                s.t += dt; float t = s.t;
                s.r = t < 4 ? 7.5f * (1 - Mathf.Pow(1 - t / 4, 2)) : t < 17 ? 7.5f : 7.5f * Mathf.Max(0, 1 - (t - 17) / 5);
                if (t < 15)
                {
                    s.acc += dt * (t < 3 ? 60 : 26);
                    while (s.acc > 1)
                    {
                        s.acc -= 1;
                        float a = U.R() * 6.28f, rr = U.R() * Mathf.Max(1, s.r * 0.75f);
                        Fx.Smoke(new Vector3(s.pos.x + Mathf.Cos(a) * rr, s.pos.y + 0.5f + U.R() * 2.5f, s.pos.z + Mathf.Sin(a) * rr), new Vector3(Mathf.Cos(a) * 0.6f, 0.15f + U.R() * 0.25f, Mathf.Sin(a) * 0.6f), 6 + U.R() * 3.5f, 2.8f, 7 + U.R() * 3, new Color(0.86f, 0.87f, 0.88f, 0.85f));
                    }
                }
                if (t > 23) smokes.RemoveAt(i--);
            }
            // 화염
            float fireVol = 0;
            for (int i = 0; i < fires.Count; i++)
            {
                var f = fires[i];
                f.t -= dt; f.tick -= dt; f.lt -= dt;
                float k = U.Clamp(f.t / 2, 0, 1);
                foreach (var p in f.patches)
                {
                    if (U.R() < dt * 22 * k) Fx.Particle(p + new Vector3(U.Rand(-0.5f, 0.5f), 0.1f, U.Rand(-0.5f, 0.5f)), new Vector3(U.Rand(-0.3f, 0.3f), 1.5f + U.R() * 2, U.Rand(-0.3f, 0.3f)), 0.5f + U.R() * 0.5f, 0.9f, 0.2f, new Color(1f, 0.4f + U.R() * 0.2f, 0.1f, 0.8f), true);
                    if (U.R() < dt * 3 * k) Fx.Smoke(p + Vector3.up * 1.2f, new Vector3(U.Rand(-0.3f, 0.3f), 1.6f, U.Rand(-0.3f, 0.3f)), 3, 0.8f, 3.5f, new Color(0.12f, 0.11f, 0.1f, 0.45f));
                }
                if (f.lt <= 0) { f.lt = 0.2f; Fx.Light(f.pos + Vector3.up * 1.2f, new Color(1f, 0.48f, 0.16f), 6 * k, 0.3f, 18); }
                if (f.tick <= 0)
                {
                    f.tick = 0.25f;
                    foreach (var a in Match.actors.ToArray())
                    {
                        if (!a.alive || a.state != "ground") continue;
                        float dx = a.pos.x - f.pos.x, dz = a.pos.z - f.pos.z;
                        if (dx * dx + dz * dz < f.r * f.r && Mathf.Abs(a.pos.y - f.pos.y) < 2)
                        {
                            if (a.team == f.team && a != f.owner) continue;
                            Match.Damage(a, 3.5f, f.owner, "molotov", false, a.pos, Vector3.zero);
                        }
                    }
                }
                fireVol = Mathf.Max(fireVol, k * 0.9f * 10 / (10 + Vector3.Distance(Sfx.listener, f.pos)));
                if (f.t <= 0) fires.RemoveAt(i--);
            }
            Sfx.SetLoop("fire", fireVol);
        }

        static void Detonate(T o)
        {
            if (Match.training) Training.OnBlast(o);
            o.done = true;
            var p = o.pos;
            onDetonate?.Invoke(o);
            if (o.kind == "frag")
            {
                Fx.Explosion(p);
                Sfx.Explosion(p);
                Fx.Shake(U.Clamp(1.4f - Vector3.Distance(Sfx.listener, p) / 22, 0, 1.2f));
                var e = p + Vector3.up * 0.35f;
                foreach (var a in Match.actors.ToArray())
                {
                    if (!a.alive || a.state != "ground") continue;
                    var c = a.Chest();
                    float d = Vector3.Distance(c, e);
                    if (d > 9) continue;
                    var dir = (c - e).normalized;
                    if (World.RayBoxes(e.x, e.y, e.z, dir.x, dir.y, dir.z, d - 0.3f, false) < float.PositiveInfinity)
                    {
                        c = a.Chest(); c.y = a.pos.y + 0.3f; float d2 = Vector3.Distance(c, e); dir = (c - e).normalized;
                        if (World.RayBoxes(e.x, e.y, e.z, dir.x, dir.y, dir.z, d2 - 0.3f, false) < float.PositiveInfinity) continue;
                    }
                    if (a.team == o.team && a != o.owner) continue;
                    float dmg = 165 * Mathf.Pow(1 - d / 9, 1.3f);
                    if (dmg > 1) Match.Damage(a, dmg, o.owner, "frag", false, c, dir);
                }
                Match.OnNoise(p, 140, o.owner);
                Vehicles.Blast(p, 8, 230, o.owner);
            }
            else if (o.kind == "smoke")
            {
                Sfx.SmokePop(p);
                smokes.Add(new Smoke { pos = p, src = o });
            }
            else if (o.kind == "molotov")
            {
                Sfx.Glass(p);
                float gy = World.Ground(p.x, p.z, p.y + 0.5f, 0.2f, 1.2f);
                var bas = new Vector3(p.x, gy, p.z);
                var patches = new List<Vector3> { bas };
                for (int i = 0; i < 7; i++)
                {
                    float a = i / 7f * Mathf.PI * 2 + U.R() * 0.5f, r = 1.6f + U.R() * 1.4f;
                    float x = p.x + Mathf.Cos(a) * r, z = p.z + Mathf.Sin(a) * r;
                    float y = World.Ground(x, z, gy + 0.6f, 0.1f, 0.9f);
                    if (Mathf.Abs(y - gy) < 1.2f) patches.Add(new Vector3(x, y, z));
                }
                fires.Add(new Fire { pos = bas, r = 3.4f, t = 9, patches = patches, owner = o.owner, team = o.team });
                for (int i = 0; i < 20; i++) Fx.Particle(p + Vector3.up * 0.3f, new Vector3(U.Rand(-4, 4), U.Rand(1, 5), U.Rand(-4, 4)), 0.6f, 0.8f, 0.2f, new Color(1f, 0.42f, 0.08f, 1f), true);
                Match.OnNoise(p, 50, o.owner);
            }
            else if (o.kind == "flash")
            {
                Fx.Flashbang(p);
                Sfx.FlashBang(p);
                var e = p + Vector3.up * 0.3f;
                foreach (var a in Match.actors)
                {
                    if (!a.alive || a.state != "ground") continue;
                    var c = a.Eye();
                    float d = Vector3.Distance(c, e);
                    if (d > FLASH_R) continue;
                    if (!World.Los(e, c)) continue;
                    float facing = Vector3.Dot(a.LookDir(), (e - c).normalized);
                    float far = d < 8 ? 1 : Mathf.Pow(Mathf.Max(0, 1 - (d - 8) / (FLASH_R - 8)), 1.5f);
                    float look = facing > 0.45f ? 1 : facing > -0.2f ? 0.3f + 0.7f * (facing + 0.2f) / 0.65f : 0.15f;
                    float amt = far * look;
                    if (d < 6) amt = Mathf.Max(amt, 0.7f);
                    amt = U.Clamp(amt, 0, 1);
                    if (a.isPlayer) PlayerCtl.Flashed(amt);
                    else a.blindT = Mathf.Max(a.blindT, amt * 5.5f);
                }
                Match.OnNoise(p, 80, o.owner);
            }
        }

        public static bool SmokeBlocks(Vector3 a, Vector3 b)
        {
            foreach (var s in smokes)
            {
                if (s.r < 1.5f) continue;
                for (int k = 0; k < 2; k++)
                    if (SegDist(a, b, new Vector3(s.pos.x, s.pos.y + 1.2f + k * 2.2f, s.pos.z)) < s.r * 0.85f) return true;
            }
            return false;
        }
        public static bool InSmoke(Vector3 p)
        {
            foreach (var s in smokes) if (s.r > 2 && U.Hypot(p.x - s.pos.x, p.z - s.pos.z) < s.r * 0.8f && p.y - s.pos.y < 4.5f) return true;
            return false;
        }
        public static bool FireAt(Vector3 p, float margin)
        {
            foreach (var f in fires) { float dx = p.x - f.pos.x, dz = p.z - f.pos.z; if (dx * dx + dz * dz < (f.r + margin) * (f.r + margin) && Mathf.Abs(p.y - f.pos.y) < 2.5f) return true; }
            return false;
        }
        static float SegDist(Vector3 a, Vector3 b, Vector3 c)
        {
            var ab = b - a; float l2 = ab.sqrMagnitude;
            float t = l2 > 0 ? Vector3.Dot(c - a, ab) / l2 : 0;
            t = U.Clamp(t, 0, 1);
            return Vector3.Distance(a + ab * t, c);
        }
    }
}
