using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 웹판 core.js 의 U (작은 수학 도우미)
    public static class U
    {
        static System.Random rng = new System.Random();
        public static float R() => (float)rng.NextDouble();
        public static float Rand(float a, float b) => a + (b - a) * R();
        public static int RandInt(int a, int b) => a + (int)(R() * (b - a + 1));
        public static T Pick<T>(IList<T> l) => l.Count == 0 ? default : l[Mathf.Min(l.Count - 1, (int)(R() * l.Count))];
        public static float Clamp(float v, float a, float b) => v < a ? a : v > b ? b : v;
        public static float Lerp(float a, float b, float t) => a + (b - a) * t;
        public static float Damp(float a, float b, float k, float dt) => Lerp(a, b, 1 - Mathf.Exp(-k * dt));
        public static float Approach(float v, float t, float d) => v < t ? Mathf.Min(t, v + d) : Mathf.Max(t, v - d);
        public static float Smoothstep(float a, float b, float v) { float t = Clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
        public static float AngleDiff(float a, float b) { float d = (b - a) % (Mathf.PI * 2); if (d > Mathf.PI) d -= Mathf.PI * 2; if (d < -Mathf.PI) d += Mathf.PI * 2; return d; }
        public static float Hypot(float a, float b) => Mathf.Sqrt(a * a + b * b);
        public static void Shuffle<T>(IList<T> l) { for (int i = l.Count - 1; i > 0; i--) { int j = (int)(R() * (i + 1)); var t = l[i]; l[i] = l[j]; l[j] = t; } }
        public static string FmtTime(float s) { int t = Mathf.Max(0, Mathf.CeilToInt(s)); return (t / 60) + ":" + (t % 60).ToString("00"); }
        public static float SegDist2D(float px, float pz, float ax, float az, float bx, float bz)
        {
            float dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
            float t = l2 > 0 ? Clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
            return Hypot(px - (ax + dx * t), pz - (az + dz * t));
        }
    }
}
