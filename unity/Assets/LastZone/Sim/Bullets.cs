using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 총알 (웹판 G.Ballistics): 중력 · 지형/상자/물/캐릭터/차량/표적 맞힘 · 근접 비행음 · 예광탄
    public static class Bullets
    {
        public class B { public Actor owner; public int team; public GunDef def; public object shot; public Vector3 pos, vel, voff, start; public float dist; public bool whiz; public int tracer = -1; }
        public static readonly List<B> list = new List<B>();

        public static void Reset() { foreach (var p in list) Fx.FreeTracer(p.tracer); list.Clear(); }

        public static void Fire(Actor owner, Vector3 origin, Vector3 dir, GunDef def, Vector3 muzzle, bool tracer, object shot)
        {
            var p = new B { owner = owner, team = owner.team, def = def, shot = shot, pos = origin, vel = dir * (def.vel * U.Rand(0.97f, 1.03f)), start = origin };
            p.voff = muzzle - origin;
            if (tracer) p.tracer = Fx.GetTracer();
            list.Add(p);
        }

        public struct ActorHit { public float t; public bool head; }

        public static bool HitActor(Actor a, Vector3 o, Vector3 d, float maxT, out ActorHit h)
        {
            float best = float.PositiveInfinity; bool head = false;
            float px = a.pos.x, py = a.pos.y, pz = a.pos.z;
            if (a.Low())
            {
                float fx = -Mathf.Sin(a.yaw), fz = -Mathf.Cos(a.yaw);
                float t = SphereT(o, d, px + fx * 0.3f, py + 0.25f, pz + fz * 0.3f, 0.38f); if (t < best) { best = t; head = false; }
                t = SphereT(o, d, px + fx * 0.85f, py + 0.28f, pz + fz * 0.85f, 0.15f); if (t < best) { best = t; head = true; }
                t = SphereT(o, d, px - fx * 0.4f, py + 0.2f, pz - fz * 0.4f, 0.3f); if (t < best) { best = t; head = false; }
            }
            else
            {
                float top = a.crouch ? 1.02f : 1.45f, hy = a.crouch ? 1.2f : 1.64f;
                float lx = a.leanX != 0 ? Mathf.Cos(a.yaw) * a.leanX : 0, lz = a.leanX != 0 ? -Mathf.Sin(a.yaw) * a.leanX : 0;
                float t = CylT(o, d, px, pz, 0.27f, py, py + top * 0.55f); if (t < best) { best = t; head = false; }
                t = CylT(o, d, px + lx * 0.5f, pz + lz * 0.5f, 0.25f, py + top * 0.55f, py + top); if (t < best) { best = t; head = false; }
                t = SphereT(o, d, px + lx, py + hy, pz + lz, 0.15f); if (t < best) { best = t; head = true; }
            }
            h = new ActorHit { t = best, head = head };
            return best <= maxT;
        }

        public static float Dmg(GunDef def, float dist) => def.Damage(dist);

        public static void Update(float dt)
        {
            var player = Match.player;
            for (int i = 0; i < list.Count; i++)
            {
                var p = list[i];
                p.vel.y -= 9.8f * dt;
                float sp = p.vel.magnitude, L = sp * dt;
                var d = p.vel / sp;
                float best = L; string kind = null; Actor target = null; bool head = false;
                Hit wh = default;
                if (World.Raycast(p.pos, d, L)) { best = World.hit.t; kind = "world"; wh = World.hit; }
                // 수면
                float ny = p.pos.y + d.y * best;
                float wl = World.WaterAt(p.pos.x + d.x * best * 0.5f, p.pos.z + d.z * best * 0.5f);
                if (p.pos.y > wl && ny <= wl && d.y < 0) { float tw = (p.pos.y - wl) / -d.y; if (tw < best) { best = tw; kind = "water"; } }
                // 캐릭터
                float mx = p.pos.x + d.x * L * 0.5f, mz = p.pos.z + d.z * L * 0.5f, rr = L * 0.5f + 2.5f;
                foreach (var a in Match.actors)
                {
                    if (!a.alive || a.state != "ground" || a.team == p.team) continue;
                    float dx = a.pos.x - mx, dz = a.pos.z - mz;
                    if (dx * dx + dz * dz > rr * rr) continue;
                    if (HitActor(a, p.pos, d, best, out var h)) { best = h.t; kind = "actor"; target = a; head = h.head; }
                }
                // 차량
                Vehicle vh = null;
                if (Vehicles.list.Count > 0) { var r = Vehicles.RayHit(p.pos, d, best); if (r.v != null) { vh = r.v; best = r.t; kind = "vehicle"; } }
                // 훈련 표적
                Training.TargetHit th = null;
                if (Match.training && Training.active) { th = Training.HitTest(p.pos, d, best); if (th != null) { best = th.t; kind = "target"; } }
                // 근접 비행음
                if (player != null && player.alive && !p.whiz && p.team != player.team)
                {
                    var hpos = new Vector3(player.pos.x, player.pos.y + 1.6f, player.pos.z);
                    float t = U.Clamp(Vector3.Dot(hpos - p.pos, d), 0, best);
                    var q = p.pos + d * t;
                    if (Vector3.Distance(q, hpos) < 2.8f && kind != "actor") { p.whiz = true; Sfx.Whiz(q); Fx.Shake(0.08f); }
                }
                var hp = p.pos + d * best;
                p.dist += best;
                bool dead = false;
                if (kind == "actor")
                {
                    float dist = Vector3.Distance(p.start, hp);
                    float dmg = Dmg(p.def, dist) * (head ? p.def.head : 1);
                    Match.Damage(target, dmg, p.owner, p.def.id, head, hp, d, p.shot);
                    Fx.Blood(hp, d, head ? 10 : 6);
                    Sfx.Impact(hp, SurfMat.Flesh);
                    dead = true;
                }
                else if (kind == "target")
                {
                    float dist = Vector3.Distance(p.start, hp);
                    float dmg = Dmg(p.def, dist) * (th.head ? p.def.head : 1);
                    Training.OnHit(th, dmg, hp, d, p.shot);
                    dead = true;
                }
                else if (kind == "vehicle" || (kind == "world" && wh.box != null && wh.box.tag is Vehicle))
                {
                    var v = vh ?? (Vehicle)wh.box.tag;
                    Vehicles.Damage(v, Dmg(p.def, Vector3.Distance(p.start, hp)) * 0.8f, p.owner, "bullet");
                    Fx.Impact(hp, kind == "world" ? wh.normal : -d, SurfMat.Metal);
                    Sfx.Impact(hp, SurfMat.Metal);
                    dead = true;
                }
                else if (kind == "world")
                {
                    Fx.Impact(hp, wh.normal, wh.mat);
                    Sfx.Impact(hp, wh.mat);
                    dead = true;
                }
                else if (kind == "water") { Fx.Splash(hp); dead = true; }
                else
                {
                    p.pos = hp;
                    if (p.dist > p.def.range || p.pos.y < -20) dead = true;
                }
                if (p.tracer >= 0)
                {
                    float fade = Mathf.Max(0, 1 - p.dist / 30);
                    var head2 = (dead ? hp : p.pos) + p.voff * fade;
                    float len = Mathf.Min(p.def.tracerLen, p.dist);
                    Fx.SetTracer(p.tracer, head2, head2 - d * len, len > 0.3f);
                    if (dead) { Fx.FreeTracer(p.tracer, 0.016f); p.tracer = -1; }
                }
                if (dead) { if (p.tracer >= 0) Fx.FreeTracer(p.tracer); list[i] = list[list.Count - 1]; list.RemoveAt(list.Count - 1); i--; }
            }
        }

        public static float SphereT(Vector3 o, Vector3 d, float cx, float cy, float cz, float r)
        {
            float ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
            float b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r;
            if (c > 0 && b > 0) return float.PositiveInfinity;
            float disc = b * b - c;
            if (disc < 0) return float.PositiveInfinity;
            float t = -b - Mathf.Sqrt(disc);
            return t < 0 ? 0 : t;
        }

        public static float CylT(Vector3 o, Vector3 d, float cx, float cz, float r, float y0, float y1)
        {
            float fx = o.x - cx, fz = o.z - cz;
            float A = d.x * d.x + d.z * d.z;
            if (A < 1e-8f) return float.PositiveInfinity;
            float B = 2 * (fx * d.x + fz * d.z), Cq = fx * fx + fz * fz - r * r;
            float disc = B * B - 4 * A * Cq;
            if (disc < 0) return float.PositiveInfinity;
            float t = (-B - Mathf.Sqrt(disc)) / (2 * A);
            if (t < 0) { if (Cq <= 0) t = 0; else return float.PositiveInfinity; }
            float y = o.y + d.y * t;
            if (y >= y0 && y <= y1) return t;
            if (Mathf.Abs(d.y) > 1e-6f)
            {
                float yc = y > y1 ? y1 : y0, tc = (yc - o.y) / d.y;
                if (tc >= 0) { float hx = fx + d.x * tc, hz = fz + d.z * tc; if (hx * hx + hz * hz <= r * r) return tc; }
            }
            return float.PositiveInfinity;
        }
    }

    public static class Reloads
    {
        public static float Factor(bool empty) => empty ? 1.1f : 1f;
        public static float Duration(string id, bool empty) => Data.Gun(id).reload * Factor(empty);
    }
}
