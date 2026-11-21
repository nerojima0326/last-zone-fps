// 자동 생성: 웹판 js/weapons.js 의 수치와 assets/models/guns/*.glb 의 조준선(sight)·총구(muzzle) 정보
//  sightHeight: 가늠쇠 끝(고리 조준기는 고리 가운데) 높이 — 조준할 때 이 선이 화면 정가운데(탄착점)에 온다
//  muzzleFwd·sightFwd 는 방아쇠(모델 원점)에서 총구 방향(+) 거리 m, muzzleUp·sightHeight 는 위(+) m
using System.Collections.Generic;

namespace LastZone
{
    public static class GunTable
    {
        public static readonly List<GunDef> All = new List<GunDef>
        {
            new GunDef { id = "sc17", displayName = "SC-17 전투소총", shortName = "SC-17", cls = GunClass.Rifle, action = ActionType.Auto, reloadType = ReloadType.Mag,
                auto = true, pellets = 1, mag = 20, clip = 0, dmg = 34f, head = 2.2f, rpm = 540f, cycle = 0f,
                reload = 1.92f, clipReload = 0f, spread = 0.026f, adsSpread = 0.0024f, move = 0.04f, bloom = 0.008f, bloomMax = 0.04f,
                recoilV = 0.0348f, recoilH = 0.0108f, vel = 790f, adsFov = 46f, kick = 1.1475f, range = 680f,
                falloffA = 130f, falloffB = 0.85f, adsTime = 0.17f, tracerLen = 9f,
                muzzleUp = 0.05696f, muzzleFwd = 0.5665f, sightHeight = 0.141f, sightFwd = -0.075f, eyeDist = 0.16f },
            new GunDef { id = "ka47", displayName = "KA-47 돌격소총", shortName = "KA-47", cls = GunClass.Rifle, action = ActionType.Auto, reloadType = ReloadType.Mag,
                auto = true, pellets = 1, mag = 30, clip = 0, dmg = 30f, head = 2.2f, rpm = 600f, cycle = 0f,
                reload = 2f, clipReload = 0f, spread = 0.028f, adsSpread = 0.003f, move = 0.04f, bloom = 0.007f, bloomMax = 0.04f,
                recoilV = 0.03045f, recoilH = 0.01283f, vel = 715f, adsFov = 48f, kick = 1.0125f, range = 600f,
                falloffA = 100f, falloffB = 0.82f, adsTime = 0.17f, tracerLen = 9f,
                muzzleUp = 0.04723f, muzzleFwd = 0.55725f, sightHeight = 0.09073f, sightFwd = 0.17125f, eyeDist = 0.16f },
            new GunDef { id = "mk14", displayName = "MK-14 지정사수소총", shortName = "MK-14", cls = GunClass.Rifle, action = ActionType.Semi, reloadType = ReloadType.Mag,
                auto = false, pellets = 1, mag = 20, clip = 0, dmg = 47f, head = 2.3f, rpm = 320f, cycle = 0f,
                reload = 2.16f, clipReload = 0f, spread = 0.022f, adsSpread = 0.0012f, move = 0.045f, bloom = 0.012f, bloomMax = 0.03f,
                recoilV = 0.0464f, recoilH = 0.0108f, vel = 860f, adsFov = 44f, kick = 1.4175f, range = 900f,
                falloffA = 220f, falloffB = 0.85f, adsTime = 0.2f, tracerLen = 10f,
                muzzleUp = 0.05476f, muzzleFwd = 0.7765f, sightHeight = 0.1325f, sightFwd = -0.075f, eyeDist = 0.16f },
            new GunDef { id = "kr98", displayName = "KR-98 저격소총", shortName = "KR-98", cls = GunClass.Rifle, action = ActionType.Bolt, reloadType = ReloadType.Shell,
                auto = false, pellets = 1, mag = 5, clip = 5, dmg = 85f, head = 2.5f, rpm = 55f, cycle = 0.95f,
                reload = 0.496f, clipReload = 1.55f, spread = 0.06f, adsSpread = 0.0004f, move = 0.06f, bloom = 0f, bloomMax = 0f,
                recoilV = 0.0725f, recoilH = 0.0135f, vel = 920f, adsFov = 42f, kick = 2.16f, range = 1100f,
                falloffA = 350f, falloffB = 0.9f, adsTime = 0.24f, tracerLen = 12f,
                muzzleUp = 0.06164f, muzzleFwd = 0.766f, sightHeight = 0.0867f, sightFwd = -0.04757f, eyeDist = 0.16f },
            new GunDef { id = "s12", displayName = "S-12 펌프 샷건", shortName = "S-12", cls = GunClass.Shotgun, action = ActionType.Pump, reloadType = ReloadType.Shell,
                auto = false, pellets = 9, mag = 6, clip = 0, dmg = 15f, head = 1.5f, rpm = 72f, cycle = 0f,
                reload = 0.44f, clipReload = 0f, spread = 0.068f, adsSpread = 0.05f, move = 0.02f, bloom = 0f, bloomMax = 0f,
                recoilV = 0.09425f, recoilH = 0.0243f, vel = 420f, adsFov = 62f, kick = 2.295f, range = 130f,
                falloffA = 6f, falloffB = 30f, adsTime = 0.17f, tracerLen = 4f,
                muzzleUp = 0.07243f, muzzleFwd = 0.79298f, sightHeight = 0.09843f, sightFwd = 0.08798f, eyeDist = 0.2f },
            new GunDef { id = "m1014", displayName = "M-1014 반자동 샷건", shortName = "M-1014", cls = GunClass.Shotgun, action = ActionType.Semi, reloadType = ReloadType.Shell,
                auto = false, pellets = 9, mag = 7, clip = 0, dmg = 13f, head = 1.5f, rpm = 220f, cycle = 0f,
                reload = 0.4f, clipReload = 0f, spread = 0.074f, adsSpread = 0.055f, move = 0.02f, bloom = 0.01f, bloomMax = 0.02f,
                recoilV = 0.07975f, recoilH = 0.0216f, vel = 420f, adsFov = 62f, kick = 1.89f, range = 120f,
                falloffA = 6f, falloffB = 28f, adsTime = 0.17f, tracerLen = 4f,
                muzzleUp = 0.02936f, muzzleFwd = 0.6206f, sightHeight = 0.07692f, sightFwd = -0.075f, eyeDist = 0.2f },
            new GunDef { id = "db2", displayName = "DB-2 더블배럴", shortName = "DB-2", cls = GunClass.Shotgun, action = ActionType.Break, reloadType = ReloadType.Break,
                auto = false, pellets = 9, mag = 2, clip = 0, dmg = 17f, head = 1.5f, rpm = 400f, cycle = 0f,
                reload = 0.4f, clipReload = 0f, spread = 0.062f, adsSpread = 0.048f, move = 0.02f, bloom = 0f, bloomMax = 0f,
                recoilV = 0.10875f, recoilH = 0.027f, vel = 430f, adsFov = 62f, kick = 2.565f, range = 130f,
                falloffA = 7f, falloffB = 30f, adsTime = 0.17f, tracerLen = 4f,
                muzzleUp = 0.08342f, muzzleFwd = 0.48324f, sightHeight = 0.11647f, sightFwd = -0.075f, eyeDist = 0.2f },
            new GunDef { id = "sa12", displayName = "SA-12 탄창식 샷건", shortName = "SA-12", cls = GunClass.Shotgun, action = ActionType.Semi, reloadType = ReloadType.Mag,
                auto = false, pellets = 9, mag = 8, clip = 0, dmg = 13f, head = 1.5f, rpm = 230f, cycle = 0f,
                reload = 2.08f, clipReload = 0f, spread = 0.07f, adsSpread = 0.052f, move = 0.022f, bloom = 0.012f, bloomMax = 0.025f,
                recoilV = 0.0841f, recoilH = 0.02295f, vel = 420f, adsFov = 60f, kick = 1.9575f, range = 125f,
                falloffA = 6f, falloffB = 28f, adsTime = 0.17f, tracerLen = 4f,
                muzzleUp = 0.05807f, muzzleFwd = 0.6566f, sightHeight = 0.16345f, sightFwd = -0.075f, eyeDist = 0.2f },
            new GunDef { id = "aa12", displayName = "AA-12 자동 샷건", shortName = "AA-12", cls = GunClass.Shotgun, action = ActionType.Auto, reloadType = ReloadType.Mag,
                auto = true, pellets = 8, mag = 12, clip = 0, dmg = 11f, head = 1.4f, rpm = 300f, cycle = 0f,
                reload = 2.4f, clipReload = 0f, spread = 0.08f, adsSpread = 0.06f, move = 0.025f, bloom = 0.012f, bloomMax = 0.03f,
                recoilV = 0.06525f, recoilH = 0.02025f, vel = 400f, adsFov = 60f, kick = 1.62f, range = 110f,
                falloffA = 5f, falloffB = 26f, adsTime = 0.17f, tracerLen = 4f,
                muzzleUp = 0.05533f, muzzleFwd = 0.6126f, sightHeight = 0.1843f, sightFwd = -0.075f, eyeDist = 0.2f },
            new GunDef { id = "g18", displayName = "G-18 자동권총", shortName = "G-18", cls = GunClass.Pistol, action = ActionType.Auto, reloadType = ReloadType.Mag,
                auto = true, pellets = 1, mag = 20, clip = 0, dmg = 18f, head = 1.9f, rpm = 1100f, cycle = 0f,
                reload = 1.28f, clipReload = 0f, spread = 0.022f, adsSpread = 0.008f, move = 0.022f, bloom = 0.006f, bloomMax = 0.04f,
                recoilV = 0.0232f, recoilH = 0.01485f, vel = 370f, adsFov = 64f, kick = 0.675f, range = 250f,
                falloffA = 25f, falloffB = 0.65f, adsTime = 0.17f, tracerLen = 5f,
                muzzleUp = 0.0445f, muzzleFwd = 0.159f, sightHeight = 0.0625f, sightFwd = -0.0215f, eyeDist = 0.42f },
            new GunDef { id = "m1911", displayName = "M-1911 권총", shortName = "M-1911", cls = GunClass.Pistol, action = ActionType.Semi, reloadType = ReloadType.Mag,
                auto = false, pellets = 1, mag = 8, clip = 0, dmg = 32f, head = 2f, rpm = 380f, cycle = 0f,
                reload = 1.2f, clipReload = 0f, spread = 0.016f, adsSpread = 0.0045f, move = 0.022f, bloom = 0.014f, bloomMax = 0.035f,
                recoilV = 0.0522f, recoilH = 0.0135f, vel = 270f, adsFov = 64f, kick = 1.35f, range = 280f,
                falloffA = 30f, falloffB = 0.7f, adsTime = 0.17f, tracerLen = 5f,
                muzzleUp = 0.02763f, muzzleFwd = 0.09037f, sightHeight = 0.04127f, sightFwd = -0.08417f, eyeDist = 0.42f },
            new GunDef { id = "de7", displayName = "DE-7 대형권총", shortName = "DE-7", cls = GunClass.Pistol, action = ActionType.Semi, reloadType = ReloadType.Mag,
                auto = false, pellets = 1, mag = 7, clip = 0, dmg = 48f, head = 2.1f, rpm = 240f, cycle = 0f,
                reload = 1.44f, clipReload = 0f, spread = 0.02f, adsSpread = 0.005f, move = 0.025f, bloom = 0.02f, bloomMax = 0.04f,
                recoilV = 0.087f, recoilH = 0.0189f, vel = 450f, adsFov = 62f, kick = 2.025f, range = 350f,
                falloffA = 45f, falloffB = 0.75f, adsTime = 0.17f, tracerLen = 6f,
                muzzleUp = 0.0283f, muzzleFwd = 0.11006f, sightHeight = 0.04291f, sightFwd = -0.08999f, eyeDist = 0.42f },
            new GunDef { id = "r45", displayName = "R-45 리볼버", shortName = "R-45", cls = GunClass.Pistol, action = ActionType.Semi, reloadType = ReloadType.Revolver,
                auto = false, pellets = 1, mag = 6, clip = 0, dmg = 55f, head = 2.1f, rpm = 170f, cycle = 0f,
                reload = 2.4f, clipReload = 0f, spread = 0.017f, adsSpread = 0.0045f, move = 0.024f, bloom = 0.02f, bloomMax = 0.04f,
                recoilV = 0.09425f, recoilH = 0.02025f, vel = 440f, adsFov = 62f, kick = 2.16f, range = 350f,
                falloffA = 45f, falloffB = 0.75f, adsTime = 0.17f, tracerLen = 6f,
                muzzleUp = 0.0441f, muzzleFwd = 0.18912f, sightHeight = 0.04594f, sightFwd = -0.02512f, eyeDist = 0.42f },
        };

        public static GunDef Find(string id)
        {
            foreach (var g in All) if (g.id == id) return g;
            return null;
        }
    }
}
