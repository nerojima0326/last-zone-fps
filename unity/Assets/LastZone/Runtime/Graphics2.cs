using UnityEngine;

namespace LastZone
{
    // 그래픽 단계 · 시간대 · 날씨 (웹판 main.js 품질 단계 + world.setTimeOfDay + extras Weather 의 간단판)
    public static class Graphics2
    {
        public static Light sun;
        public static string tier = "high";
        static float autoT, autoLow, fpsAvg = 60;

        public static void ApplyQuality(string q)
        {
            if (q == "auto") q = SystemInfo.graphicsMemorySize < 3000 ? "low" : "high";
            tier = q;
            int lvl = q == "potato" ? 0 : q == "low" ? 1 : q == "medium" ? 2 : 3;
            QualitySettings.shadowDistance = new[] { 0f, 60f, 110f, 180f }[lvl];
            QualitySettings.lodBias = new[] { 0.5f, 0.8f, 1.2f, 2f }[lvl];
            QualitySettings.antiAliasing = new[] { 0, 0, 2, 4 }[lvl];
            var t = Terrain.activeTerrain;
            if (t != null)
            {
                t.heightmapPixelError = new[] { 12f, 8f, 5f, 3f }[lvl];
                t.treeDistance = new[] { 450f, 700f, 1100f, 1500f }[lvl];
                t.treeMaximumFullLODCount = new[] { 150, 400, 1000, 2000 }[lvl];
                t.basemapDistance = new[] { 120f, 200f, 350f, 500f }[lvl];
            }
            if (sun != null) sun.shadows = lvl == 0 ? LightShadows.None : LightShadows.Soft;
            Fx.quality = lvl;
        }

        // 자동 품질: 목표 FPS 를 못 지키면 한 단계 내린다 (웹판 DRS 대신 간단히)
        public static void AutoTick(float dt)
        {
            if (Settings.quality != "auto" || dt <= 0) return;
            fpsAvg = Mathf.Lerp(fpsAvg, 1f / dt, 0.05f);
            autoT += dt;
            if (fpsAvg < Settings.fpsTarget * 0.8f) autoLow += dt; else autoLow = Mathf.Max(0, autoLow - dt);
            if (autoLow > 4 && autoT > 8)
            {
                autoT = 0; autoLow = 0;
                string next = tier == "high" ? "medium" : tier == "medium" ? "low" : "potato";
                if (next != tier) { ApplyQualityTier(next); GameUI.Toast("그래픽: " + next); }
            }
        }
        static void ApplyQualityTier(string q) { var keep = Settings.quality; ApplyQuality(q); Settings.quality = keep; }

        public static void TimeOfDay(string tod)
        {
            if (tod == "random") tod = new[] { "day", "sunset", "night", "fog", "rain" }[Random.Range(0, 5)];
            if (sun == null) return;
            Color fog; float sunI, elev;
            switch (tod)
            {
                case "sunset": sun.color = new Color(1f, 0.62f, 0.38f); sunI = 1.0f; elev = 9; fog = new Color(0.86f, 0.62f, 0.48f); RenderSettings.ambientLight = new Color(0.45f, 0.38f, 0.38f); break;
                case "night": sun.color = new Color(0.55f, 0.62f, 0.85f); sunI = 0.18f; elev = 35; fog = new Color(0.04f, 0.05f, 0.08f); RenderSettings.ambientLight = new Color(0.07f, 0.08f, 0.12f); break;
                case "fog": sun.color = new Color(0.9f, 0.92f, 0.95f); sunI = 0.55f; elev = 40; fog = new Color(0.68f, 0.7f, 0.72f); RenderSettings.ambientLight = new Color(0.5f, 0.52f, 0.55f); break;
                case "rain": sun.color = new Color(0.75f, 0.8f, 0.88f); sunI = 0.45f; elev = 45; fog = new Color(0.45f, 0.48f, 0.52f); RenderSettings.ambientLight = new Color(0.36f, 0.38f, 0.42f); break;
                default: sun.color = new Color(1f, 0.96f, 0.9f); sunI = 1.25f; elev = 48; fog = new Color(0.72f, 0.79f, 0.86f); RenderSettings.ambientLight = new Color(0.55f, 0.6f, 0.66f); break;
            }
            sun.intensity = sunI;
            sun.transform.rotation = Quaternion.Euler(elev, -35, 0);
            RenderSettings.fog = true; RenderSettings.fogColor = fog;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogStartDistance = tod == "fog" ? 20 : tod == "rain" ? 60 : tod == "night" ? 40 : 250;
            RenderSettings.fogEndDistance = tod == "fog" ? 220 : tod == "rain" ? 600 : tod == "night" ? 420 : 1800;
            Match.visK = tod == "night" ? 0.55f : tod == "fog" ? 0.5f : tod == "rain" ? 0.75f : 1;
            var cam = Camera.main;
            if (cam != null) { cam.clearFlags = tod == "night" || tod == "fog" || tod == "rain" ? CameraClearFlags.SolidColor : CameraClearFlags.Skybox; cam.backgroundColor = fog; }
        }
    }
}
