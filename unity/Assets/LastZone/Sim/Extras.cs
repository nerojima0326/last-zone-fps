using System;
using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 전적·업적 (웹판 Stats, PlayerPrefs 에 저장)
    public static class Stats
    {
        public static readonly string[][] ACH =
        {
            new[] { "first_win", "첫 승리", "최후의 생존자가 되기" }, new[] { "kills5", "사냥꾼", "한 판에 5명 처치" }, new[] { "kills10", "학살자", "한 판에 10명 처치" },
            new[] { "sniper", "장거리 저격", "200m 이상 거리에서 처치" }, new[] { "headhunter", "헤드헌터", "헤드샷 처치 누적 25회" }, new[] { "marksman", "명사수", "한 판 명중률 50% 이상 (20발 이상)" },
            new[] { "survivor", "생존 전문가", "3위 안에 5번 들기" }, new[] { "veteran", "베테랑", "10판 플레이" }, new[] { "roadkill", "뺑소니", "차량으로 적 처치" }, new[] { "airdrop", "보급 수령", "보급 상자 열기" }
        };
        [Serializable] public class D { public int matches, wins, top3, kills, heads, dmg, shots, hits, bestKills, bestRank; public float longest, time; public List<string> ach = new List<string>(); }
        public class Shot { public bool hit; }
        class M { public int shots, hits, heads; public float longest; }
        public static D data = new D();
        static M m; static List<string> fresh = new List<string>();
        const string KEY = "lastzone_stats";

        public static void Load() { try { var s = PlayerPrefs.GetString(KEY, ""); if (!string.IsNullOrEmpty(s)) data = JsonUtility.FromJson<D>(s) ?? new D(); } catch { data = new D(); } }
        static void Save() { try { PlayerPrefs.SetString(KEY, JsonUtility.ToJson(data)); PlayerPrefs.Save(); } catch { } }
        public static void ResetAll() { data = new D(); Save(); }
        public static void Begin() { m = new M(); fresh = new List<string>(); }
        public static void Unlock(string id)
        {
            if (data.ach.Contains(id)) return;
            var a = Array.Find(ACH, x => x[0] == id); if (a == null) return;
            data.ach.Add(id); fresh.Add(a[1]); Save();
            if (Match.state == "playing") GameUI.Feed("<color=#ffcf3a><b>업적 달성</b></color> " + a[1]);
        }
        public static object OnShot() { if (m != null && !Match.training) { m.shots++; return new Shot(); } return null; }
        public static void OnHit(object shot) { if (m != null && shot is Shot s && !s.hit) { m.hits++; s.hit = true; } }
        public static void OnKill(float dist, bool head, string weapon)
        {
            if (m == null || Match.training) return;
            if (head) { m.heads++; data.heads++; if (data.heads >= 25) Unlock("headhunter"); }
            if (weapon != "vehicle" && Data.Gun(weapon) != null) { m.longest = Mathf.Max(m.longest, dist); if (dist >= 200) Unlock("sniper"); }
            if (weapon == "vehicle") Unlock("roadkill");
            int k = Match.player.kills;
            if (k >= 5) Unlock("kills5");
            if (k >= 10) Unlock("kills10");
        }
        public class EndInfo { public float acc, longest; public int shots, heads; public bool best; public List<string> fresh; }
        public static EndInfo lastEnd;
        public static List<string> End(Match.Result r)
        {
            var d = data; var mm = m ?? new M();
            d.matches++; d.kills += r.kills; d.dmg += r.dmg; d.shots += mm.shots; d.hits += mm.hits; d.time += r.time;
            if (r.win) { d.wins++; Unlock("first_win"); }
            if (r.rank <= 3) { d.top3++; if (d.top3 >= 5) Unlock("survivor"); }
            if (d.matches >= 10) Unlock("veteran");
            float acc = mm.shots > 0 ? (float)mm.hits / mm.shots : 0;
            if (mm.shots >= 20 && acc >= 0.5f) Unlock("marksman");
            bool best = r.kills > d.bestKills && d.matches > 1;
            d.bestKills = Mathf.Max(d.bestKills, r.kills); d.longest = Mathf.Max(d.longest, mm.longest);
            if (d.bestRank == 0 || r.rank < d.bestRank) d.bestRank = r.rank;
            Save();
            lastEnd = new EndInfo { acc = acc, shots = mm.shots, heads = mm.heads, longest = mm.longest, best = best, fresh = new List<string>(fresh) };
            m = null;
            return lastEnd.fresh;
        }
    }

    // 보급 상자 · 피해 숫자 (웹판 extras.js)
    public static class Extras
    {
        public class Drop { public float x, z, y, vy, smoke, life; public bool landed; public LootItem item; public Box box; }
        public class DropPlane { public Vector3 dir, start, pos; public float t, speed = 75, len, drop; public Vector2 target; public bool dropped; }
        public static readonly List<Drop> drops = new List<Drop>();
        public static DropPlane plane;
        static float next = 150; static int count;
        public class Num { public Actor target; public Vector3 pos; public float dmg, t; public bool head, kill, armored; }
        public static readonly List<Num> nums = new List<Num>();

        static readonly (string gun, string scope)[] DropGuns = { ("aa12", null), ("kr98", "x8"), ("mk14", "x4"), ("sc17", "x4") };

        public static void Reset()
        {
            foreach (var d in drops) World.RemoveCollider(d.box);
            drops.Clear(); plane = null; next = 150; count = 0; nums.Clear();
            Sfx.SetLoop("airdrop", 0);
        }

        public static void DamageNumber(Actor t, Vector3 p, float dmg, bool head, bool kill, bool armored)
        {
            // 같은 대상에 짧은 시간 안에 맞으면 합친다
            foreach (var n in nums) if (n.target == t && n.t < 0.35f && !n.kill) { n.dmg += dmg; n.head |= head; n.kill |= kill; n.armored |= armored; n.t = 0; n.pos = p; return; }
            nums.Add(new Num { target = t, pos = p, dmg = dmg, head = head, kill = kill, armored = armored });
        }

        static Vector2? PickSpot()
        {
            var Z = Match.zone; var c = Z != null ? (Z.next ?? Z.cur) : null;
            for (int i = 0; i < 40; i++)
            {
                float r = c != null ? Mathf.Min(c.r * 0.7f, 260) : 200, a = U.R() * 6.28f, d = Mathf.Sqrt(U.R()) * r;
                float x = (c != null ? c.x : 0) + Mathf.Cos(a) * d, z = (c != null ? c.z : 0) + Mathf.Sin(a) * d;
                if (World.HeightAt(x, z) - World.WaterAt(x, z) < 1.5f) continue;
                if (World.Covered(x, World.HeightAt(x, z) + 30, z)) continue;
                if (World.Raycast(new Vector3(x, World.HeightAt(x, z) + 60, z), Vector3.down, 59.5f, true)) continue;
                return new Vector2(x, z);
            }
            return null;
        }
        static bool Call()
        {
            var s = PickSpot(); if (s == null) return false;
            float ang = U.R() * 6.28f, span = World.HALF * 1.5f;
            var dir = new Vector3(Mathf.Cos(ang), 0, Mathf.Sin(ang));
            float alt = Mathf.Max(230, World.HeightAt(s.Value.x, s.Value.y) + 190);
            plane = new DropPlane { dir = dir, start = new Vector3(s.Value.x, alt, s.Value.y) - dir * span, len = span * 2, drop = span, target = s.Value };
            count++;
            GameUI.Center("보급 상자 투하", "수송기가 안전 구역으로 접근 중입니다 · <b>M</b> 지도에 표시", "zone", 4);
            return true;
        }
        static List<LootItem> Contents()
        {
            var (gun, scope) = DropGuns[U.RandInt(0, DropGuns.Length - 1)]; var def = Data.Gun(gun); var x = Data.Extra[gun];
            return new List<LootItem>
            {
                new LootItem { kind = gun, mag = def.mag, scope = scope }, new LootItem { kind = "ammo_" + x.ammo, amount = def.cls == GunClass.Shotgun ? 30 : 90 },
                new LootItem { kind = "vest", level = 3 }, new LootItem { kind = "helmet", level = 3 }, new LootItem { kind = "bag", level = 3 },
                new LootItem { kind = "medkit" }, new LootItem { kind = "medkit" }, new LootItem { kind = "frag", amount = 2 }
            };
        }

        public static void Update(float dt)
        {
            for (int i = 0; i < nums.Count; i++) { nums[i].t += dt; if (nums[i].t > 1.1f) nums.RemoveAt(i--); }
            if (Match.training || (Match.state != "playing" && !Match.spectating)) return;
            if (plane == null && count < 4 && Match.time >= next && Match.zone != null && Match.zone.state != "done") next = Match.time + (Call() ? 160 : 10);
            var P = plane;
            if (P != null)
            {
                P.t += dt;
                float s = P.speed * P.t;
                P.pos = P.start + P.dir * s;
                Sfx.SetLoop("airdrop", 0.55f, P.pos);
                if (!P.dropped && s >= P.drop)
                {
                    P.dropped = true;
                    drops.Add(new Drop { x = P.target.x, z = P.target.y, y = P.pos.y - 6, vy = -22 });
                }
                if (s > P.len) { plane = null; Sfx.SetLoop("airdrop", 0); }
            }
            var cam = Sfx.listener;
            foreach (var d in drops)
            {
                d.smoke -= dt;
                if (!d.landed)
                {
                    d.vy = U.Damp(d.vy, -7.5f, 1.6f, dt);
                    d.y += d.vy * dt;
                    float g = World.Ground(d.x, d.z, d.y + 0.5f, 0.6f, 0.6f);
                    if (d.y <= g)
                    {
                        d.landed = true; d.y = g;
                        d.item = Match.AddLoot("crate", 1, new Vector3(d.x, g + 0.3f, d.z), new LootItem { items = Contents(), owner = "보급", airdrop = true });
                        d.box = World.AddCollider(d.x - 0.75f, g, d.z - 0.55f, d.x + 0.75f, g + 1.0f, d.z + 0.55f, SurfMat.Wood, true);
                        Sfx.Click("land", new Vector3(d.x, g, d.z));
                        if (U.Hypot(cam.x - d.x, cam.z - d.z) < 400) GameUI.Feed("보급 상자가 착지했습니다");
                    }
                }
                else d.life += dt;
                if (d.smoke <= 0 && d.life < 90 && U.Hypot(cam.x - d.x, cam.z - d.z) < 600)
                {
                    d.smoke = 0.12f;
                    Fx.Smoke(new Vector3(d.x + (U.R() - 0.5f) * 0.4f, d.y + 1.1f, d.z + (U.R() - 0.5f) * 0.4f), new Vector3(0.5f + (U.R() - 0.5f) * 0.5f, 2.2f + U.R(), (U.R() - 0.5f) * 0.5f), 7 + U.R() * 3, 0.5f, 5 + U.R() * 2, new Color(0.85f, 0.12f, 0.1f, 0.5f));
                }
            }
        }
    }
}
