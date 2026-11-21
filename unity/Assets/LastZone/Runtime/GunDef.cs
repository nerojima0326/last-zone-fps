using UnityEngine;

namespace LastZone
{
    public enum GunClass { Rifle, Shotgun, Pistol }
    public enum ActionType { Auto, Semi, Pump, Bolt, Break }
    public enum ReloadType { Mag, Shell, Break, Revolver }

    // 총 한 종류의 수치. 각도는 라디안, 거리는 m, 속도는 m/s (웹판 js/weapons.js 와 같은 값)
    [System.Serializable]
    public class GunDef
    {
        public string id, displayName, shortName;
        public GunClass cls;
        public ActionType action;
        public ReloadType reloadType;
        public bool auto;
        public int pellets = 1, mag, clip;
        public float dmg, head = 2f, rpm, cycle;
        public float reload, clipReload;                 // 탄창 장전 시간 (산탄·볼트는 한 발당)
        public float spread, adsSpread, move;            // 지향 퍼짐 · 조준 퍼짐 · 움직일 때 더해지는 퍼짐
        public float bloom, bloomMax;                    // 연사할수록 쌓이는 퍼짐
        public float recoilV, recoilH, kick;             // 총구가 튀는 양 (위 · 좌우) · 화면 흔들림
        public float vel, range, falloffA, falloffB;     // 탄속 · 사거리 · 거리 감쇠
        public float adsFov, adsTime = 0.17f, tracerLen = 7f;
        public float muzzleUp, muzzleFwd;                // 방아쇠 기준 총구 자리
        public float sightHeight, sightFwd;              // 조준선 높이 · 가늠자 자리
        public float eyeDist;                            // 조준할 때 눈에서 가늠자까지

        public float Damage(float dist)
        {
            if (pellets > 1) return dmg * (1f - Mathf.Clamp01((dist - falloffA) / falloffB) * 0.8f);
            return dist > falloffA ? dmg * falloffB : dmg;
        }

        public string ClassName => cls == GunClass.Rifle ? "소총" : cls == GunClass.Shotgun ? "산탄총" : "권총";
    }
}
