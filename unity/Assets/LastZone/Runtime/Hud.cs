using UnityEngine;

namespace LastZone
{
    // 시제품용 화면 표시 (IMGUI): 조준선 · 탄약 · 맞힘 표시 · 명중률 · 도움말(F1) · FPS
    public class Hud : MonoBehaviour
    {
        public static Hud I;
        public WeaponController weapons;
        public PlayerController player;

        float hitT, helpT = 10f, fpsAcc, fpsN, fps;
        bool hitHead, hitKill;
        string lastHit = "";
        GUIStyle big, small, mid, shadowStyle;
        Texture2D white;

        void Awake() { I = this; }

        public void OnHit(float dmg, bool head, bool kill, float dist)
        {
            hitT = 0.18f; hitHead = head; hitKill = kill;
            lastHit = $"{Mathf.RoundToInt(dmg)}{(head ? "  헤드샷" : "")}{(kill ? "  쓰러뜨림" : "")}   {dist:0} m";
        }

        void Update()
        {
            hitT -= Time.deltaTime;
            helpT -= Time.deltaTime;
            if (LZInput.Down(K.F1)) helpT = helpT > 0f ? 0f : 9999f;
            fpsAcc += Time.unscaledDeltaTime; fpsN++;
            if (fpsAcc > 0.5f) { fps = fpsN / fpsAcc; fpsAcc = 0f; fpsN = 0f; }
        }

        void Styles()
        {
            if (big != null) return;
            white = Texture2D.whiteTexture;
            big = new GUIStyle(GUI.skin.label) { fontSize = 34, fontStyle = FontStyle.Bold, alignment = TextAnchor.LowerRight };
            mid = new GUIStyle(GUI.skin.label) { fontSize = 18, alignment = TextAnchor.LowerRight };
            small = new GUIStyle(GUI.skin.label) { fontSize = 14, alignment = TextAnchor.UpperLeft };
            shadowStyle = new GUIStyle(GUI.skin.box) { fontSize = 14, alignment = TextAnchor.UpperLeft, wordWrap = true };
            big.normal.textColor = mid.normal.textColor = small.normal.textColor = Color.white;
        }

        void Rect(float x, float y, float w, float h, Color c)
        {
            var old = GUI.color; GUI.color = c;
            GUI.DrawTexture(new Rect(x, y, w, h), white);
            GUI.color = old;
        }

        void OnGUI()
        {
            if (weapons == null || weapons.Def == null) return;
            Styles();
            float W = Screen.width, H = Screen.height, cx = W * 0.5f, cy = H * 0.5f;
            var def = weapons.Def;
            var cam = weapons.cam;

            // 조준선: 퍼짐 각도를 화면 픽셀로 (조준하면 숨긴다 — 가늠쇠가 조준점)
            float a = weapons.Ads;
            if (a < 0.6f)
            {
                float gap = Mathf.Tan(weapons.CurrentSpread) / Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad) * H * 0.5f + 4f;
                var c = new Color(1f, 1f, 1f, 0.9f * (1f - a / 0.6f));
                float L = 9f, t = 2f;
                Rect(cx - gap - L, cy - t / 2, L, t, c); Rect(cx + gap, cy - t / 2, L, t, c);
                Rect(cx - t / 2, cy - gap - L, t, L, c); Rect(cx - t / 2, cy + gap, t, L, c);
            }
            if (weapons.centerDot) Rect(cx - 1.5f, cy - 1.5f, 3f, 3f, new Color(0f, 1f, 1f, 1f));   // F3: 진짜 화면 가운데 (총알이 가는 곳)

            // 맞힘 표시
            if (hitT > 0f)
            {
                var hc = hitKill ? new Color(1f, 0.25f, 0.2f) : hitHead ? new Color(1f, 0.85f, 0.2f) : Color.white;
                float o = 7f, l = 8f;
                var m = GUI.matrix;
                for (int i = 0; i < 4; i++)
                {
                    GUIUtility.RotateAroundPivot(45f + 90f * i, new Vector2(cx, cy));
                    Rect(cx + o, cy - 1f, l, 2f, hc);
                    GUI.matrix = m;
                }
            }
            if (lastHit.Length > 0) GUI.Label(new Rect(cx + 24f, cy + 14f, 400f, 24f), lastHit, small);

            // 탄약 · 총 이름 · 사격 방식
            string ammo = weapons.Reloading ? "장전 중" : $"{weapons.Mag} / ∞";
            GUI.Label(new Rect(W - 420f, H - 92f, 400f, 50f), ammo, big);
            string mode = def.auto ? (weapons.FullAuto ? "연사" : "단발") : def.action == ActionType.Bolt ? "볼트" : def.action == ActionType.Pump ? "펌프" : "단발";
            GUI.Label(new Rect(W - 420f, H - 40f, 400f, 28f), $"{def.displayName}  ·  {mode}", mid);

            // 왼쪽 위: FPS · 명중률 · 영점 조정
            var b = Ballistics.I;
            string acc = b != null && b.shots > 0 ? $"명중 {b.hits}/{b.shots} ({100f * b.hits / b.shots:0}%)" : "";
            GUI.Label(new Rect(12f, 10f, 600f, 22f), $"FPS {fps:0}   {acc}", small);
            if (weapons.zeroMode)
                GUI.Label(new Rect(12f, 32f, 800f, 22f), $"영점 조정 (F2): 조준한 채 ↑↓ 로 조준선 높이 0.5 mm 씩 — {def.shortName} sightHeight = {def.sightHeight:0.0000} m", small);
            if (Cursor.lockState != CursorLockMode.Locked)
                GUI.Label(new Rect(cx - 150f, cy + 60f, 300f, 24f), "클릭하면 다시 조작합니다", small);

            // 도움말
            if (helpT > 0f)
            {
                GUI.Box(new Rect(12f, 60f, 330f, 250f),
                    "LAST ZONE 유니티 시제품\n\n" +
                    "WASD 이동 · Shift 달리기 · Ctrl/C 앉기 · Space 점프\n" +
                    "좌클릭 사격 · 우클릭 조준 · R 장전\n" +
                    "1 소총 · 2 산탄총 · 3 권총 · 휠 바꾸기\n" +
                    "T 같은 종류 다음 총 · B 연사/단발\n" +
                    "F2 영점 조정 · F3 화면 가운데 점\n" +
                    "Esc 마우스 풀기 · F1 이 도움말", shadowStyle);
            }
        }
    }
}
