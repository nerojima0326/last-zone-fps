using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 훈련 기지 (웹판 training.js): 사람 표적 · 움직이는 표적 · 강철판 · 테이블의 총/조준경/부착물 · 킬하우스 · 투척 훈련장 · 운전 코스
    public static class Training
    {
        const float HP = 100;
        public class Target
        {
            public string kind = "sil"; public Vector3 root; public float yaw, pivotY = 0.06f, d, hp = HP, down, fall, swing, swingV, r, cy;
            public bool civ, kh, hitCiv, cart; public string zone; public (float a, float b, float sp, float ph, bool stop)? move;
            public float fd; public bool fh; public Vector3 fp; public object view;
            public Quaternion PivotRot => Vehicles.Rot(kind == "sil" ? -Mathf.PI / 2 * (1 - (1 - fall) * (1 - fall)) : -swing * 0.35f, yaw, 0);
            public Vector3 PivotPos => root + Vehicles.Rot(0, yaw, 0) * new Vector3(0, pivotY, 0);
        }
        public class TargetHit { public float t; public Target target; public bool head; }
        public class KillHouse { public bool active, inside; public float t; public int enemies, civ, civHit; public float best; public List<Target> targets = new List<Target>(); }
        public class Msg { public Vector3 pos; public string text; public float t; public bool head, kill; public float dmg; }

        public static bool active;
        public static readonly List<Target> targets = new List<Target>();
        public static readonly List<LootItem> items = new List<LootItem>();
        static readonly List<(string kind, Vector3 slot, float at)> respawns = new List<(string, Vector3, float)>();
        public static readonly List<Msg> nums = new List<Msg>();
        public static (int shots, int hits, int heads, float last, int downs, float dmg) stats;
        public static KillHouse kh;
        public static System.Action onBuild, onClear;
        public static Vector3 Spawn = new Vector3(-731.8f, 4, 710.5f);

        // 기지 배치 (웹판 W.range · W.base · W.course 값)
        public static float RX = -735, RY = 4, Line = 706;
        public static readonly float[] Rails = { 20, 40, 60 };
        public static readonly (float x0, float x1, float z, float y)[] Tables = { (-749, -743.4f, 707.1f, 4.94f), (-741.8f, -736.2f, 707.1f, 4.94f), (-734.6f, -729, 707.1f, 4.94f), (-727.4f, -721.8f, 707.1f, 4.94f) };
        public static readonly (float x0, float x1, float z0, float z1, float y) AttTable = (-741, -729, 712.2f, 714.2f, 4.94f);
        public static readonly (float x0, float x1, float z0, float z1, float xm) Kill = (-790, -760, 740, 764, -775);
        public static readonly (float x0, float x1, float z0, float z1, float y0, float y1) Bunker = (-741.8f, -738.2f, 756.2f, 759.8f, 4, 6.6f);
        public static readonly (float x0, float x1, float z0, float z1) Trench = (-732, -716, 765.6f, 767.4f);
        public static readonly (float x, float z, float[] r) Rings = (-712, 777, new[] { 1.5f, 3f, 4.5f });
        public static readonly (float x0, float x1, float z0, float z1, float spurX) Course = (-679, -595, 624, 724, -727);

        static float Gy(float x, float z) => World.HeightAt(x, z);

        static Target AddSil(float x, float d, float? z = null, float? y = null, float yaw = 0, bool civ = false, bool khT = false, string zone = null)
        {
            float zz = z ?? Line - d, yy = y ?? Gy(x, zz);
            var t = new Target { root = new Vector3(x, yy, zz), yaw = yaw, d = d, civ = civ, kh = khT, zone = zone };
            targets.Add(t);
            return t;
        }

        public static void Begin()
        {
            active = true;
            targets.Clear(); items.Clear(); nums.Clear(); respawns.Clear();
            stats = (0, 0, 0, 0, 0, 0);
            float x0 = RX;
            AddSil(x0 - 3, 7); AddSil(x0 + 3, 7);
            AddSil(x0 - 12, 10); AddSil(x0 - 6, 25); AddSil(x0 + 1, 50); AddSil(x0 + 8, 75); AddSil(x0 + 13, 100);
            foreach (var d in Rails)
            {
                var t = AddSil(x0, d);
                t.move = (x0 - 15, x0 + 15, d == 40 ? 4.2f : d == 20 ? 1.8f : 2.4f, U.R() * 6.28f, d == 60);
                t.pivotY = 0.21f; t.cart = true;
            }
            foreach (var (dx, d, r) in new[] { (-10f, 110f, 0.3f), (-4f, 115f, 0.22f), (4f, 112f, 0.3f), (10f, 118f, 0.18f) })
            {
                float x = x0 + dx, z = Line - d;
                targets.Add(new Target { kind = "gong", root = new Vector3(x, Gy(x, z), z), pivotY = 1.66f, r = r, cy = -0.35f - r, hp = float.PositiveInfinity, d = d });
            }
            // 테이블
            void Row(int ti, List<string> kinds)
            {
                var tb = Tables[ti];
                for (int i = 0; i < kinds.Count; i++)
                {
                    float x = tb.x0 + 0.55f + i * ((tb.x1 - tb.x0 - 1.1f) / Mathf.Max(1, kinds.Count - 1));
                    PlaceItem(kinds[i], new Vector3(x, tb.y, tb.z));
                }
            }
            Row(0, Data.GunsOfClass("rifle")); Row(1, Data.GunsOfClass("shotgun")); Row(2, Data.GunsOfClass("pistol"));
            var r3 = new List<string>(); foreach (var s in Data.ScopeOrder) r3.Add("scope_" + s); r3.AddRange(Data.ThrowOrder); Row(3, r3);
            var att = new List<string>(Attachments.Catalog.Keys); int cols = Mathf.CeilToInt(att.Count / 2f);
            for (int i = 0; i < att.Count; i++)
            {
                float x = AttTable.x0 + 0.4f + (i % cols) * (AttTable.x1 - AttTable.x0 - 0.8f) / Mathf.Max(1, cols - 1), z = AttTable.z0 + 0.5f + (i / cols) * 0.9f;
                PlaceItem(att[i], new Vector3(x, AttTable.y, z));
            }
            // 운전 코스: 지프 두 대
            Vehicles.Reset();
            foreach (var dz in new[] { -2.6f, 2.6f }) Vehicles.SpawnAt(Course.spurX + 14, Course.z1 + dz, -Mathf.PI / 2, dz < 0 ? "izh" : "e2200");
            // 킬하우스
            float ky = Gy(-775, 752) + 0.06f;
            var rooms = new (Vector2 door, (float x, float z, char k)[] t)[]
            {
                (new Vector2(-766, 740), new[] { (-772.5f, 746f, 'e'), (-762f, 750.6f, 'e'), (-769f, 751f, 'c') }),
                (new Vector2(-767, 752), new[] { (-762.2f, 762.8f, 'e'), (-772.6f, 761.5f, 'e'), (-764.5f, 757.4f, 'c') }),
                (new Vector2(-775, 759.5f), new[] { (-788.2f, 762.6f, 'e'), (-783f, 754.2f, 'e'), (-787.6f, 756.2f, 'c') }),
                (new Vector2(-782, 752), new[] { (-788.2f, 742f, 'e'), (-777.6f, 742.6f, 'e') })
            };
            kh = new KillHouse { best = PlayerPrefs.GetFloat("lastzone_killhouse_best", 0) };
            foreach (var R in rooms) foreach (var (x, z, k) in R.t)
                {
                    var t = AddSil(x, 0, z, ky, Mathf.Atan2(R.door.x - x, R.door.y - z), k == 'c', true);
                    t.fall = 1; t.down = 0; kh.targets.Add(t);
                    if (k == 'c') kh.civ++; else kh.enemies++;
                }
            float gy0 = Gy(-726, 760);
            AddSil(-740, 0, 758.6f, gy0, Mathf.PI, zone: "grenade");
            AddSil(-724, 0, 766.5f, gy0, Mathf.PI, zone: "grenade");
            AddSil(Rings.x, 0, Rings.z, gy0, Mathf.PI, zone: "grenade");
            onBuild?.Invoke();
            Refill();
        }

        static void PlaceItem(string kind, Vector3 p)
        {
            var it = Match.AddLoot(kind, 1, p, new LootItem { train = true, rotY = 0, mag = Data.Gun(kind)?.mag ?? -1 });
            it.scope = null; it.rotY = 0;
            items.Add(it);
        }
        public static void Respawn(LootItem it)
        {
            if (!items.Remove(it)) return;
            respawns.Add((it.kind, it.pos, Match.time + 0.4f));
        }
        public static void Stop()
        {
            if (!active && targets.Count == 0) return;
            active = false;
            onClear?.Invoke();
            respawns.Clear(); targets.Clear(); items.Clear(); nums.Clear(); kh = null;
        }
        static void Refill()
        {
            var a = Match.player; if (a == null) return;
            foreach (var k in new List<string>(a.ammo.Keys)) a.ammo[k] = 999;
            foreach (var k in Data.ThrowOrder) if (a.throwables[k] < 3) a.throwables[k] = 3;
        }
        public static object OnShot() { stats.shots++; return new Stats.Shot(); }

        static string PartAt(float x, float y)
        {
            if (x * x + (y - 1.62f) * (y - 1.62f) <= 0.12f * 0.12f) return "head";
            bool In(float x0, float x1, float y0, float y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
            if (In(-0.27f, 0.27f, 0.86f, 1.47f))
            {
                const float r = 0.08f; float cx = U.Clamp(x, -0.27f + r, 0.27f - r), cy = Mathf.Min(y, 1.47f - r);
                if (y > 1.47f - r && (x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r) return null;
                return "body";
            }
            if (In(-0.06f, 0.06f, 1.44f, 1.52f) || In(-0.19f, 0.19f, 0.06f, 0.87f)) return "body";
            return null;
        }

        public static TargetHit HitTest(Vector3 o, Vector3 d, float maxT)
        {
            TargetHit best = null;
            foreach (var t in targets)
            {
                if (t.kind == "sil" && (t.down > 0 || (t.kh && t.fall > 0.5f))) continue;
                float dx = t.root.x - o.x, dz = t.root.z - o.z;
                if (dx * dx + dz * dz > (maxT + 3) * (maxT + 3)) continue;
                var inv = Quaternion.Inverse(t.PivotRot);
                var lo = inv * (o - t.PivotPos); var ld = inv * d;
                if (Mathf.Abs(ld.z) < 1e-5f) continue;
                float tt = -lo.z / ld.z;
                if (tt < 0 || tt > maxT || (best != null && tt >= best.t)) continue;
                float lx = lo.x + ld.x * tt, ly = lo.y + ld.y * tt;
                string part = t.kind == "sil" ? PartAt(lx, ly) : (lx * lx + (ly - t.cy) * (ly - t.cy) <= t.r * t.r ? "body" : null);
                if (part == null) continue;
                best = new TargetHit { t = tt, target = t, head = part == "head" };
            }
            return best;
        }

        public static void OnHit(TargetHit h, float dmg, Vector3 point, Vector3 dir, object shot)
        {
            var t = h.target;
            t.fd += dmg; t.fh |= h.head; t.fp = point;
            if (shot is Stats.Shot s && !s.hit) { s.hit = true; stats.hits++; }
            if (h.head) stats.heads++;
            Fx.Impact(point, -dir, t.kind == "gong" ? SurfMat.Metal : SurfMat.Wood);
            Sfx.Impact(point, t.kind == "gong" ? SurfMat.Metal : SurfMat.Wood);
            if (t.kind == "gong") t.swingV += U.Clamp(dmg / 40, 0.3f, 2.2f) * 3.2f;
        }

        static void Flush()
        {
            foreach (var t in targets)
            {
                if (t.fd <= 0) continue;
                float dmg = t.fd; bool head = t.fh;
                t.fd = 0; t.fh = false;
                bool kill = false;
                if (t.kind == "sil")
                {
                    t.hp -= dmg;
                    if (t.civ && kh != null && kh.active && !t.hitCiv) { t.hitCiv = true; kh.civHit++; GameUI.Toast("민간인 명중 · +5초"); }
                    if (t.hp <= 0) { kill = true; t.down = 2.2f; t.fall = 0; stats.downs++; }
                }
                stats.last = dmg; stats.dmg += dmg;
                GameUI.Hitmarker(head, kill);
                Sfx.Hit(head, kill, false);
                nums.Add(new Msg { pos = t.fp, dmg = dmg, head = head, kill = kill });
                if (nums.Count > 24) nums.RemoveAt(0);
            }
        }

        public static void Update(float dt)
        {
            if (!active) return;
            Flush();
            Refill();
            float time = Match.time;
            for (int i = 0; i < respawns.Count; i++)
                if (respawns[i].at <= time) { PlaceItem(respawns[i].kind, respawns[i].slot); respawns.RemoveAt(i--); }
            foreach (var t in targets)
            {
                if (t.kind == "sil")
                {
                    if (t.move.HasValue)
                    {
                        var M = t.move.Value; float mid = (M.a + M.b) / 2, half = (M.b - M.a) / 2, u;
                        if (M.stop) { float c = (time * M.sp / half / 2 + M.ph) % 2; u = c < 1 ? Mathf.Min(1, c * 1.4f) : Mathf.Max(0, 1 - (c - 1) * 1.4f); u = u * 2 - 1; }
                        else u = Mathf.Sin(time * M.sp / half + M.ph);
                        t.root.x = mid + u * half;
                    }
                    if (t.kh)
                    {
                        bool up = kh != null && kh.active && t.hp > 0;
                        t.fall = up ? Mathf.Max(0, t.fall - dt * 4) : Mathf.Min(1, t.fall + dt * 5);
                        continue;
                    }
                    if (t.down > 0) { t.down -= dt; t.fall = Mathf.Min(1, t.fall + dt * 5); if (t.down <= 0) t.hp = HP; }
                    else t.fall = Mathf.Max(0, t.fall - dt * 3);
                }
                else { t.swingV += (-28 * t.swing - 1.6f * t.swingV) * dt; t.swing += t.swingV * dt; }
            }
            for (int i = 0; i < nums.Count; i++) { nums[i].t += dt; if (nums[i].t > 1.1f) nums.RemoveAt(i--); }
            KillHouseUpdate(dt);
        }

        static void KillHouseUpdate(float dt)
        {
            var K = kh; var a = Match.player;
            if (K == null || a == null) return;
            var p = a.pos; bool inside = p.x > Kill.x0 && p.x < Kill.x1 && p.z > Kill.z0 - 0.2f && p.z < Kill.z1;
            if (inside && !K.inside && !K.active && p.x > Kill.xm)
            {
                K.active = true; K.t = 0; K.civHit = 0;
                foreach (var t in K.targets) { t.hp = HP; t.down = 0; t.hitCiv = false; }
                Sfx.Click("pin", a.pos);
                GameUI.Center("킬하우스", "적을 모두 쓰러뜨리고 출구로 · 민간인은 쏘지 마세요", "", 2.5f);
            }
            if (K.active)
            {
                K.t += dt;
                int left = K.targets.FindAll(t => !t.civ && t.hp > 0).Count;
                if (!inside)
                {
                    bool atExit = p.x < Kill.xm && p.z <= Kill.z0 + 0.5f;
                    K.active = false;
                    if (atExit)
                    {
                        float total = K.t + (left + K.civHit) * 5;
                        float best = K.best > 0 && K.best < total ? K.best : total; bool isBest = best == total;
                        K.best = best; PlayerPrefs.SetFloat("lastzone_killhouse_best", best);
                        GameUI.Center(isBest ? "최고 기록!" : "킬하우스 완료", $"<b>{total:0.00}초</b> · 걸린 시간 {K.t:0.00}초" + (left > 0 ? $" · 남은 적 {left} (+{left * 5}초)" : "") + (K.civHit > 0 ? $" · 민간인 {K.civHit} (+{K.civHit * 5}초)" : "") + $" · 최고 {best:0.00}초", "", 5);
                    }
                    else GameUI.Toast("킬하우스 중단 — 입구로 다시 들어가면 처음부터");
                }
            }
            K.inside = inside;
        }
        public static int KhLeft() => kh == null ? 0 : kh.targets.FindAll(t => !t.civ && t.hp > 0).Count;

        public static void OnBlast(Throwables.T o)
        {
            if (!active) return;
            var p = o.pos; string msg = null;
            if (p.x > Bunker.x0 && p.x < Bunker.x1 && p.z > Bunker.z0 && p.z < Bunker.z1 && p.y < Bunker.y1) msg = "창문 명중!";
            else if (p.x > Trench.x0 && p.x < Trench.x1 && p.z > Trench.z0 - 0.2f && p.z < Trench.z1 + 0.2f && p.y < Bunker.y0 + 0.9f) msg = "참호 명중!";
            else
            {
                float d = U.Hypot(p.x - Rings.x, p.z - Rings.z);
                if (d < Rings.r[2]) msg = (d < Rings.r[0] ? "정중앙! " : d < Rings.r[1] ? "명중 " : "근접 ") + d.ToString("0.0") + "m";
            }
            if (msg != null) nums.Add(new Msg { pos = p + Vector3.up * 1.5f, text = msg, t = -0.8f });
            if (o.kind == "frag")
                foreach (var t in targets)
                {
                    if (t.kind != "sil" || t.down > 0 || (t.kh && t.fall > 0.5f)) continue;
                    float d = Vector3.Distance(t.root, p);
                    if (d < 7) { t.fd += Mathf.Round(150 * (1 - d / 7) + 20); t.fp = t.root + Vector3.up * 1.2f; }
                }
        }
    }
}
