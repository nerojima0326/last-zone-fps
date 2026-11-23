using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 게임 규칙 → 화면 메시지 창구 (웹판 G.UI 의 center · toast · killfeed · hitmarker · hurt · pickup …). 그리는 것은 GameHud
    public static class GameUI
    {
        public class CenterMsg { public string title, sub, kind; public float t, dur; }
        public class FeedLine { public string text; public float t; }
        public class ToastMsg { public string text; public float t; }
        public static CenterMsg center;
        public static readonly List<FeedLine> feed = new List<FeedLine>();
        public static readonly List<ToastMsg> toasts = new List<ToastMsg>();
        public static readonly List<FeedLine> pickups = new List<FeedLine>();
        public static float hitT = -9, hurtT = -9, hurtAmt; public static bool hitHead, hitKill;
        public static readonly List<(float ang, float t)> hurtDirs = new List<(float, float)>();
        public static (string title, string sub, bool knock, int kills, float t)? killMsg;

        static string Rich(string html)
        {
            if (html == null) return "";
            return html.Replace("<small>", "<size=85%>").Replace("</small>", "</size>").Replace("<kbd>", "[").Replace("</kbd>", "]");
        }
        static float Now => Time.unscaledTime;

        public static void Center(string title, string sub, string kind, float dur) => center = new CenterMsg { title = Rich(title), sub = Rich(sub), kind = kind, t = Now, dur = dur };
        public static void Toast(string text) { toasts.Add(new ToastMsg { text = Rich(text), t = Now }); if (toasts.Count > 3) toasts.RemoveAt(0); }
        public static void Feed(string text) { feed.Add(new FeedLine { text = Rich(text), t = Now }); if (feed.Count > 6) feed.RemoveAt(0); }
        public static void Pickup(string text) { pickups.Add(new FeedLine { text = Rich(text), t = Now }); if (pickups.Count > 4) pickups.RemoveAt(0); }
        public static void Hitmarker(bool head, bool kill) { hitT = Now; hitHead = head; hitKill = kill; }
        public static void Hurt(float dmg, Vector3? from)
        {
            hurtT = Now; hurtAmt = Mathf.Min(1, hurtAmt + dmg / 60);
            var a = Match.player;
            if (from.HasValue && a != null)
            {
                float yaw = Mathf.Atan2(-(from.Value.x - a.pos.x), -(from.Value.z - a.pos.z));
                hurtDirs.Add((U.AngleDiff(a.yaw, yaw), Now));
                if (hurtDirs.Count > 4) hurtDirs.RemoveAt(0);
            }
        }
        public static void Killfeed(Actor attacker, Actor victim, string weapon, bool head, bool knock)
        {
            string Col(Actor x) => x == null ? "" : x.team == Match.player?.team ? "#7ee081" : "#ff8a7a";
            string w = Data.WeaponLabel(weapon);
            string line = attacker != null && attacker != victim
                ? $"<color={Col(attacker)}>{attacker.name}</color>  <color=#d8d2c0>[{w}{(head ? " · 헤드" : "")}]</color>  <color={Col(victim)}>{victim.name}</color>{(knock ? " <color=#ffcf3a>기절</color>" : "")}"
                : $"<color={Col(victim)}>{victim.name}</color> <color=#d8d2c0>{w}{(knock ? " · 기절" : "")}</color>";
            Feed(line);
        }
        public static void KillMsg(string title, string sub, bool knock, int kills) => killMsg = (title, sub, knock, kills, Now);
        public static void Clear() { center = null; feed.Clear(); toasts.Clear(); pickups.Clear(); hurtDirs.Clear(); killMsg = null; hurtAmt = 0; }
    }

    // 3인칭 캐릭터 화면 쪽 상태 (사격 반동 · 움찔 · 던지기)
    public class CharacterView
    {
        public float kick, flinch, throwT;
        public GameObject root;
    }
}
