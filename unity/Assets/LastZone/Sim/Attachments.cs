using System.Collections.Generic;

namespace LastZone
{
    // 웹판 attachments.js 의 규칙: 총마다 달 수 있는 부착물 · 효과 배율 · 탄창 용량
    public static class Attachments
    {
        public class Info { public string slot, value, name; }
        public struct Mods { public float v, h, hip, spread, ads, reload; }

        public static Dictionary<string, List<KeyValuePair<string, string>>> Options(GunDef d)
        {
            var x = Data.Extra[d.id];
            bool mag = d.reloadType == ReloadType.Mag && d.id != "kr98";
            var o = new Dictionary<string, List<KeyValuePair<string, string>>>();
            var optic = new List<KeyValuePair<string, string>> { KV("iron", "가늠쇠") };
            foreach (var s in x.scopes) optic.Add(KV(s, Data.Scopes[s].name));
            o["optic"] = optic;
            var muzzle = new List<KeyValuePair<string, string>> { KV("none", "기본") };
            if (d.id != "db2" && d.id != "r45")
            {
                if (d.cls == GunClass.Shotgun) muzzle.Add(KV("choke", "초크"));
                else { muzzle.Add(KV("suppressor", "소음기")); muzzle.Add(KV("compensator", "보정기")); muzzle.Add(KV("flash", "소염기")); }
            }
            o["muzzle"] = muzzle;
            var under = new List<KeyValuePair<string, string>> { KV("none", "기본") };
            if (d.cls == GunClass.Rifle && d.id != "kr98") { under.Add(KV("grip", "수직 손잡이")); under.Add(KV("angled", "앵글 손잡이")); under.Add(KV("light", "경량 손잡이")); under.Add(KV("half", "하프 손잡이")); }
            o["under"] = under;
            var magz = new List<KeyValuePair<string, string>> { KV("none", "기본") };
            if (mag) { magz.Add(KV("extended", "대용량 탄창")); magz.Add(KV("quick", "퀵드로우 탄창")); magz.Add(KV("extendedQuick", "대용량 퀵드로우")); }
            o["magazine"] = magz;
            var stock = new List<KeyValuePair<string, string>> { KV("none", "기본") };
            if (d.cls == GunClass.Rifle) { stock.Add(KV("tactical", "전술 개머리판")); stock.Add(KV("cheek", "뺨 받침대")); }
            o["stock"] = stock;
            o["side"] = new List<KeyValuePair<string, string>> { KV("none", "기본"), KV("laser", "레이저 모듈") };
            return o;
        }
        static KeyValuePair<string, string> KV(string a, string b) => new KeyValuePair<string, string>(a, b);

        static Dictionary<string, Info> catalog;
        public static Dictionary<string, Info> Catalog
        {
            get
            {
                if (catalog != null) return catalog;
                catalog = new Dictionary<string, Info>();
                foreach (var g in GunTable.All)
                    foreach (var kv in Options(g))
                        if (kv.Key != "optic")
                            foreach (var o in kv.Value)
                                if (o.Key != "none") catalog["att_" + kv.Key + "_" + o.Key] = new Info { slot = kv.Key, value = o.Key, name = o.Value };
                return catalog;
            }
        }

        public static int Capacity(Weapon w, GunDef d)
        {
            string t = w?.Att("magazine");
            return d.mag + ((t == "extended" || t == "extendedQuick") ? System.Math.Max(2, (int)System.Math.Ceiling(d.mag * 0.3)) : 0);
        }

        public static Mods Modifiers(Weapon w)
        {
            var m = new Mods { v = 1, h = 1, hip = 1, spread = 1, ads = 1, reload = 1 };
            if (w == null) return m;
            string mu = w.Att("muzzle"), un = w.Att("under"), st = w.Att("stock"), si = w.Att("side"), mg = w.Att("magazine");
            if (mu == "compensator") { m.v *= .88f; m.h *= .9f; } else if (mu == "flash") { m.v *= .95f; m.h *= .95f; } else if (mu == "choke") m.spread *= .88f;
            if (un == "grip") m.v *= .9f; else if (un == "angled") { m.h *= .85f; m.ads *= .95f; } else if (un == "light") { m.v *= .95f; m.ads *= .9f; } else if (un == "half") { m.v *= .94f; m.h *= .94f; }
            if (st == "tactical") { m.v *= .95f; m.h *= .93f; } else if (st == "cheek") { m.ads *= .93f; m.v *= .96f; }
            if (si == "laser") m.hip *= .9f;
            if (mg == "quick" || mg == "extendedQuick") m.reload *= .8f;
            return m;
        }

        public static string Optic(Weapon w, GunDef d) => w.iron ? null : (w.scope ?? Data.Extra[d.id].baseSight);

        // 부착물 바꾸기 (가방에 있는 것만). 실패하면 사유를 msg 로
        public static bool Change(Actor a, Weapon w, string slot, string val, bool training, out string msg)
        {
            msg = null;
            var d = Data.Gun(w.id); var x = Data.Extra[w.id];
            if (!Options(d).TryGetValue(slot, out var list) || !list.Exists(o => o.Key == val)) return false;
            string old = slot == "optic" ? w.scope : w.Att(slot), next = val == "none" || val == "iron" ? null : val;
            if (old == next && (slot != "optic" || w.iron == (val == "iron"))) return true;
            string oldItem = slot == "optic" ? (old != null && old != x.baseSight ? "scope_" + old : null) : (old != null ? "att_" + slot + "_" + old : null);
            string newItem = slot == "optic" ? (next != null && next != x.baseSight ? "scope_" + next : null) : (next != null ? "att_" + slot + "_" + next : null);
            int Count(string k) => k == null ? 0 : k.StartsWith("scope_") ? a.scopes[k.Substring(6)] : (a.attachmentBag.TryGetValue(k, out var n) ? n : 0);
            void Add(string k, int n) { if (k == null) return; if (k.StartsWith("scope_")) a.scopes[k.Substring(6)] += n; else a.attachmentBag[k] = (a.attachmentBag.TryGetValue(k, out var c) ? c : 0) + n; }
            if (newItem != null && Count(newItem) < 1) { msg = "먼저 해당 부착물을 획득하세요"; return false; }
            if (slot == "magazine")
            {
                var prop = w.Clone(); prop.attachments["magazine"] = next;
                int excess = System.Math.Max(0, w.mag - Capacity(prop, d));
                if (!training && excess > 0 && excess > System.Math.Max(0, a.AmmoMax(x.ammo) - a.ammo[x.ammo])) { msg = "예비 탄약 공간이 부족합니다"; return false; }
                w.mag -= excess; if (!training) a.ammo[x.ammo] += excess;
            }
            Add(oldItem, 1); Add(newItem, -1);
            if (slot == "optic") { w.scope = next; w.iron = val == "iron"; } else w.attachments[slot] = next;
            return true;
        }
    }
}
