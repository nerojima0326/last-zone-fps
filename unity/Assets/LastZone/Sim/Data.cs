using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 웹판 weapons.js · actor.js · game.js 의 표 (탄약·조준경·투척물·장비·전리품)
    public static class Data
    {
        public static readonly string[] AmmoTypes = { "556", "762", "9mm", "45", "12g" };
        public static readonly Dictionary<string, string> AmmoNames = new Dictionary<string, string> { { "556", "5.56mm" }, { "762", "7.62mm" }, { "9mm", "9mm" }, { "45", ".45 ACP" }, { "12g", "12게이지" } };
        public static readonly Dictionary<string, int> AmmoMax = new Dictionary<string, int> { { "556", 240 }, { "762", 180 }, { "9mm", 150 }, { "45", 120 }, { "12g", 60 } };

        public class Scope { public string name; public float zoom; public int rank; }
        public static readonly Dictionary<string, Scope> Scopes = new Dictionary<string, Scope>
        {
            { "reddot", new Scope { name = "레드닷", zoom = 1, rank = 1 } },
            { "holo", new Scope { name = "홀로그램", zoom = 1, rank = 2 } },
            { "x2", new Scope { name = "2배율 스코프", zoom = 2, rank = 3 } },
            { "x4", new Scope { name = "4배율 스코프", zoom = 4, rank = 4 } },
            { "x8", new Scope { name = "8배율 스코프", zoom = 8, rank = 5 } }
        };
        public static readonly string[] ScopeOrder = { "reddot", "holo", "x2", "x4", "x8" };
        public static readonly string[] ThrowOrder = { "frag", "smoke", "molotov", "flash" };
        public static readonly Dictionary<string, string> ThrowNames = new Dictionary<string, string> { { "frag", "수류탄" }, { "smoke", "연막탄" }, { "molotov", "화염병" }, { "flash", "섬광탄" } };
        public static readonly Dictionary<string, string> GearNames = new Dictionary<string, string> { { "vest", "방탄조끼" }, { "helmet", "헬멧" }, { "bag", "가방" } };
        public static readonly float[] ArmorHelmet = { 1f, 0.7f, 0.6f, 0.45f }, ArmorVest = { 1f, 0.8f, 0.7f, 0.55f };
        public static readonly string[] Slots = { "rifle", "shotgun", "pistol" };
        public static readonly Dictionary<string, string> DefaultGun = new Dictionary<string, string> { { "rifle", "ar7" }, { "shotgun", "s12" }, { "pistol", "p92" } };
        public static readonly Dictionary<string, string> ClassNames = new Dictionary<string, string> { { "rifle", "소총" }, { "shotgun", "산탄총" }, { "pistol", "권총" } };
        public const float ReloadSpeed = 1.25f;
        public const float FistDmg = 22f;

        // 총마다 웹판에만 있던 값: 탄약 · 등급 · 기본 조준기 · 달 수 있는 조준경
        public class GunExtra { public string ammo; public int tier; public string baseSight; public string[] scopes; }
        static readonly string[] All = { "reddot", "holo", "x2", "x4", "x8" }, SG = { "reddot", "holo", "x2" }, DB = { "reddot", "holo" }, PI = { "reddot" }, NONE = { };
        public static readonly Dictionary<string, GunExtra> Extra = new Dictionary<string, GunExtra>
        {
            { "ar7", new GunExtra { ammo = "556", tier = 2, baseSight = "reddot", scopes = All } },
            { "ka47", new GunExtra { ammo = "762", tier = 2, scopes = All } },
            { "sc17", new GunExtra { ammo = "762", tier = 3, scopes = All } },
            { "mk14", new GunExtra { ammo = "762", tier = 3, scopes = All } },
            { "kr98", new GunExtra { ammo = "762", tier = 4, scopes = All } },
            { "s12", new GunExtra { ammo = "12g", tier = 2, scopes = SG } },
            { "m1014", new GunExtra { ammo = "12g", tier = 3, scopes = SG } },
            { "db2", new GunExtra { ammo = "12g", tier = 2, scopes = DB } },
            { "sa12", new GunExtra { ammo = "12g", tier = 3, scopes = SG } },
            { "aa12", new GunExtra { ammo = "12g", tier = 4, scopes = SG } },
            { "p92", new GunExtra { ammo = "9mm", tier = 1, scopes = PI } },
            { "g18", new GunExtra { ammo = "9mm", tier = 2, scopes = PI } },
            { "m1911", new GunExtra { ammo = "45", tier = 1, scopes = PI } },
            { "de7", new GunExtra { ammo = "45", tier = 3, scopes = PI } },
            { "r45", new GunExtra { ammo = "45", tier = 3, scopes = NONE } },
        };

        static Dictionary<string, GunDef> byId;
        public static GunDef Gun(string id)
        {
            if (byId == null) { byId = new Dictionary<string, GunDef>(); foreach (var g in GunTable.All) byId[g.id] = g; }
            return id != null && byId.TryGetValue(id, out var d) ? d : null;
        }
        public static string SlotOf(GunDef d) => d.cls == GunClass.Rifle ? "rifle" : d.cls == GunClass.Shotgun ? "shotgun" : "pistol";
        public static IEnumerable<string> GunIds { get { foreach (var g in GunTable.All) yield return g.id; } }
        public static List<string> GunsOfClass(string slot) { var l = new List<string>(); foreach (var g in GunTable.All) if (SlotOf(g) == slot) l.Add(g.id); return l; }

        // 전리품 표 (가중치) · 기본 수량 · 이름
        public static readonly List<KeyValuePair<string, float>> LootTable = new List<KeyValuePair<string, float>>
        {
            P("ar7", 3.2f), P("ka47", 3.2f), P("sc17", 2), P("mk14", 1.4f), P("kr98", 1),
            P("s12", 2.8f), P("m1014", 1.8f), P("db2", 2.8f), P("sa12", 1.6f), P("aa12", 0.7f),
            P("p92", 2.8f), P("g18", 1.8f), P("m1911", 2.8f), P("de7", 1.4f), P("r45", 1.4f),
            P("ammo_556", 8), P("ammo_762", 8), P("ammo_9mm", 6), P("ammo_45", 5), P("ammo_12g", 7),
            P("scope_reddot", 3.5f), P("scope_holo", 2.8f), P("scope_x2", 2.6f), P("scope_x4", 1.8f), P("scope_x8", 0.9f),
            P("frag", 7), P("smoke", 5), P("molotov", 5), P("flash", 5),
            P("bandage", 9), P("medkit", 4), P("vest", 4), P("helmet", 5), P("bag", 4)
        };
        static KeyValuePair<string, float> P(string k, float w) => new KeyValuePair<string, float>(k, w);
        public static readonly Dictionary<string, int> LootAmount = new Dictionary<string, int> { { "ammo_556", 30 }, { "ammo_762", 30 }, { "ammo_9mm", 30 }, { "ammo_45", 24 }, { "ammo_12g", 10 }, { "bandage", 2 } };

        public static string LootName(string k)
        {
            var g = Gun(k); if (g != null) return g.displayName;
            if (k.StartsWith("ammo_")) return AmmoNames[k.Substring(5)] + " 탄약";
            if (k.StartsWith("scope_")) return Scopes[k.Substring(6)].name;
            if (ThrowNames.TryGetValue(k, out var t)) return t;
            if (GearNames.TryGetValue(k, out var gname)) return gname;
            if (k == "bandage") return "붕대"; if (k == "medkit") return "구급상자";
            if (Attachments.Catalog.TryGetValue(k, out var a)) return a.name;
            return k;
        }

        public static string WeaponLabel(string w)
        {
            switch (w)
            {
                case "fists": return "주먹"; case "frag": return "수류탄"; case "molotov": return "화염병"; case "zone": return "자기장";
                case "fall": return "낙하"; case "bleed": return "출혈"; case "vehicle": return "차량"; case "carbomb": return "차량 폭발";
            }
            var g = Gun(w); return g != null ? g.shortName : w;
        }
    }
}
