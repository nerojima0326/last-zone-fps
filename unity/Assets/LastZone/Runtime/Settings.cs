using UnityEngine;

namespace LastZone
{
    // 설정 (웹판 settings.js + 메뉴의 매치 설정 · 그래픽): PlayerPrefs 에 저장
    public static class Settings
    {
        public static float sens = 1, adsSens = 1, scopeSens = 1, fov = 80, volMaster = 1, volWeapons = 1, volAmbient = 1, fovScale = 1;
        public static bool invertY, showFps = true;
        public static string quality = "auto", name = "Player", mode = "solo", diff = "normal", loadout = "all", tod = "day";
        public static int players = 24, fpsTarget = 60;
        public static readonly string[] Qualities = { "auto", "potato", "low", "medium", "high" };
        public static readonly string[] QualityNames = { "자동", "최저", "낮음", "중간", "높음" };

        public static void Load()
        {
            sens = PlayerPrefs.GetFloat("lz_sens", 1); adsSens = PlayerPrefs.GetFloat("lz_adsSens", 1); scopeSens = PlayerPrefs.GetFloat("lz_scopeSens", 1);
            fov = PlayerPrefs.GetFloat("lz_fov", 80); invertY = PlayerPrefs.GetInt("lz_invertY", 0) == 1;
            volMaster = PlayerPrefs.GetFloat("lz_vol_master", 1); volWeapons = PlayerPrefs.GetFloat("lz_vol_weapons", 1); volAmbient = PlayerPrefs.GetFloat("lz_vol_ambient", 1);
            quality = PlayerPrefs.GetString("lz_quality", "auto"); showFps = PlayerPrefs.GetInt("lz_showFps", 1) == 1; fpsTarget = PlayerPrefs.GetInt("lz_fps", 60);
            name = PlayerPrefs.GetString("lz_name", "Player"); mode = PlayerPrefs.GetString("lz_mode", "solo"); diff = PlayerPrefs.GetString("lz_diff", "normal");
            loadout = PlayerPrefs.GetString("lz_loadout", "all"); tod = PlayerPrefs.GetString("lz_tod", "day"); players = PlayerPrefs.GetInt("lz_players", 24);
        }
        public static void Save()
        {
            PlayerPrefs.SetFloat("lz_sens", sens); PlayerPrefs.SetFloat("lz_adsSens", adsSens); PlayerPrefs.SetFloat("lz_scopeSens", scopeSens);
            PlayerPrefs.SetFloat("lz_fov", fov); PlayerPrefs.SetInt("lz_invertY", invertY ? 1 : 0);
            PlayerPrefs.SetFloat("lz_vol_master", volMaster); PlayerPrefs.SetFloat("lz_vol_weapons", volWeapons); PlayerPrefs.SetFloat("lz_vol_ambient", volAmbient);
            PlayerPrefs.SetString("lz_quality", quality); PlayerPrefs.SetInt("lz_showFps", showFps ? 1 : 0); PlayerPrefs.SetInt("lz_fps", fpsTarget);
            PlayerPrefs.SetString("lz_name", name); PlayerPrefs.SetString("lz_mode", mode); PlayerPrefs.SetString("lz_diff", diff);
            PlayerPrefs.SetString("lz_loadout", loadout); PlayerPrefs.SetString("lz_tod", tod); PlayerPrefs.SetInt("lz_players", players);
            PlayerPrefs.Save();
        }
        public static void Apply()
        {
            PlayerCtl.sens = sens; PlayerCtl.adsSens = adsSens; PlayerCtl.scopeSens = scopeSens; PlayerCtl.fov = fov; PlayerCtl.invertY = invertY;
            Sfx.master = volMaster; Sfx.weaponsVol = volWeapons; Sfx.ambientVol = volAmbient;
            Application.targetFrameRate = fpsTarget;
            Graphics2.ApplyQuality(quality);
        }
        public static int TeamSize(string m) => m == "duo" ? 2 : m == "trio" ? 3 : m == "squad" ? 4 : 1;
        public static MatchOptions Options(bool training) => new MatchOptions { mode = training ? "training" : mode, diff = diff, loadout = loadout, name = name, tod = tod, size = TeamSize(mode), players = players };
    }
}
