using System;
using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    public class Team { public int id; public List<Actor> members = new List<Actor>(); public bool eliminated; public int rank, kills; }

    public class Zone
    {
        public class Circle { public float x, z, r; public Circle Copy() => new Circle { x = x, z = z, r = r }; }
        public string state = "pre"; public int phase = -1; public float timer = 40, dps = 0.5f, tick;
        public Circle cur, next, from;
    }

    public class PlaneState { public Vector3 start, dir, perp, pos; public float speed, t, len, alt, K; public bool done, visible = true; }

    public class MatchOptions
    {
        public string mode = "solo", diff = "normal", loadout = "all", name = "Player", tod = "day";
        public int size = 1, players = 24;
    }

    // 매치 진행 (웹판 game.js): 팀 구성 · 수송기 · 자기장 · 전리품 · 피해/처치 · 승리 판정
    public static class Match
    {
        static readonly string[] BotNames = { "검은늑대", "SilentFox", "김병장", "NightOwl", "불곰", "Raven", "하늘매", "Ghost", "번개", "Viper", "민트초코", "Blaze", "고양이장군", "Frost",
            "돌격대장", "Hunter", "산적", "Shadow", "쿨가이", "Wolfpack", "백호", "Phantom", "치킨러버", "Reaper", "돌멩이", "Falcon", "해적왕", "Titan", "감자", "Nova",
            "붉은용", "Echo", "초코송이", "Sniper", "파란눈", "Storm", "곰돌이", "Bandit", "밤하늘", "Cobra", "은하수", "Rogue", "태풍", "Jaguar", "마라탕", "Atlas",
            "무적", "Spectre", "호랑이", "Onyx", "라면왕", "Hawk", "독수리", "Rex", "참치", "Zero", "솜사탕", "Bolt", "흑표범", "Ace", "도깨비", "Kilo", "용가리", "Dusk" };
        public static readonly Color[] TeamColors = { new Color(1f, 0.82f, 0.25f), new Color(0.31f, 0.76f, 0.97f), new Color(0.49f, 0.88f, 0.51f), new Color(1f, 0.49f, 0.71f) };
        struct Phase { public float r, wait, shrink, dps; public Phase(float r, float w, float s, float d) { this.r = r; wait = w; shrink = s; dps = d; } }
        static readonly Phase[] Phases = { new Phase(330, 100, 70, 1), new Phase(190, 70, 55, 2), new Phase(105, 55, 45, 4), new Phase(55, 45, 35, 7), new Phase(25, 30, 25, 10), new Phase(0, 20, 40, 15) };

        public static string state = "menu", diff = "normal";
        public static List<Actor> actors = new List<Actor>();
        public static List<Team> teams = new List<Team>();
        public static Actor player;
        public static List<LootItem> loot = new List<LootItem>();
        public static List<Vector3> lootSpots = new List<Vector3>();
        public static float time, visK = 1, mapK = World.HALF / 500f;
        public static int teamSize = 1;
        public static bool ended, training, spectating;
        public static PlaneState plane;
        public static Zone zone;
        public static MatchOptions opts;
        public static (bool win, float at)? pendingResult;
        public static Action<LootItem> onLootAdded, onLootRemoved;
        public static Action<Actor> onActorAdded;
        public static Action<bool> onFinish;
        static Dictionary<long, List<LootItem>> lootCells = new Dictionary<long, List<LootItem>>();

        static string PickGun(string cls)
        {
            var ids = Data.GunsOfClass(cls);
            float total = 0; foreach (var k in ids) total += 1f / Data.Extra[k].tier;
            float r = U.R() * total;
            foreach (var k in ids) { r -= 1f / Data.Extra[k].tier; if (r <= 0) return k; }
            return ids[0];
        }

        public static void Start(MatchOptions o)
        {
            Cleanup();
            opts = o;
            if (o.mode == "training") { StartTraining(o); return; }
            diff = o.diff; teamSize = o.size; time = 0; ended = false;
            var names = new List<string>(BotNames); U.Shuffle(names);
            int ni = 0, id = 0, nTeams = Mathf.CeilToInt((float)o.players / o.size);
            for (int t = 0; t < nTeams; t++)
            {
                var team = new Team { id = t };
                teams.Add(team);
                for (int m = 0; m < o.size; m++)
                {
                    if (t * o.size + m >= o.players) break;
                    bool isPlayer = t == 0 && m == 0;
                    string nm = isPlayer ? (string.IsNullOrEmpty(o.name) ? "Player" : o.name) : names[ni++ % names.Count] + (ni > names.Count ? ni.ToString() : "");
                    var a = new Actor { id = id++, name = nm, team = t, idx = m, isPlayer = isPlayer };
                    if (!isPlayer) a.brain = new Bot(a);
                    GiveLoadout(a, o.loadout, isPlayer);
                    team.members.Add(a);
                    actors.Add(a);
                    onActorAdded?.Invoke(a);
                }
            }
            player = actors[0];
            PlayerCtl.Init(player);
            SetupPlane();
            SetupZone();
            SpawnLoot();
            Vehicles.Spawn(Mathf.RoundToInt(14 * World.HALF / 500));
            Stats.Begin();
            state = "playing";
            GameUI.Center("수송기 탑승 완료", "원하는 지역 위에서 <b>F</b> 키로 뛰어내리세요", "", 5);
        }

        static void StartTraining(MatchOptions o)
        {
            training = true; diff = o.diff; teamSize = 1; time = 0; ended = false;
            var team = new Team { id = 0 }; teams.Add(team);
            var a = new Actor { id = 0, name = string.IsNullOrEmpty(o.name) ? "Player" : o.name, team = 0, isPlayer = true };
            GiveLoadout(a, "all", true);
            team.members.Add(a); actors.Add(a); onActorAdded?.Invoke(a);
            player = a;
            PlayerCtl.Init(a);
            var sp = Training.Spawn;
            a.state = "ground"; a.onGround = true; a.vel = Vector3.zero;
            a.pos = new Vector3(sp.x, World.Ground(sp.x, sp.z, sp.y + 5, 0.3f, 0.6f), sp.z);
            a.yaw = 0; a.pitch = 0;
            PlayerCtl.OnLand();
            zone = null;
            state = "playing";
            Training.Begin();
            GameUI.Center("훈련 기지", "테이블의 총·조준경은 <b>F</b> 로 바꿔 들 수 있어요 · 탄약 무한", "", 6);
        }

        public static void Cleanup()
        {
            Training.Stop();
            training = false;
            foreach (var it in loot) onLootRemoved?.Invoke(it);
            actors.Clear(); teams.Clear(); loot.Clear(); lootCells.Clear();
            plane = null; zone = null;
            Bullets.Reset(); Throwables.Reset(); Vehicles.Reset(); Extras.Reset();
            spectating = false; pendingResult = null; player = null;
            state = "menu";
        }

        static void GiveLoadout(Actor a, string lo, bool isPlayer)
        {
            var AM = new Dictionary<string, int> { { "556", 90 }, { "762", 60 }, { "12g", 18 }, { "9mm", 45 }, { "45", 32 } };
            int Am(string id) => AM[Data.Extra[id].ammo];
            var D = Data.DefaultGun;
            if (isPlayer)
            {
                if (lo == "all") { a.Give(D["rifle"], Am(D["rifle"])); a.Give(D["shotgun"], Am(D["shotgun"])); a.Give(D["pistol"], Am(D["pistol"])); }
                else if (lo != "none" && D.ContainsKey(lo)) a.Give(D[lo], Am(D[lo]));
                a.throwables["frag"] = 1; a.throwables["smoke"] = 1; a.throwables["molotov"] = 1; a.throwables["flash"] = 1;
                a.bandage = 2;
            }
            else
            {
                if (lo != "none")
                {
                    float r = U.R(); string c = r < 0.45f ? "rifle" : r < 0.72f ? "shotgun" : "pistol";
                    string k = PickGun(c);
                    a.Give(k, Mathf.RoundToInt(Am(k) * U.Rand(0.4f, 0.8f)));
                    if (lo == "all" && U.R() < 0.6f)
                    {
                        var others = new List<string>(); foreach (var s in Data.Slots) if (s != c) others.Add(s);
                        string k2 = PickGun(U.Pick(others)); a.Give(k2, Mathf.RoundToInt(Am(k2) * 0.5f));
                    }
                }
                if (U.R() < 0.5f) a.throwables["frag"] = 1;
                if (U.R() < 0.3f) a.throwables["smoke"] = 1;
                if (U.R() < 0.2f) a.throwables["molotov"] = 1;
                a.bandage = U.RandInt(0, 2);
            }
            a.cur = a.BestGun();
        }

        /* ------------ 수송기 ------------ */
        static void SetupPlane()
        {
            float ang = U.R() * Mathf.PI * 2;
            var dir = new Vector3(Mathf.Cos(ang), 0, Mathf.Sin(ang));
            var perp = new Vector3(-dir.z, 0, dir.x);
            float K = World.HALF / 500, off = U.Rand(-170, 170) * K;
            var start = dir * (-760 * K) + perp * off;
            const float alt = 380;
            plane = new PlaneState { start = start, dir = dir, perp = perp, speed = 82 * Mathf.Sqrt(K), len = 1520 * K, pos = new Vector3(start.x, alt, start.z), alt = alt, K = K };
            foreach (var team in teams)
            {
                if (team.id == player.team) { foreach (var m in team.members) if (m.brain != null) m.brain.jumpAt = 1e9f; continue; }
                Vector3? target = null; float along = 0;
                var towns = MapData.Current != null ? MapData.Current.towns.FindAll(t => t.type != "range") : new List<MapData.Town>();
                for (int i = 0; i < 30 && target == null; i++)
                {
                    float x, z;
                    if (U.R() < 0.7f && towns.Count > 0) { var t = U.Pick(towns); float a2 = U.R() * 6.28f, rr = U.R() * t.r; x = -t.pos.x + Mathf.Cos(a2) * rr; z = t.pos.z + Mathf.Sin(a2) * rr; }
                    else { x = U.Rand(-380, 380) * K; z = U.Rand(-380, 380) * K; }
                    if (World.HeightAt(x, z) - World.WaterAt(x, z) < 2) continue;
                    var rel = new Vector3(x, 0, z) - start;
                    float al = Vector3.Dot(rel, dir), side = Mathf.Abs(Vector3.Dot(rel, perp));
                    if (side > 330 * K || al < 300 * K || al > 1250 * K) continue;
                    target = new Vector3(x, 0, z); along = al;
                }
                if (target == null) { target = Vector3.zero; along = 760 * K; }
                float jt = U.Clamp((along - 60) / plane.speed + U.Rand(-1.5f, 1.5f), 3.8f, (1250 * K - 60) / plane.speed);
                foreach (var m in team.members)
                {
                    m.brain.jumpAt = jt + U.Rand(0, 0.8f);
                    m.brain.dropTarget = new Vector3(target.Value.x + U.Rand(-14, 14), 0, target.Value.z + U.Rand(-14, 14));
                }
            }
        }
        public static bool PlaneCanJump() { var p = plane; return p != null && !p.done && Mathf.Abs(p.pos.x) < 470 * p.K && Mathf.Abs(p.pos.z) < 470 * p.K; }
        static void UpdatePlane(float dt)
        {
            var p = plane; if (p == null) return;
            p.t += dt;
            p.pos = p.start + p.dir * (p.speed * p.t); p.pos.y = p.alt;
            float traveled = p.speed * p.t;
            if (!p.done)
            {
                bool canJump = PlaneCanJump();
                foreach (var a in actors)
                {
                    if (a.state != "plane" || !a.alive) continue;
                    if (a.brain != null && canJump && p.t >= a.brain.jumpAt) Jump(a, false);
                }
                if (traveled > 1180 * p.K && !canJump)
                {
                    p.done = true;
                    foreach (var a in actors) if (a.state == "plane") Jump(a, true);
                }
            }
            if (traveled > p.len + 200) p.visible = false;
        }
        public static void Jump(Actor a, bool forced)
        {
            if (a.state != "plane") return;
            var p = plane;
            a.state = "freefall";
            a.pos = p.pos + new Vector3(U.Rand(-2, 2), -4, U.Rand(-2, 2));
            a.vel = p.dir * (p.speed * 0.35f); a.vel.y = -5;
            a.yaw = Mathf.Atan2(-p.dir.x, -p.dir.z);
            if (a.isPlayer)
            {
                PlayerCtl.orbitYaw = a.yaw; PlayerCtl.orbitPitch = -0.25f; PlayerCtl.dropT = 0;
                if (forced) GameUI.Center("자동 강하", "수송기가 맵을 벗어났습니다", "", 3);
                foreach (var m in teams[a.team].members) if (m.brain != null && m.state == "plane") m.brain.jumpAt = p.t + 0.4f + m.idx * 0.35f;
            }
        }
        public static void OpenChute(Actor a)
        {
            if (a.state != "freefall") return;
            a.state = "chute";
            if (a.isPlayer) Sfx.Click("chute", a.pos);
        }
        public static void Land(Actor a)
        {
            a.state = "ground";
            a.vel = Vector3.zero;
            a.pos.y = Mathf.Max(World.Ground(a.pos.x, a.pos.z, a.pos.y + 0.5f, 0.3f, 0.6f), a.pos.y);
            a.onGround = true;
        }

        /* ------------ 자기장 ------------ */
        static void SetupZone()
        {
            mapK = World.HALF / 500;
            zone = new Zone { cur = new Zone.Circle { x = 0, z = 0, r = 720 * mapK } };
        }
        static Zone.Circle PickZone(Zone.Circle cur, float r)
        {
            for (int i = 0; i < 60; i++)
            {
                float ang = U.R() * 6.28f, d = Mathf.Sqrt(U.R()) * Mathf.Max(0, cur.r - r) * 0.92f;
                float x = cur.x + Mathf.Cos(ang) * d, z = cur.z + Mathf.Sin(ang) * d;
                if (U.Hypot(x, z) + r * 0.3f > 360 * mapK) continue;
                if (World.HeightAt(x, z) - World.WaterAt(x, z) < 2) continue;
                return new Zone.Circle { x = x, z = z, r = r };
            }
            return new Zone.Circle { x = cur.x, z = cur.z, r = r };
        }
        static void UpdateZone(float dt)
        {
            var Z = zone;
            Z.timer -= dt;
            if (Z.state == "pre") { if (Z.timer <= 0) BeginPhase(0); }
            else if (Z.state == "wait")
            {
                if (Z.timer <= 0)
                {
                    Z.state = "shrink"; Z.timer = Phases[Z.phase].shrink; Z.from = Z.cur.Copy();
                    GameUI.Center("자기장이 줄어들고 있습니다!", "안전 구역으로 이동하세요", "zone", 4);
                }
            }
            else if (Z.state == "shrink")
            {
                var P = Phases[Z.phase];
                float k = U.Clamp(1 - Z.timer / P.shrink, 0, 1);
                Z.cur.x = U.Lerp(Z.from.x, Z.next.x, k); Z.cur.z = U.Lerp(Z.from.z, Z.next.z, k); Z.cur.r = U.Lerp(Z.from.r, Z.next.r, k);
                if (Z.timer <= 0)
                {
                    Z.cur = Z.next.Copy();
                    if (Z.phase + 1 < Phases.Length) BeginPhase(Z.phase + 1);
                    else { Z.state = "done"; Z.next = null; }
                }
            }
            Z.dps = Z.phase < 0 ? 0.5f : Phases[Z.phase].dps;
            Z.tick -= dt;
            if (Z.tick <= 0)
            {
                Z.tick = 0.5f;
                foreach (var a in actors.ToArray())
                {
                    if (!a.alive || a.state == "plane") continue;
                    if (U.Hypot(a.pos.x - Z.cur.x, a.pos.z - Z.cur.z) > Z.cur.r) Damage(a, Z.dps * 0.5f, null, "zone", false, a.pos, Vector3.zero);
                }
            }
        }
        static void BeginPhase(int i)
        {
            var Z = zone;
            Z.phase = i; Z.state = "wait"; Z.timer = Phases[i].wait;
            Z.next = PickZone(Z.cur, Phases[i].r * mapK);
            GameUI.Center("안전 구역이 표시되었습니다", U.FmtTime(Z.timer) + " 후 자기장이 줄어듭니다", "zone", 4);
        }
        public static bool InZone(Vector3 p) { var Z = zone; if (Z == null) return true; return U.Hypot(p.x - Z.cur.x, p.z - Z.cur.z) <= Z.cur.r; }

        /* ------------ 전리품 ------------ */
        static string RollKind()
        {
            float total = 0; foreach (var e in Data.LootTable) total += e.Value;
            foreach (var k in Attachments.Catalog.Keys) total += 1.8f;
            float r = U.R() * total;
            foreach (var e in Data.LootTable) { r -= e.Value; if (r <= 0) return e.Key; }
            foreach (var k in Attachments.Catalog.Keys) { r -= 1.8f; if (r <= 0) return k; }
            return "bandage";
        }
        static void SpawnLoot()
        {
            void Put(Vector3 s, string k, float spread)
            {
                AddLoot(k, Data.LootAmount.TryGetValue(k, out var n) ? n : 1, new Vector3(s.x + U.Rand(-spread, spread), s.y, s.z + U.Rand(-spread, spread)), null);
            }
            foreach (var s in lootSpots)
            {
                int n = U.R() < 0.4f ? 2 : 1;
                for (int i = 0; i < n; i++)
                {
                    string k = RollKind();
                    Put(s, k, 0.35f);
                    var def = Data.Gun(k);
                    if (def != null && U.R() < 0.85f) Put(s, "ammo_" + Data.Extra[k].ammo, 0.6f);
                }
            }
        }
        public static LootItem AddLoot(string kind, int amount, Vector3 pos, LootItem extra)
        {
            var it = extra ?? new LootItem();
            it.kind = kind; it.amount = extra != null && extra.amount > 0 ? extra.amount : amount; it.pos = pos; it.taken = false; it.rotY = U.R() * 6.28f;
            var def = Data.Gun(kind);
            if (def != null && extra == null)
            {
                it.mag = def.mag;
                var x = Data.Extra[kind];
                var sc = new List<string>(); foreach (var t in x.scopes) if (t != x.baseSight) sc.Add(t);
                float ch = kind == "kr98" ? 0.55f : kind == "mk14" ? 0.4f : def.cls == GunClass.Rifle ? 0.14f : 0.08f;
                if (sc.Count > 0 && U.R() < ch)
                {
                    if (kind == "kr98" || kind == "mk14") { var hi = sc.FindAll(t => Data.Scopes[t].zoom >= 2); it.scope = hi.Count > 0 ? U.Pick(hi) : U.Pick(sc); }
                    else it.scope = U.Pick(sc);
                }
            }
            if ((kind == "vest" || kind == "helmet" || kind == "bag") && it.level == 0) { float r = U.R(); it.level = r < 0.55f ? 1 : r < 0.88f ? 2 : 3; }
            loot.Add(it);
            long ck = LootKey(Mathf.FloorToInt(pos.x / 20), Mathf.FloorToInt(pos.z / 20));
            if (!lootCells.TryGetValue(ck, out var cell)) lootCells[ck] = cell = new List<LootItem>();
            cell.Add(it);
            onLootAdded?.Invoke(it);
            return it;
        }
        public static string LootLabel(LootItem it)
        {
            if (it.kind == "crate") return "<b>" + (it.owner ?? "보급") + "</b>의 상자 열기 <size=80%>(" + it.items.Count + "개)</size>";
            string s = "<b>" + Data.LootName(it.kind) + "</b>";
            if (it.level > 0) s += " Lv." + it.level;
            if (it.scope != null) s += " + " + Data.Scopes[it.scope].name;
            if (it.kind.StartsWith("ammo_") || it.kind == "bandage" || (Data.ThrowNames.ContainsKey(it.kind) && it.amount > 1)) s += " x" + it.amount;
            return s + " 줍기";
        }
        static long LootKey(int ix, int iz) => (long)(ix + 500) * 1000 + (iz + 500);
        public static void LootAround(float x, float z, float r, Action<LootItem> fn)
        {
            int x0 = Mathf.FloorToInt((x - r) / 20), x1 = Mathf.FloorToInt((x + r) / 20), z0 = Mathf.FloorToInt((z - r) / 20), z1 = Mathf.FloorToInt((z + r) / 20);
            for (int iz = z0; iz <= z1; iz++) for (int ix = x0; ix <= x1; ix++)
                {
                    if (!lootCells.TryGetValue(LootKey(ix, iz), out var cell)) continue;
                    for (int i = 0; i < cell.Count; i++)
                    {
                        var it = cell[i];
                        if (it.taken) { cell[i] = cell[cell.Count - 1]; cell.RemoveAt(cell.Count - 1); i--; continue; }
                        fn(it);
                    }
                }
        }
        public static LootItem LootNear(Vector3 eye, Vector3 fwd)
        {
            LootItem best = null; float bs = -1;
            LootAround(eye.x, eye.z, 3, it =>
            {
                float dx = it.pos.x - eye.x, dy = it.pos.y + 0.15f - eye.y, dz = it.pos.z - eye.z;
                float d = Mathf.Sqrt(dx * dx + dy * dy + dz * dz);
                if (d > 2.7f) return;
                float dot = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d;
                if (dot < 0.55f && d > 1.4f) return;
                float s = dot - d * 0.12f;
                if (s > bs) { bs = s; best = it; }
            });
            return best;
        }
        public static string Pickup(Actor a, LootItem it)
        {
            if (it.taken) return null;
            string res = a.Pickup(it);
            if (it.taken) onLootRemoved?.Invoke(it);
            if (training) { a.drop = null; if (it.taken && it.train) Training.Respawn(it); }
            if (a.drop != null)
            {
                var d = a.drop; a.drop = null;
                float x = it.pos.x + U.Rand(-0.4f, 0.4f), z = it.pos.z + U.Rand(-0.4f, 0.4f);
                float y = World.Ground(x, z, it.pos.y + 0.5f, 0.2f, 0.6f);
                AddLoot(d.kind, 1, new Vector3(x, y, z), d);
            }
            return res;
        }

        /* ------------ 피해 / 처치 ------------ */
        public static void Damage(Actor t, float amount, Actor attacker, string weapon, bool head, Vector3 point, Vector3 dir, object shot = null)
        {
            if (!t.alive || (state != "playing" && !spectating)) return;
            if (training && t == player) return;
            if (t.state != "ground" && weapon != "zone") return;
            if (attacker != null && attacker != t && attacker.team == t.team) return;
            float dmg = amount; bool armored = false;
            if (weapon != "zone" && weapon != "fall" && weapon != "bleed")
            {
                if (head && t.helmet > 0) { dmg *= Data.ArmorHelmet[t.helmet]; armored = true; }
                if (!head && t.vest > 0 && weapon != "molotov") { dmg *= Data.ArmorVest[t.vest]; armored = true; }
            }
            t.lastHurtT = time;
            if (attacker != null && attacker != t) t.lastAttacker = attacker;
            bool fromPlayer = attacker == player && t != player;
            if (fromPlayer && !t.knocked) Stats.OnHit(shot);
            string result = "hit";
            if (t.knocked)
            {
                t.bleed -= dmg * 0.9f;
                if (t.bleed <= 0) { Kill(t, attacker, weapon, head); result = "kill"; }
            }
            else
            {
                float before = t.hp;
                t.hp -= dmg;
                if (attacker != null && attacker != t) attacker.dmgDealt += Mathf.Min(dmg, before);
                if (t.hp <= 0)
                {
                    t.hp = 0;
                    var mates = teams[t.team].members.FindAll(m => m != t && m.alive && !m.knocked);
                    if (teamSize > 1 && mates.Count > 0) { Knock(t, attacker, weapon, head); result = "knock"; }
                    else { Kill(t, attacker, weapon, head); result = "kill"; }
                }
            }
            if (fromPlayer)
            {
                GameUI.Hitmarker(head, result != "hit"); Sfx.Hit(head, result != "hit", armored);
                Extras.DamageNumber(t, point != t.pos ? point : t.Chest(), dmg, head, result != "hit", armored);
            }
            if (t == player)
            {
                if (weapon != "zone") { GameUI.Hurt(dmg, attacker != null ? attacker.pos : (Vector3?)null); Sfx.Hurt(); Fx.Shake(Mathf.Min(0.4f, dmg / 60)); }
                else GameUI.Hurt(dmg * 0.3f, null);
                if (weapon != "zone") PlayerCtl.CancelHeal();
            }
            if (t.model != null && weapon != "zone") t.model.flinch = 1;
            if (t.brain != null && attacker != null) t.brain.OnHurt(attacker);
        }
        static void Knock(Actor t, Actor attacker, string weapon, bool head)
        {
            t.knocked = true; t.bleed = 100; t.knockedBy = attacker; t.crouch = false; t.prone = false;
            t.vel = new Vector3(0, t.vel.y, 0);
            if (t.brain != null) { t.brain.ClearGoal(); t.brain.healing = null; t.brain.reviving = null; }
            GameUI.Killfeed(attacker, t, weapon, head, true);
            if (attacker == player) GameUI.KillMsg("적을 기절시켰습니다", t.name, true, 0);
            if (t == player) { GameUI.Center("기절했습니다!", "팀원이 소생시켜 줄 때까지 버티세요", "", 3); PlayerCtl.OnKnock(); }
            CheckTeam(t.team);
        }
        public static void Kill(Actor t, Actor attacker, string weapon, bool head)
        {
            if (!t.alive) return;
            if ((attacker == null || attacker == t) && t.knockedBy != null) attacker = t.knockedBy;
            t.brain?.ClearGoal();
            t.alive = false; t.knocked = false; t.prone = false; t.hp = 0; t.deathTime = time;
            float kdist = attacker != null && attacker != t ? Vector3.Distance(attacker.pos, t.pos) : 0;
            t.vel = Vector3.zero;
            if (attacker != null && attacker != t && attacker.team != t.team) { attacker.kills++; teams[attacker.team].kills++; }
            GameUI.Killfeed(attacker, t, weapon, head, false);
            if (t.inVehicle) Vehicles.ForceExit(t);
            var items = t.DropAll();
            if (items.Count > 0)
            {
                float y = World.Ground(t.pos.x, t.pos.z, t.pos.y + 0.5f, 0.2f, 0.6f);
                AddLoot("crate", 1, new Vector3(t.pos.x + 0.6f, y, t.pos.z), new LootItem { items = items, owner = t.name });
            }
            if (attacker == player && t != player)
            {
                GameUI.KillMsg("적을 처치했습니다", t.name + (head ? " · 헤드샷" : "") + (kdist >= 50 ? " · " + Mathf.RoundToInt(kdist) + "m" : ""), false, player.kills);
                Stats.OnKill(kdist, head, weapon);
            }
            if (t == player)
            {
                PlayerCtl.OnDeath(attacker != null && attacker != t && attacker.alive ? attacker : null, weapon, head, kdist);
                GameUI.Center("사망했습니다", attacker != null && attacker != t ? attacker.name + "에게 처치됨 · " + Data.WeaponLabel(weapon) + (kdist >= 1 ? " · " + Mathf.RoundToInt(kdist) + "m" : "") : Data.WeaponLabel(weapon), "", 3);
            }
            CheckTeam(t.team);
        }
        public static void Revive(Actor t, Actor by)
        {
            if (!t.alive || !t.knocked) return;
            t.knocked = false; t.hp = 25; t.bleed = 100; t.knockedBy = null;
            GameUI.Feed(by.name + " 님이 " + t.name + " 님을 소생시켰습니다");
            if (t == player) GameUI.Center("소생되었습니다", "", "", 2);
        }
        static void CheckTeam(int teamId)
        {
            var team = teams[teamId];
            if (team.eliminated) return;
            if (!team.members.Exists(m => m.alive && !m.knocked))
            {
                team.eliminated = true;
                foreach (var m in team.members.ToArray()) if (m.alive) Kill(m, m.knockedBy, "bleed", false);
                team.rank = teams.FindAll(t => !t.eliminated).Count + 1;
                if (teamId == player.team && !ended) { ended = true; pendingResult = (false, time + (PlayerCtl.killcam != null ? 6 : 3)); }
            }
            var alive = teams.FindAll(t => !t.eliminated);
            if (alive.Count <= 1 && !ended)
            {
                ended = true;
                if (alive.Count == 1) alive[0].rank = 1;
                bool win = alive.Count == 1 && alive[0].id == player.team;
                if (win) GameUI.Center("최후의 생존자!", "모든 적을 물리쳤습니다", "win", 4);
                pendingResult = (win, time + (win ? 2.5f : 3));
            }
        }
        public class Result { public bool win, canSpectate; public int rank, teams, kills, dmg, teamKills; public float time; public List<string> unlocked; }
        public static Result lastResult;
        static void Finish(bool win)
        {
            if (state != "playing") return;
            state = "ended"; pendingResult = null;
            var team = teams[player.team];
            int rank = win ? 1 : (team.rank > 0 ? team.rank : teams.FindAll(t => !t.eliminated).Count + 1);
            lastResult = new Result { win = win, rank = rank, teams = teams.Count, kills = player.kills, dmg = Mathf.RoundToInt(player.dmgDealt), time = player.alive ? time : player.deathTime, teamKills = team.kills };
            lastResult.unlocked = Stats.End(lastResult);
            lastResult.canSpectate = !win && TeamsAlive() > 1;
            onFinish?.Invoke(win);
        }
        public static void StartSpectate() { if (state != "ended" || TeamsAlive() <= 1) return; spectating = true; }
        public static void StopSpectate() { spectating = false; }
        public static void OnShot(Actor shooter, GunDef def, Weapon inst)
        {
            float range = def.id == "kr98" || def.id == "mk14" ? 200 : def.cls == GunClass.Rifle ? 130 : def.cls == GunClass.Shotgun ? 100 : 75;
            bool suppressed = inst?.Att("muzzle") == "suppressor";
            OnNoise(shooter.pos, range * (suppressed ? 0.48f : 1), shooter);
        }
        public static void OnNoise(Vector3 pos, float range, Actor owner)
        {
            foreach (var a in actors)
            {
                if (a.brain == null || !a.alive || a.state != "ground" || (owner != null && a.team == owner.team)) continue;
                float dx = a.pos.x - pos.x, dz = a.pos.z - pos.z;
                if (dx * dx + dz * dz < range * range) a.brain.Hear(pos);
            }
        }
        public static int AliveCount() { int n = 0; foreach (var a in actors) if (a.alive) n++; return n; }
        public static int TeamsAlive() { int n = 0; foreach (var t in teams) if (!t.eliminated) n++; return n; }

        public static void Update(float dt)
        {
            if (state != "playing" && !spectating) return;
            time += dt;
            if (pendingResult.HasValue && time >= pendingResult.Value.at) { Finish(pendingResult.Value.win); return; }
            UpdatePlane(dt);
            PlayerCtl.Update(dt);
            if (spectating && TeamsAlive() <= 1) { StopSpectate(); return; }
            foreach (var a in actors) a.brain?.Update(dt);
            foreach (var a in actors.ToArray())
                if (a.alive && a.knocked) { a.bleed -= dt * 2.6f; if (a.bleed <= 0) Kill(a, a.knockedBy, "bleed", false); }
            // 겹침 해소
            var A = actors;
            for (int i = 0; i < A.Count; i++)
            {
                var a = A[i]; if (!a.alive || a.state != "ground") continue;
                for (int j = i + 1; j < A.Count; j++)
                {
                    var b = A[j]; if (!b.alive || b.state != "ground") continue;
                    float dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d2 = dx * dx + dz * dz;
                    if (d2 < 0.5f && d2 > 1e-6f && Mathf.Abs(a.pos.y - b.pos.y) < 1.5f)
                    {
                        float d = Mathf.Sqrt(d2), push = (0.707f - d) * 0.5f;
                        a.pos.x -= dx / d * push; a.pos.z -= dz / d * push; b.pos.x += dx / d * push; b.pos.z += dz / d * push;
                    }
                }
            }
            Bullets.Update(dt);
            Throwables.Update(dt);
            Vehicles.Update(dt);
            if (zone != null) UpdateZone(dt);
            Extras.Update(dt);
            if (training) Training.Update(dt);
        }
    }
}
