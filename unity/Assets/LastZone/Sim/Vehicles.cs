using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    public class Vehicle
    {
        public string kind; public Vector3 pos; public float yaw, speed, lat, steer, pitch, roll, spin;
        public Actor driver, claim, lastHit; public Box box; public Dictionary<Actor, float> hitT = new Dictionary<Actor, float>();
        public float noiseT, hp = Vehicles.HP, burnT, wreckT, respawnT; public bool dead, drift, bump;
        public Vehicles.Dim dim; public (float x, float z, float yaw, string kind) home;
        public Vector2? hop; public Vector4 tilt; public bool hasTilt;   // hop: (y, vy) · tilt: (x, z, tx, tz)
        public Vector3?[] skid = new Vector3?[2];
        public object view;
    }

    // 탈 수 있는 차량 (웹판 vehicles.js): 운전 물리(드리프트) · 충돌 · 부서짐/폭발 · 봇 운전
    public static class Vehicles
    {
        public const float HP = 320, MAX = 21, REV = 6, RESPAWN = 25;
        public static readonly string[] Kinds = { "porter", "e2200", "izh" };
        public class Dim { public float hl, hw, top, r; public Vector2[] wheelPts; }
        public static readonly Dim Jeep = new Dim { hl = 1.9f, hw = 0.95f, top = 1.7f, r = 0.42f, wheelPts = new[] { new Vector2(-0.95f, -1.25f), new Vector2(0.95f, -1.25f), new Vector2(-0.95f, 1.25f), new Vector2(0.95f, 1.25f) } };
        public static readonly Dictionary<string, Dim> dims = new Dictionary<string, Dim>();
        public static readonly List<Vehicle> list = new List<Vehicle>();
        public static List<float[]> roads = new List<float[]>();   // [ax, az, bx, bz, w, course]
        public static System.Action<Vehicle> onSpawn, onRemove, onExplode, onSkid;

        static Vector3 F(float yaw) => new Vector3(-Mathf.Sin(yaw), 0, -Mathf.Cos(yaw));
        static Vector3 Rt(float yaw) => new Vector3(Mathf.Cos(yaw), 0, -Mathf.Sin(yaw));
        // 웹 좌표에서 Euler 'YXZ' (pitch x · yaw y · roll z) 회전
        public static Quaternion Rot(float pitch, float yaw, float roll) =>
            Quaternion.AngleAxis(yaw * Mathf.Rad2Deg, Vector3.up) * Quaternion.AngleAxis(pitch * Mathf.Rad2Deg, Vector3.right) * Quaternion.AngleAxis(roll * Mathf.Rad2Deg, Vector3.forward);

        public static Vehicle NewVehicle(float x, float y, float z, float yaw, string kind = null)
        {
            var v = new Vehicle { kind = kind ?? U.Pick(Kinds), pos = new Vector3(x, y, z), yaw = yaw };
            v.home = (x, z, yaw, v.kind);
            v.dim = dims.TryGetValue(v.kind, out var d) ? d : Jeep;
            list.Add(v); Place(v, 1); Block(v);
            onSpawn?.Invoke(v);
            return v;
        }

        public static void Reset()
        {
            foreach (var v in list) { onRemove?.Invoke(v); Unblock(v); }
            list.Clear();
            Sfx.SetLoop("skid", 0); Sfx.SetLoop("engine", 0); Sfx.SetLoop("engineBot", 0);
        }

        public static void Spawn(int n)
        {
            int tries = 0;
            var usable = roads.FindAll(r => r.Length < 6 || r[5] == 0);
            if (usable.Count == 0) return;
            while (list.Count < n && tries++ < n * 30)
            {
                var rd = U.Pick(usable); float t = U.R(), dx = rd[2] - rd[0], dz = rd[3] - rd[1], L = U.Hypot(dx, dz); if (L < 1e-3f) L = 1;
                float side = (U.R() < 0.5f ? -1 : 1) * (rd[4] * 0.5f + 2.2f);
                float x = rd[0] + dx * t - dz / L * side, z = rd[1] + dz * t + dx / L * side;
                if (Mathf.Abs(x) > World.HALF - 30 || Mathf.Abs(z) > World.HALF - 30) continue;
                float y = World.HeightAt(x, z);
                if (y - World.WaterAt(x, z) < 0.6f) continue;
                if (Mathf.Abs(World.HeightAt(x + 2, z) - y) > 0.7f || Mathf.Abs(World.HeightAt(x, z + 2) - y) > 0.7f) continue;
                bool blocked = false;
                World.QueryBoxes(x - 2.6f, z - 2.6f, x + 2.6f, z + 2.6f, b => { if (b.maxY > y + 0.3f && b.minY < y + 2) blocked = true; });
                if (blocked || list.Exists(v => U.Hypot(v.pos.x - x, v.pos.z - z) < 40)) continue;
                NewVehicle(x, y, z, Mathf.Atan2(-dx, -dz) + (U.R() < 0.5f ? Mathf.PI : 0));
            }
        }
        public static Vehicle SpawnAt(float x, float z, float yaw, string kind) => NewVehicle(x, World.HeightAt(x, z), z, yaw, kind ?? "izh");

        static void Block(Vehicle v)
        {
            float c = Mathf.Abs(Mathf.Cos(v.yaw)), s = Mathf.Abs(Mathf.Sin(v.yaw)); var D = v.dim;
            float hx = D.hw * c + D.hl * s - 0.25f * Mathf.Min(c, s) * 2, hz = D.hw * s + D.hl * c - 0.25f * Mathf.Min(c, s) * 2;
            v.box = World.AddCollider(v.pos.x - hx, v.pos.y, v.pos.z - hz, v.pos.x + hx, v.pos.y + Mathf.Min(1.9f, D.top), v.pos.z + hz, SurfMat.Metal, true);
            v.box.tag = v;
        }
        static void Unblock(Vehicle v) { World.RemoveCollider(v.box); v.box = null; }

        static float GroundAt(float x, float z) => Mathf.Max(World.HeightAt(x, z), World.WaterAt(x, z) - 0.9f);

        public static Quaternion BodyRot(Vehicle v) => Rot(v.pitch + (v.hasTilt ? v.tilt.x : 0), v.yaw, v.roll + (v.hasTilt ? v.tilt.y : 0));

        static void Place(Vehicle v, float k)
        {
            var f = F(v.yaw); var r = Rt(v.yaw);
            float H(float ox, float oz) => GroundAt(v.pos.x + f.x * oz + r.x * ox, v.pos.z + f.z * oz + r.z * ox);
            var D = v.dim; float L = D.hl * 0.75f, Wd = D.hw;
            float hf = H(0, L), hb = H(0, -L), hl = H(-Wd, 0), hr = H(Wd, 0);
            float pitch = Mathf.Atan2(hf - hb, 2 * L), roll = Mathf.Atan2((hr - hl) * Mathf.Cos(pitch), 2 * Wd);
            v.pitch = U.Lerp(v.pitch, pitch, k); v.roll = U.Lerp(v.roll, roll, k);
            var q = BodyRot(v);
            float supportY = float.NegativeInfinity;
            foreach (var w in D.wheelPts)
            {
                var s = q * new Vector3(w.x, 0, w.y);
                supportY = Mathf.Max(supportY, GroundAt(v.pos.x + s.x, v.pos.z + s.z) - s.y);
            }
            v.pos.y = Mathf.Max(supportY, U.Lerp(v.pos.y, supportY, k));
        }

        public static Vehicle Near(Actor a)
        {
            Vehicle best = null; float bd = 3.4f;
            foreach (var v in list)
            {
                if (v.driver != null || v.dead) continue;
                float d = U.Hypot(v.pos.x - a.pos.x, v.pos.z - a.pos.z);
                if (d < bd && Mathf.Abs(v.pos.y - a.pos.y) < 2.5f) { bd = d; best = v; }
            }
            return best;
        }

        public static void Enter(Actor a, Vehicle v)
        {
            Unblock(v);
            v.driver = a; v.claim = null; a.inVehicle = true; a.vehicle = v;
            a.crouch = false; a.prone = false; a.leanX = 0;
            Sfx.Event("close", "ka47", v.pos);
        }

        // 내리기 (왼쪽 → 오른쪽 → 뒤 → 앞에서 빈 곳). 못 내리면 false
        public static bool Exit(Actor a, bool forced)
        {
            var v = a.vehicle as Vehicle; if (v == null) return false;
            var r = Rt(v.yaw);
            bool done = false;
            foreach (var o in new[] { new Vector2(-1.9f, 0), new Vector2(1.9f, 0), new Vector2(0, 3), new Vector2(0, -3) })
            {
                float x = v.pos.x + r.x * o.x + Mathf.Sin(v.yaw) * o.y, z = v.pos.z + r.z * o.x + Mathf.Cos(v.yaw) * o.y;
                bool free = true;
                World.QueryBoxes(x - 0.4f, z - 0.4f, x + 0.4f, z + 0.4f, b => { if (b.maxY > v.pos.y + 0.5f && b.minY < v.pos.y + 1.8f) free = false; });
                if (!free) continue;
                a.pos = new Vector3(x, Mathf.Max(World.HeightAt(x, z), v.pos.y - 0.5f), z); done = true; break;
            }
            if (!done && !forced) return false;
            if (!done) a.pos = new Vector3(v.pos.x, v.pos.y + 1.8f, v.pos.z);
            a.vel = new Vector3(-Mathf.Sin(v.yaw) * v.speed * 0.5f, 0, -Mathf.Cos(v.yaw) * v.speed * 0.5f);
            a.pitch = 0;
            v.driver = null; a.inVehicle = false; a.vehicle = null;
            if (Mathf.Abs(v.speed) < 1.5f) { v.speed = 0; Block(v); }
            if (a.isPlayer) Sfx.SetLoop("engine", 0);
            return true;
        }
        public static void ForceExit(Actor a)
        {
            if (a.brain != null && a.brain.vehicle != null) BotExit(a.brain);
            else if (a.isPlayer && a.vehicle != null) PlayerCtl.ExitVehicle(true);
        }

        // 운전 한 단계 (플레이어·봇 공용). thr -1..1, st 왼쪽 +, brake, hand(핸드브레이크)
        public static void Step(Vehicle v, Actor a, float dt, float thr, float st, bool brake, bool hand = false)
        {
            float wet = World.WaterAt(v.pos.x, v.pos.z) - World.HeightAt(v.pos.x, v.pos.z);
            float top = wet > 0.5f ? 4 : MAX;
            if (v.dead) { thr = 0; st = 0; brake = true; hand = false; }
            float weak = v.hp < HP * 0.3f ? 0.65f : 1;
            if (hand)
            {
                if (Mathf.Abs(st) > 0.2f && Mathf.Abs(v.speed) > 6)
                {
                    v.speed = U.Approach(v.speed, 0, 1.8f * dt);
                    if (thr > 0 && v.speed > 0) v.speed = Mathf.Min(top, v.speed + 6 * weak * (1 - v.speed / (top + 4)) * dt);
                }
                else v.speed = U.Approach(v.speed, 0, 16 * dt);
            }
            else if (brake) v.speed = U.Approach(v.speed, 0, 26 * dt);
            else if (thr > 0) v.speed = v.speed < 0 ? U.Approach(v.speed, 0, 22 * dt) : Mathf.Min(top, v.speed + 9.5f * weak * (1 - v.speed / (top + 4)) * dt);
            else if (thr < 0) v.speed = v.speed > 0.5f ? U.Approach(v.speed, 0, 20 * dt) : Mathf.Max(-REV, v.speed - 6 * dt);
            else v.speed = U.Approach(v.speed, 0, (2.2f + Mathf.Abs(v.speed) * 0.12f) * dt);
            if (v.speed > top) v.speed = U.Approach(v.speed, top, 14 * dt);
            v.steer = U.Damp(v.steer, st, 7, dt);
            float lockA = 0.55f / (1 + Mathf.Abs(v.speed) * 0.06f);
            var f = F(v.yaw); var r = Rt(v.yaw);
            var vel = f * v.speed + r * v.lat;
            bool slide = hand && Mathf.Abs(v.speed) > 6;
            float yawRate = v.steer * lockA * v.speed / 2.6f;
            if (slide) yawRate *= 1.25f;
            else if (Mathf.Abs(v.lat) > 1.5f) yawRate += v.steer * 0.35f * Mathf.Sign(v.speed);
            v.yaw += yawRate * dt;
            f = F(v.yaw); r = Rt(v.yaw);
            v.speed = Vector3.Dot(vel, f); v.lat = Vector3.Dot(vel, r);
            float grip = slide ? 2.2f : wet > 0.3f ? 2.5f : 7.5f;
            float lat0 = v.lat;
            v.lat *= Mathf.Exp(-grip * dt);
            if (!slide && v.speed > 0) v.speed = Mathf.Min(top, v.speed + Mathf.Abs(lat0 - v.lat) * 0.25f);
            if (Mathf.Abs(v.lat) < 0.02f) v.lat = 0;
            v.drift = Mathf.Abs(v.lat) > 2.2f && Mathf.Abs(v.speed) > 4;
            float nx = v.pos.x + (f.x * v.speed + r.x * v.lat) * dt, nz = v.pos.z + (f.z * v.speed + r.z * v.lat) * dt;
            float lead = Mathf.Sign(v.speed) * 2.2f, slope = (World.HeightAt(nx + f.x * lead, nz + f.z * lead) - World.HeightAt(nx, nz)) / 2.2f;
            if (slope > 0.95f) { v.speed *= -0.15f; v.lat = 0; nx = v.pos.x; nz = v.pos.z; }
            bool bumped = false;
            var D = v.dim; float offL = Mathf.Max(0.6f, D.hl - D.hw);
            foreach (var off in new[] { offL, 0, -offL })
            {
                float cx0 = nx + f.x * off, cz0 = nz + f.z * off, rr = D.hw + 0.05f;
                float cx = cx0, cz = cz0;
                World.QueryBoxes(cx - rr, cz - rr, cx + rr, cz + rr, b =>
                {
                    if (b.maxY <= v.pos.y + 0.55f || b.minY >= v.pos.y + 1.7f) return;
                    float px = cx < b.minX ? b.minX : cx > b.maxX ? b.maxX : cx, pz = cz < b.minZ ? b.minZ : cz > b.maxZ ? b.maxZ : cz;
                    float dx = cx - px, dz = cz - pz, d2 = dx * dx + dz * dz;
                    if (d2 >= rr * rr) return;
                    if (d2 > 1e-8f) { float d = Mathf.Sqrt(d2); cx += dx / d * (rr - d); cz += dz / d * (rr - d); }
                    else { float sg = Mathf.Sign(v.speed != 0 ? v.speed : 1); cx = cx0 - f.x * sg * 0.3f; cz = cz0 - f.z * sg * 0.3f; }
                    bumped = true;
                });
                nx += cx - cx0; nz += cz - cz0;
            }
            if (bumped)
            {
                float hitV = U.Hypot(v.speed, v.lat);
                if (!v.bump && hitV > 9) { if (a.isPlayer) Fx.Shake(0.3f); Sfx.Impact(v.pos, SurfMat.Metal); Match.Damage(a, Mathf.Min(30, (hitV - 9) * 2.2f), null, "fall", false, a.pos, Vector3.zero); Damage(v, (hitV - 9) * 6, null, "crash"); }
                v.speed *= Mathf.Pow(0.02f, dt); v.lat *= Mathf.Pow(0.02f, dt);
            }
            v.bump = bumped;
            float lim = World.HALF - 6;
            v.pos.x = U.Clamp(nx, -lim, lim); v.pos.z = U.Clamp(nz, -lim, lim);
            Place(v, 1 - Mathf.Exp(-10 * dt));
            v.spin = (v.spin + v.speed / Mathf.Max(0.2f, D.r) * dt) % (Mathf.PI * 2);
            Tires(v, dt);
            if (v.driver != a) return;
            // 들이받기
            if (Mathf.Abs(v.speed) > 5)
            {
                float now = Match.time, s = Mathf.Sign(v.speed);
                foreach (var t in Match.actors.ToArray())
                {
                    if (!t.alive || t == a || t.team == a.team || t.state != "ground") continue;
                    float dx = t.pos.x - (v.pos.x + f.x * 1.3f * s), dz = t.pos.z - (v.pos.z + f.z * 1.3f * s);
                    if (dx * dx + dz * dz > 1.6f * 1.6f || Mathf.Abs(t.pos.y - v.pos.y) > 1.8f) continue;
                    if ((v.hitT.TryGetValue(t, out var ht) ? ht : -9) > now - 0.7f) continue;
                    v.hitT[t] = now;
                    var c = t.Chest();
                    Match.Damage(t, Mathf.Abs(v.speed) * 7, a, "vehicle", false, c, f);
                    Fx.Blood(c, new Vector3(f.x * s, 0.3f, f.z * s), 8); Sfx.Impact(c, SurfMat.Flesh);
                    t.vel.x += f.x * v.speed * 0.6f; t.vel.z += f.z * v.speed * 0.6f; t.vel.y = 3.5f;
                    v.speed *= 0.82f;
                }
            }
            a.pos = v.pos; a.vel = new Vector3(f.x * v.speed + r.x * v.lat, 0, f.z * v.speed + r.z * v.lat); a.hspeed = Mathf.Abs(v.speed); a.onGround = true; a.yaw = v.yaw; a.pitch = 0;
        }

        static void Tires(Vehicle v, float dt)
        {
            bool near = Vector3.Distance(v.pos, Sfx.listener) < 160;
            if (!v.drift || !near || v.dead) { v.skid[0] = v.skid[1] = null; if (v.driver != null && v.driver.isPlayer) Sfx.SetLoop("skid", 0); return; }
            int i = 0;
            foreach (var w in v.dim.wheelPts)
            {
                if (w.y <= 0 || i > 1) continue;
                var o = Quaternion.AngleAxis(v.yaw * Mathf.Rad2Deg, Vector3.up) * new Vector3(w.x, 0, w.y) + v.pos;
                o.y = World.HeightAt(o.x, o.z) + 0.03f;
                var last = v.skid[i];
                if (last.HasValue && (last.Value - o).sqrMagnitude > 0.09f) { Fx.SkidMark(last.Value, o); v.skid[i] = o; }
                else if (!last.HasValue) v.skid[i] = o;
                if (U.R() < dt * 22) Fx.Dust(o, new Vector3(-v.lat * 0.04f, 0.35f, 0), new Color(0.62f, 0.62f, 0.6f), 1.1f);
                i++;
            }
            if (v.driver != null && v.driver.isPlayer) Sfx.SetLoop("skid", U.Clamp(Mathf.Abs(v.lat) / 7, 0.15f, 0.55f));
        }

        public static (Vehicle v, float t) RayHit(Vector3 o, Vector3 d, float maxT)
        {
            Vehicle best = null; float bt = float.PositiveInfinity;
            foreach (var v in list)
            {
                var D = v.dim; float R = D.hl + 1;
                float dx = v.pos.x - o.x, dz = v.pos.z - o.z;
                float tc = dx * d.x + dz * d.z, h = dx * dx + dz * dz - tc * tc / (d.x * d.x + d.z * d.z + 1e-9f);
                if (h > R * R || tc < -R || tc > maxT + R) continue;
                float c = Mathf.Cos(v.yaw), s = Mathf.Sin(v.yaw);
                float lx = c * (o.x - v.pos.x) - s * (o.z - v.pos.z), lz = s * (o.x - v.pos.x) + c * (o.z - v.pos.z), ly = o.y - v.pos.y - (v.hop.HasValue ? v.hop.Value.x : 0);
                float ldx = c * d.x - s * d.z, ldz = s * d.x + c * d.z, ldy = d.y;
                float t0 = 0, t1 = maxT;
                var axes = new[] { (lx, ldx, -D.hw, D.hw), (ly, ldy, 0.3f, D.top * 0.92f), (lz, ldz, -D.hl, D.hl) };
                foreach (var (p, q, lo, hi) in axes)
                {
                    if (Mathf.Abs(q) < 1e-9f) { if (p < lo || p > hi) { t0 = float.PositiveInfinity; break; } continue; }
                    float aa = (lo - p) / q, bb = (hi - p) / q;
                    if (aa > bb) { var t = aa; aa = bb; bb = t; }
                    t0 = Mathf.Max(t0, aa); t1 = Mathf.Min(t1, bb);
                    if (t0 > t1) break;
                }
                if (t0 <= t1 && t0 < maxT && t0 < bt) { best = v; bt = t0; }
            }
            return (best, bt);
        }

        public static void Damage(Vehicle v, float amt, Actor by, string kind)
        {
            if (v == null || v.dead || amt <= 0) return;
            if (by != null) v.lastHit = by;
            v.hp -= amt;
            if (v.hp <= 0 && v.burnT <= 0) { v.hp = 0; v.burnT = kind == "blast" ? 0.45f + U.R() * 0.5f : 2.4f; Sfx.Impact(v.pos, SurfMat.Metal); }
            else if (v.burnT > 0 && kind == "blast") v.burnT = Mathf.Min(v.burnT, 0.5f);
        }

        public static void Blast(Vector3 p, float r, float dmg, Actor by, Vehicle skip = null)
        {
            foreach (var v in list)
            {
                if (v == skip || v.dead) continue;
                float d = U.Hypot(v.pos.x - p.x, v.pos.z - p.z) - v.dim.hw * 0.6f;
                if (d < r && Mathf.Abs(v.pos.y - p.y) < 4) Damage(v, dmg * Mathf.Pow(1 - Mathf.Max(0, d) / r, 1.1f), by, "blast");
            }
        }

        public static Vector3 Center(Vehicle v) => Quaternion.AngleAxis(v.yaw * Mathf.Rad2Deg, Vector3.up) * new Vector3(0, v.dim.top * 0.45f, 0) + v.pos;
        public static Vector3 Engine(Vehicle v) => Quaternion.AngleAxis(v.yaw * Mathf.Rad2Deg, Vector3.up) * new Vector3(0, v.dim.top * 0.62f, -v.dim.hl * 0.62f) + v.pos;

        static void Explode(Vehicle v)
        {
            var by = v.lastHit;
            v.dead = true; v.burnT = 0;
            var d0 = v.driver;
            if (d0 != null) { if (d0.isPlayer) PlayerCtl.ExitVehicle(true); else if (d0.brain != null && d0.brain.vehicle == v) BotExit(d0.brain); else v.driver = null; }
            v.speed = 0; v.lat = 0;
            if (d0 != null && d0.isPlayer) { Sfx.SetLoop("skid", 0); Sfx.SetLoop("engine", 0); }
            var p = Center(v);
            Fx.Explosion(p);
            Fx.Explosion(p + new Vector3((U.R() - 0.5f) * 1.6f, 0.6f, (U.R() - 0.5f) * 2.4f));
            Fx.Light(p, new Color(1f, 0.5f, 0.19f), 16, 0.6f, 70);
            Fx.Debris(p, 26);
            Sfx.Explosion(p); Sfx.Impact(p, SurfMat.Metal);
            Fx.Shake(U.Clamp(1.8f - Vector3.Distance(Sfx.listener, p) / 30, 0, 1.4f));
            foreach (var a in Match.actors.ToArray())
            {
                if (!a.alive || a.state != "ground") continue;
                var c = a.Chest(); float d = Vector3.Distance(c, p);
                if (d > 9) continue;
                var dir = (c - p).normalized;
                if (a != d0 && World.RayBoxes(p.x, p.y, p.z, dir.x, dir.y, dir.z, Mathf.Max(0, d - 0.3f), false) < float.PositiveInfinity) continue;
                float dmg = a == d0 ? 260 : 210 * Mathf.Pow(1 - d / 9, 1.2f);
                if (dmg > 1) { Match.Damage(a, dmg, by, "carbomb", false, c, dir); a.vel.x += dir.x * 6; a.vel.z += dir.z * 6; a.vel.y = Mathf.Max(a.vel.y, 3.5f); }
            }
            Match.OnNoise(p, 170, by);
            Blast(p, 8, 300, by, v);
            v.hop = new Vector2(0, 5.5f + U.R() * 1.5f);
            v.hasTilt = true; v.tilt = new Vector4((U.R() - 0.5f) * 0.3f, (U.R() - 0.5f) * 0.45f, (U.R() - 0.5f) * 0.12f, (U.R() < 0.5f ? -1 : 1) * (0.06f + U.R() * 0.1f));
            v.wreckT = 0;
            onExplode?.Invoke(v);
            if (v.box == null) Block(v);
        }

        static void BurnFx(Vehicle v, float dt)
        {
            if (Vector3.Distance(v.pos, Sfx.listener) > 220) return;
            var e = Engine(v); float hpK = v.hp / HP;
            if (v.dead)
            {
                if (v.wreckT < 14)
                {
                    if (U.R() < dt * 26) Flame(Center(v) + new Vector3((U.R() - 0.5f) * v.dim.hw, 0.2f, (U.R() - 0.5f) * v.dim.hl), 0.8f);
                    if (U.R() < dt * 9) Fx.Dust(Center(v) + Vector3.up * 0.8f, new Vector3(0, 1.6f, 0), new Color(0.09f, 0.085f, 0.08f), 2.4f);
                }
                else if (v.wreckT < 45 && U.R() < dt * 4) Fx.Dust(Center(v) + Vector3.up * 0.6f, new Vector3(0, 1.2f, 0), new Color(0.2f, 0.19f, 0.18f), 2);
                return;
            }
            if (v.burnT > 0)
            {
                if (U.R() < dt * 60) Flame(e + new Vector3((U.R() - 0.5f) * 0.8f, 0.1f, (U.R() - 0.5f) * 0.7f), 1.1f);
                if (U.R() < dt * 14) Fx.Dust(e + Vector3.up * 0.5f, new Vector3(0, 1.8f, 0), new Color(0.08f, 0.07f, 0.07f), 2.2f);
            }
            else if (hpK < 0.55f && U.R() < dt * (hpK < 0.3f ? 16 : 7))
            {
                float g = hpK < 0.3f ? 0.12f : 0.45f;
                Fx.Dust(e + Vector3.up * 0.25f, new Vector3(0, 1.3f, 0), new Color(g, g, g * 0.97f), hpK < 0.3f ? 1.8f : 1.3f);
            }
        }
        static void Flame(Vector3 p, float k) => Fx.Particle(p, new Vector3((U.R() - 0.5f) * 0.6f, 1.6f + U.R() * 1.6f, (U.R() - 0.5f) * 0.6f), 0.4f + U.R() * 0.4f, 0.85f * k, 0.15f, new Color(1f, 0.42f + U.R() * 0.12f, 0.1f, 0.85f), true);

        /* ---------------- 봇 운전 ---------------- */
        public static Vehicle FreeNear(Actor a, float r)
        {
            Vehicle best = null; float bd = r;
            foreach (var v in list)
            {
                if (v.driver != null || v.dead || v.hp < HP * 0.3f || (v.claim != null && v.claim != a && v.claim.alive)) continue;
                if (World.WaterAt(v.pos.x, v.pos.z) - World.HeightAt(v.pos.x, v.pos.z) > 0.3f) continue;
                float d = U.Hypot(v.pos.x - a.pos.x, v.pos.z - a.pos.z);
                if (d < bd && Mathf.Abs(v.pos.y - a.pos.y) < 3) { bd = d; best = v; }
            }
            return best;
        }
        class BotDriveSt { public float vRev, vRevSt, vT; public Vector3 vLast; }
        static readonly Dictionary<Bot, BotDriveSt> bd = new Dictionary<Bot, BotDriveSt>();
        public static bool BotEnter(Bot bot, Vehicle v)
        {
            var a = bot.a;
            if (v.driver != null) return false;
            Unblock(v);
            v.driver = a; v.claim = null; bot.vehicle = v; a.inVehicle = true; a.vehicle = v;
            a.crouch = false; a.prone = false; a.leanX = 0;
            bot.vStop = false; bot.vStuck = 0; bd[bot] = new BotDriveSt { vLast = v.pos };
            Sfx.Event("close", "ka47", v.pos);
            return true;
        }
        public static void BotExit(Bot bot)
        {
            var v = bot.vehicle; var a = bot.a;
            if (v == null) return;
            var r = Rt(v.yaw); bool done = false;
            foreach (var o in new[] { new Vector2(-1.9f, 0), new Vector2(1.9f, 0), new Vector2(0, 3), new Vector2(0, -3) })
            {
                float x = v.pos.x + r.x * o.x + Mathf.Sin(v.yaw) * o.y, z = v.pos.z + r.z * o.x + Mathf.Cos(v.yaw) * o.y;
                bool free = true;
                World.QueryBoxes(x - 0.4f, z - 0.4f, x + 0.4f, z + 0.4f, b => { if (b.maxY > v.pos.y + 0.5f && b.minY < v.pos.y + 1.8f) free = false; });
                if (!free) continue;
                a.pos = new Vector3(x, Mathf.Max(World.HeightAt(x, z), v.pos.y - 0.5f), z); done = true; break;
            }
            if (!done) a.pos = new Vector3(v.pos.x, v.pos.y + 1.8f, v.pos.z);
            a.vel = new Vector3(-Mathf.Sin(v.yaw) * v.speed * 0.4f, 0, -Mathf.Cos(v.yaw) * v.speed * 0.4f);
            a.yaw = v.yaw; a.pitch = 0;
            v.driver = null; bot.vehicle = null; a.inVehicle = false; a.vehicle = null;
            if (Mathf.Abs(v.speed) < 1.5f) { v.speed = 0; Block(v); }
        }
        public static bool BotDrive_(Bot bot, float dt, Vector3 goal) => BotDriveStep(bot, dt, goal);
        public static bool BotDrive(Bot bot, float dt, Vector3 goal) => BotDriveStep(bot, dt, goal);
        static bool BotDriveStep(Bot bot, float dt, Vector3 goal)
        {
            var a = bot.a; var v = bot.vehicle;
            if (!bd.TryGetValue(bot, out var S)) bd[bot] = S = new BotDriveSt { vLast = v.pos };
            float dx = goal.x - v.pos.x, dz = goal.z - v.pos.z, dist = U.Hypot(dx, dz);
            if (dist < 18) { Step(v, a, dt, 0, 0, true); return Mathf.Abs(v.speed) < 1; }
            float want = Mathf.Atan2(-dx, -dz);
            float diff = U.AngleDiff(v.yaw, want);
            float look = 5 + Mathf.Abs(v.speed) * 0.5f;
            bool Ahead(float yaw)
            {
                float fx = -Mathf.Sin(yaw), fz = -Mathf.Cos(yaw), rx = -fz, rz = fx;
                foreach (var o in new[] { 0f, -0.95f, 0.95f }) if (World.RayBoxes(v.pos.x + rx * o, v.pos.y + 1, v.pos.z + rz * o, fx, 0, fz, look, false) < float.PositiveInfinity) return true;
                float hx = v.pos.x + fx * look, hz = v.pos.z + fz * look;
                return World.HeightAt(hx, hz) - v.pos.y > 2.2f || World.WaterAt(hx, hz) - World.HeightAt(hx, hz) > 0.6f;
            }
            bool blocked = Ahead(v.yaw);
            if (blocked)
                foreach (var t in new[] { 0.5f, 0.9f, 1.4f })
                {
                    if (!Ahead(v.yaw + t)) { diff = t; break; }
                    if (!Ahead(v.yaw - t)) { diff = -t; break; }
                }
            float thr = Mathf.Abs(diff) > 1.6f ? 0.5f : 1, st = U.Clamp(diff * 2.2f, -1, 1);
            S.vT += dt;
            if (S.vRev > 0) { S.vRev -= dt; thr = -1; st = -S.vRevSt; }
            else if (S.vT > 2)
            {
                if (Vector3.Distance(v.pos, S.vLast) < 2.5f) { bot.vStuck++; S.vRev = 1.3f; S.vRevSt = st != 0 ? st : 1; }
                else bot.vStuck = Mathf.Max(0, bot.vStuck - 1);
                S.vT = 0; S.vLast = v.pos;
            }
            bool slow = (Mathf.Abs(diff) > 0.8f && v.speed > 9) || (blocked && v.speed > 7);
            if (thr > 0 && v.speed > 15) thr = 0;
            Step(v, a, dt, slow ? 0 : thr, st, slow);
            return false;
        }

        static bool Respawn(Vehicle v)
        {
            var H = v.home;
            foreach (var a in Match.actors) if (a.alive && U.Hypot(a.pos.x - H.x, a.pos.z - H.z) < 5) return false;
            foreach (var o in list) if (o != v && U.Hypot(o.pos.x - H.x, o.pos.z - H.z) < 5) return false;
            onRemove?.Invoke(v); Unblock(v);
            list.Remove(v);
            var n = NewVehicle(H.x, World.HeightAt(H.x, H.z), H.z, H.yaw, H.kind);
            Fx.Dust(n.pos + Vector3.up * 0.4f, new Vector3(0, 0.6f, 0), new Color(0.55f, 0.52f, 0.48f), 1.6f, 10);
            return true;
        }

        public static void Update(float dt)
        {
            foreach (var v in list) if (v.dead) v.wreckT += dt;
            foreach (var v in list.ToArray()) if (v.dead && v.wreckT > RESPAWN && (v.respawnT -= dt) <= 0) { if (!Respawn(v)) v.respawnT = 2; }
            Vehicle near = null; float nd = 120;
            foreach (var v in list) if (v.driver != null && !v.driver.isPlayer) { float d = Vector3.Distance(v.pos, Sfx.listener); if (d < nd) { nd = d; near = v; } }
            if (near != null) Sfx.SetLoop("engineBot", 0.5f + Mathf.Abs(near.speed) / MAX * 0.3f, near.pos, 0.7f + Mathf.Abs(near.speed) / MAX * 1.1f);
            else Sfx.SetLoop("engineBot", 0);
            foreach (var v in list.ToArray())
            {
                if (v.hp < HP * 0.55f || v.dead) BurnFx(v, dt);
                if (v.burnT > 0) { v.burnT -= dt; if (v.burnT <= 0) Explode(v); }
                if (v.hop.HasValue)
                {
                    var h = v.hop.Value; h.y -= 18 * dt; h.x += h.y * dt;
                    v.tilt.x = U.Damp(v.tilt.x, v.tilt.z, 3, dt); v.tilt.y = U.Damp(v.tilt.y, v.tilt.w, 3, dt);
                    if (h.x <= 0 && h.y < 0) { h.x = 0; if (h.y < -3) { h.y *= -0.25f; Sfx.Impact(v.pos, SurfMat.Metal); v.hop = h; } else v.hop = null; }
                    else v.hop = h;
                    Place(v, 1);
                }
            }
            foreach (var v in list)
            {
                if (v.driver != null)
                {
                    var d = v.driver;
                    if (!d.alive || d.knocked) { if (d.isPlayer) PlayerCtl.ExitVehicle(true); else if (d.brain != null && d.brain.vehicle == v) BotExit(d.brain); else v.driver = null; }
                    else if (!d.isPlayer)
                    {
                        v.noiseT -= dt;
                        if (v.noiseT <= 0) { v.noiseT = 1; Match.OnNoise(v.pos, 45 + Mathf.Abs(v.speed) * 2.5f, d); }
                        if (Mathf.Abs(v.speed) > 7 && U.R() < dt * 14 && Vector3.Distance(v.pos, Sfx.listener) < 120) Fx.Dust(v.pos + F(v.yaw) * (-1.7f * Mathf.Sign(v.speed)), new Vector3(0, 0.3f, 0), new Color(0.5f, 0.45f, 0.36f), 1.4f);
                    }
                    continue;
                }
                if (v.speed == 0 && v.lat == 0) continue;
                v.speed = U.Approach(v.speed, 0, 9 * dt); v.lat = U.Approach(v.lat, 0, 12 * dt);
                var f = F(v.yaw); var r = Rt(v.yaw);
                float nx = v.pos.x + (f.x * v.speed + r.x * v.lat) * dt, nz = v.pos.z + (f.z * v.speed + r.z * v.lat) * dt;
                bool hit = false;
                World.QueryBoxes(nx - 1.2f, nz - 1.2f, nx + 1.2f, nz + 1.2f, b => { if (b.maxY > v.pos.y + 0.55f && b.minY < v.pos.y + 1.7f) hit = true; });
                if (hit) { v.speed = 0; v.lat = 0; } else { v.pos.x = nx; v.pos.z = nz; }
                Place(v, 1 - Mathf.Exp(-10 * dt));
                v.spin = (v.spin + v.speed / Mathf.Max(0.2f, v.dim.r) * dt) % (Mathf.PI * 2);
                if (v.speed == 0 && v.lat == 0 && v.box == null) Block(v);
            }
        }
    }
}
