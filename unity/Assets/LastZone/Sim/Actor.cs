using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 들고 있는 총 한 자루 (웹판 a.weapons[cls])
    public class Weapon
    {
        public string id; public int mag; public string scope; public bool iron;
        public Dictionary<string, string> attachments = new Dictionary<string, string>();
        public string Att(string slot) => attachments.TryGetValue(slot, out var v) ? v : null;
        public Weapon Clone() => new Weapon { id = id, mag = mag, scope = scope, iron = iron, attachments = new Dictionary<string, string>(attachments) };
        public GunDef Def => Data.Gun(id);
    }

    // 바닥·상자 속 전리품 (웹판 game.loot 항목)
    public class LootItem
    {
        public string kind; public int amount = 1; public Vector3 pos; public bool taken;
        public int mag = -1; public string scope; public bool iron; public Dictionary<string, string> attachments;
        public int level; public List<LootItem> items; public string owner; public bool airdrop, train;
        public Actor claim, failed; public GameObject view; public float rotY;
    }

    // 플레이어·봇 공통 상태 (웹판 actor.js)
    public class Actor
    {
        public int id, team, idx; public string name; public bool isPlayer;
        public Vector3 pos, vel; public float yaw, pitch, hspeed;
        public float hp = 100, bleed = 100; public bool alive = true, knocked;
        public int vest, helmet, bag;
        public Dictionary<string, Weapon> weapons = new Dictionary<string, Weapon> { { "rifle", null }, { "shotgun", null }, { "pistol", null } };
        public Dictionary<string, int> ammo = new Dictionary<string, int> { { "556", 0 }, { "762", 0 }, { "9mm", 0 }, { "45", 0 }, { "12g", 0 } };
        public Dictionary<string, int> attachmentBag = new Dictionary<string, int>();
        public Dictionary<string, int> scopes = new Dictionary<string, int> { { "reddot", 0 }, { "holo", 0 }, { "x2", 0 }, { "x4", 0 }, { "x8", 0 } };
        public Dictionary<string, int> throwables = new Dictionary<string, int> { { "frag", 0 }, { "smoke", 0 }, { "molotov", 0 }, { "flash", 0 } };
        public int bandage, medkit;
        public string cur = "fists";
        public int kills; public float dmgDealt;
        public string state = "plane"; public bool onGround, crouch, prone, swimming, inWater; public float leanX;
        public float landV; public SurfMat groundMat = SurfMat.Terrain;
        public Bot brain; public CharacterView model;
        public float blindT; public Actor knockedBy, lastAttacker; public float lastHurtT = -99, deathTime;
        public bool inVehicle; public object vehicle;
        public LootItem drop;   // 바꿔 든 총·장비 (주운 자리에 내려놓는다)

        public float EyeH() => knocked ? 0.45f : prone ? 0.36f : crouch ? 1.15f : 1.62f;
        public bool Low() => knocked || prone;
        public int AmmoMax(string t) => Mathf.RoundToInt(Data.AmmoMax[t] * new[] { 0.6f, 0.8f, 1f, 1.3f }[bag]);
        public int ThrowMax() => 3 + bag;
        public int BandageMax() => 10 + bag * 5;
        public int MedkitMax() => 3 + bag;
        Vector3 Lean(Vector3 o, float k) { if (leanX != 0) { o.x += Mathf.Cos(yaw) * leanX * k; o.z -= Mathf.Sin(yaw) * leanX * k; } return o; }
        public Vector3 Eye() => Lean(new Vector3(pos.x, pos.y + EyeH(), pos.z), 1);
        public Vector3 Chest() => Lean(new Vector3(pos.x, pos.y + (Low() ? 0.3f : crouch ? 0.85f : 1.2f), pos.z), 0.55f);
        public Vector3 Head() => Lean(new Vector3(pos.x, pos.y + (Low() ? 0.3f : crouch ? 1.2f : 1.64f), pos.z), 1);
        public Vector3 LookDir() { float cp = Mathf.Cos(pitch); return new Vector3(-Mathf.Sin(yaw) * cp, Mathf.Sin(pitch), -Mathf.Cos(yaw) * cp); }
        public bool HasGun() => weapons["rifle"] != null || weapons["shotgun"] != null || weapons["pistol"] != null;
        public Weapon W(string k) => k != null && weapons.TryGetValue(k, out var w) ? w : null;
        public GunDef Wdef(string k) => W(k)?.Def;
        public string GunId(string k) => W(k)?.id ?? k;
        public int GunAmmo(string k) { var w = W(k); return w != null ? w.mag + ammo[Data.Extra[w.id].ammo] : 0; }
        public string BestGun()
        {
            foreach (var k in Data.Slots) if (weapons[k] != null && GunAmmo(k) > 0) return k;
            foreach (var k in Data.Slots) if (weapons[k] != null) return k;
            return "fists";
        }
        public int ThrowCount() { int n = 0; foreach (var v in throwables.Values) n += v; return n; }

        public void Give(string id, int extraAmmo, string scope = null)
        {
            var d = Data.Gun(id); var x = Data.Extra[id];
            weapons[Data.SlotOf(d)] = new Weapon { id = id, mag = d.mag, scope = scope };
            if (extraAmmo > 0) ammo[x.ammo] = Mathf.Min(Mathf.Max(AmmoMax(x.ammo), ammo[x.ammo]), ammo[x.ammo] + extraAmmo);
        }

        // 조준경이 없는 총에 가방의 가장 좋은 호환 조준경을 끼운다
        public bool AutoScope(string cls)
        {
            var w = W(cls); if (w == null || w.scope != null || w.iron) return false;
            var x = Data.Extra[w.id];
            for (int i = Data.ScopeOrder.Length - 1; i >= 0; i--)
            {
                var t = Data.ScopeOrder[i];
                if (scopes[t] > 0 && System.Array.IndexOf(x.scopes, t) >= 0 && t != x.baseSight && (x.baseSight == null || Data.Scopes[t].rank > Data.Scopes[x.baseSight].rank)) { scopes[t]--; w.scope = t; return true; }
            }
            return false;
        }
        public int ScopeCount(string t) { int n = scopes[t]; foreach (var w in weapons.Values) if (w != null && w.scope == t) n++; return n; }

        // 아이템 줍기 — 무언가 얻었으면 라벨 문자열
        public string Pickup(LootItem it, bool fromCrate = false)
        {
            string k = it.kind;
            if (k == "crate")
            {
                var got = new List<string>();
                foreach (var s in it.items.ToArray())
                {
                    if (s.taken) continue;
                    var r = Pickup(s, true); if (r != null) got.Add(r);
                    if (drop != null) { it.items.Add(drop); drop = null; }
                }
                it.items.RemoveAll(s => s.taken);
                if (it.items.Count == 0) it.taken = true;
                return got.Count > 0 ? string.Join(", ", got) : null;
            }
            string res = null;
            var Wd = Data.Gun(k);
            if (Wd != null)
            {
                string cls = Data.SlotOf(Wd); var x = Data.Extra[k];
                var cur = weapons[cls];
                int mag = it.mag >= 0 ? it.mag : Wd.mag;
                if (cur == null)
                {
                    weapons[cls] = new Weapon { id = k, mag = mag, scope = it.scope, iron = it.iron, attachments = it.attachments != null ? new Dictionary<string, string>(it.attachments) : new Dictionary<string, string>() };
                    if (it.scope == null && !isPlayer) AutoScope(cls);
                    res = Wd.displayName;
                }
                else if (cur.id == k || (fromCrate && x.tier <= Data.Extra[cur.id].tier))
                {
                    // 같은 총(또는 상자 속 더 나쁜 총): 탄약과 조준경만
                    int add = Mathf.Min(mag, Mathf.Max(0, AmmoMax(x.ammo) - ammo[x.ammo]));
                    bool takeScope = it.scope != null && it.scope != x.baseSight && ScopeCount(it.scope) < 2;
                    if (add <= 0 && !takeScope) return null;
                    var got = new List<string>();
                    if (add > 0) { ammo[x.ammo] += add; it.mag = mag - add; got.Add(Data.AmmoNames[x.ammo] + " +" + add); }
                    if (takeScope) { scopes[it.scope]++; got.Add(Data.Scopes[it.scope].name); it.scope = null; if (!isPlayer) AutoScope(cls); }
                    res = string.Join(", ", got);
                    bool anyAtt = false; if (it.attachments != null) foreach (var v in it.attachments.Values) if (v != null) anyAtt = true;
                    if ((it.mag >= 0 ? it.mag : mag) > 0 || (it.scope != null && it.scope != x.baseSight) || anyAtt) return res;
                }
                else
                {
                    // 다른 총: 들고 있던 총을 내려놓고 바꾼다
                    drop = new LootItem { kind = cur.id, mag = cur.mag, scope = cur.scope, iron = cur.iron, attachments = new Dictionary<string, string>(cur.attachments) };
                    weapons[cls] = new Weapon { id = k, mag = mag, scope = it.scope, iron = it.iron, attachments = it.attachments != null ? new Dictionary<string, string>(it.attachments) : new Dictionary<string, string>() };
                    if (it.scope == null && !isPlayer) AutoScope(cls);
                    res = Wd.displayName;
                }
            }
            else if (k.StartsWith("att_"))
            {
                if (!Attachments.Catalog.TryGetValue(k, out var info)) return null;
                attachmentBag[k] = (attachmentBag.TryGetValue(k, out var n) ? n : 0) + 1; res = info.name;
            }
            else if (k.StartsWith("scope_"))
            {
                string t = k.Substring(6);
                if (ScopeCount(t) >= 2) return null;
                scopes[t]++;
                if (!isPlayer)
                    foreach (var c in new[] { cur, "rifle", "shotgun", "pistol" })
                    {
                        var w = W(c);
                        if (w != null && w.scope == null && System.Array.IndexOf(Data.Extra[w.id].scopes, t) >= 0 && AutoScope(c)) break;
                    }
                res = Data.Scopes[t].name;
            }
            else if (k.StartsWith("ammo_"))
            {
                string t = k.Substring(5); int add = Mathf.Min(it.amount, AmmoMax(t) - ammo[t]);
                if (add <= 0) return null;
                ammo[t] += add; it.amount -= add;
                res = Data.AmmoNames[t] + " 탄약 +" + add;
                if (it.amount > 0) return res;
            }
            else if (Data.ThrowNames.ContainsKey(k))
            {
                if (throwables[k] >= ThrowMax()) return null;
                int add = Mathf.Min(Mathf.Max(1, it.amount), ThrowMax() - throwables[k]);
                throwables[k] += add; it.amount = Mathf.Max(1, it.amount) - add;
                res = Data.ThrowNames[k] + (add > 1 ? " x" + add : "");
                if (it.amount > 0) return res;
            }
            else if (k == "bandage")
            {
                int add = Mathf.Min(Mathf.Max(1, it.amount), BandageMax() - bandage);
                if (add <= 0) return null;
                bandage += add; it.amount = Mathf.Max(1, it.amount) - add; res = "붕대 +" + add;
                if (it.amount > 0) return res;
            }
            else if (k == "medkit")
            {
                if (medkit >= MedkitMax()) return null;
                medkit++; res = "구급상자";
            }
            else if (k == "vest" || k == "helmet" || k == "bag")
            {
                int lv = Mathf.Max(1, it.level), curLv = k == "vest" ? vest : k == "helmet" ? helmet : bag;
                if (curLv >= lv) return null;
                if (curLv > 0) drop = new LootItem { kind = k, level = curLv };
                if (k == "vest") vest = lv; else if (k == "helmet") helmet = lv; else bag = lv;
                res = Data.GearNames[k] + " Lv." + lv;
            }
            else return null;
            it.taken = true;
            return res;
        }

        // 사망 시 상자에 담을 것
        public List<LootItem> DropAll()
        {
            var items = new List<LootItem>();
            foreach (var k in Data.Slots) { var w = weapons[k]; if (w != null) items.Add(new LootItem { kind = w.id, mag = w.mag, scope = w.scope, iron = w.iron, attachments = new Dictionary<string, string>(w.attachments) }); }
            foreach (var kv in attachmentBag) for (int i = 0; i < kv.Value; i++) items.Add(new LootItem { kind = kv.Key });
            foreach (var kv in scopes) for (int i = 0; i < kv.Value; i++) items.Add(new LootItem { kind = "scope_" + kv.Key });
            foreach (var kv in ammo) if (kv.Value > 0) items.Add(new LootItem { kind = "ammo_" + kv.Key, amount = kv.Value });
            foreach (var kv in throwables) if (kv.Value > 0) items.Add(new LootItem { kind = kv.Key, amount = kv.Value });
            if (bandage > 0) items.Add(new LootItem { kind = "bandage", amount = bandage });
            for (int i = 0; i < medkit; i++) items.Add(new LootItem { kind = "medkit" });
            if (vest > 0) items.Add(new LootItem { kind = "vest", level = vest });
            if (helmet > 0) items.Add(new LootItem { kind = "helmet", level = helmet });
            if (bag > 0) items.Add(new LootItem { kind = "bag", level = bag });
            return items;
        }
    }

    // 캐릭터 물리 (웹판 G.Physics): 상자 충돌 · 계단 0.5 m · 절벽 · 천장 · 물
    public static class CharPhysics
    {
        public const float STEP = 0.5f, R = 0.33f, GRAV = 22f;

        public static void Move(Actor a, float dt)
        {
            float r = R;
            float height = a.Low() ? 0.6f : a.crouch ? 1.25f : 1.8f;
            a.vel.y -= GRAV * dt;
            if (a.vel.y < -55) a.vel.y = -55;
            float x = a.pos.x + a.vel.x * dt, z = a.pos.z + a.vel.z * dt;
            float feet = a.pos.y;
            for (int it = 0; it < 2; it++)
            {
                World.QueryBoxes(x - r - 0.1f, z - r - 0.1f, x + r + 0.1f, z + r + 0.1f, b =>
                {
                    if (b.maxY <= feet + STEP || b.minY >= feet + height) return;
                    float cx = x < b.minX ? b.minX : x > b.maxX ? b.maxX : x;
                    float cz = z < b.minZ ? b.minZ : z > b.maxZ ? b.maxZ : z;
                    float dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
                    if (d2 >= r * r) return;
                    if (d2 > 1e-10f)
                    {
                        float d = Mathf.Sqrt(d2), push = r - d;
                        dx /= d; dz /= d;
                        x += dx * push; z += dz * push;
                        float vn = a.vel.x * dx + a.vel.z * dz;
                        if (vn < 0) { a.vel.x -= vn * dx; a.vel.z -= vn * dz; }
                    }
                    else
                    {
                        float pl = x - b.minX, pr = b.maxX - x, pb = z - b.minZ, pf = b.maxZ - z;
                        float m = Mathf.Min(Mathf.Min(pl, pr), Mathf.Min(pb, pf));
                        if (m == pl) x = b.minX - r; else if (m == pr) x = b.maxX + r; else if (m == pb) z = b.minZ - r; else z = b.maxZ + r;
                    }
                });
            }
            float lim = World.HALF - 3;
            x = Mathf.Clamp(x, -lim, lim); z = Mathf.Clamp(z, -lim, lim);
            // 가파른 절벽은 오를 수 없다
            float mvx = x - a.pos.x, mvz = z - a.pos.z, md = Mathf.Sqrt(mvx * mvx + mvz * mvz);
            if (md > 1e-4f)
            {
                float g0 = World.HeightAt(a.pos.x, a.pos.z), g1 = World.HeightAt(x, z);
                if ((g1 - g0) / md > 1.3f && g1 > a.pos.y - 0.05f)
                {
                    x = a.pos.x; z = a.pos.z;
                    float nx = mvx / md, nz = mvz / md, vn = a.vel.x * nx + a.vel.z * nz;
                    if (vn > 0) { a.vel.x -= vn * nx; a.vel.z -= vn * nz; }
                }
            }
            float y = a.pos.y + a.vel.y * dt;
            if (a.vel.y > 0)
            {
                float rr = r * 0.7f, yy = y;
                World.QueryBoxes(x - rr, z - rr, x + rr, z + rr, b =>
                {
                    if (b.minY >= feet + height - 0.05f && yy + height > b.minY) { yy = b.minY - height; a.vel.y = 0; }
                });
                y = yy;
            }
            float g = World.Ground(x, z, feet, r * 0.75f, STEP);
            a.groundMat = World.gmat;
            a.landV = 0;
            bool was = a.onGround;
            if (y <= g) { if (!was) a.landV = a.vel.y; y = g; a.vel.y = 0; a.onGround = true; }
            else if (was && a.vel.y <= 0 && y - g < 0.55f) { y = g; a.vel.y = 0; a.onGround = true; }
            else a.onGround = false;
            a.swimming = false;
            float wl = World.WaterAt(x, z);
            if (y < wl - 1.25f && World.HeightAt(x, z) < wl - 1.25f)
            {
                y = wl - 1.25f; if (a.vel.y < 0) a.vel.y = 0; a.onGround = true; a.swimming = true; a.landV = 0;
            }
            a.inWater = y < wl - 0.15f;
            a.pos = new Vector3(x, y, z);
            a.hspeed = Mathf.Sqrt(a.vel.x * a.vel.x + a.vel.z * a.vel.z);
        }

        public static bool CanStand(Actor a, float h = 0)
        {
            bool ok = true;
            float r = R * 0.8f, x = a.pos.x, z = a.pos.z, top = h > 0 ? h : 1.82f, from = a.prone ? 0.5f : 1.0f;
            World.QueryBoxes(x - r, z - r, x + r, z + r, b => { if (b.minY > a.pos.y + from && b.minY < a.pos.y + top) ok = false; });
            return ok;
        }
    }
}
