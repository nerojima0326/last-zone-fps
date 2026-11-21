using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 화면 (웹판 ui.js · index.html): 메뉴 · 매치 설정 · 설정/키 · 전적 · 조작법 · HUD · 지도 · 부착물 · 일시정지 · 결과 (IMGUI)
    public class GameHud : MonoBehaviour
    {
        public GameView game;
        public Texture2D mapTex;
        public static bool overlayOpen;
        string panel = "";            // "", settings, keys, stats, help
        bool mapOpen, invOpen, pause;
        string waitKey;
        GUIStyle title, big, mid, small, box, btn, btnOn, center, right, shadow;
        Texture2D white, dark, panelTex, accent;
        float fps = 60, fpsT;
        static readonly Color ACC = new Color(1f, 0.82f, 0.25f), RED = new Color(1f, 0.35f, 0.3f), OK = new Color(0.49f, 0.88f, 0.51f);

        void Styles()
        {
            if (title != null) return;
            white = Tex(Color.white); dark = Tex(new Color(0, 0, 0, 0.55f)); panelTex = Tex(new Color(0.06f, 0.07f, 0.06f, 0.86f)); accent = Tex(ACC);
            title = new GUIStyle(GUI.skin.label) { fontSize = 64, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleLeft, richText = true };
            big = new GUIStyle(GUI.skin.label) { fontSize = 28, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter, richText = true };
            mid = new GUIStyle(GUI.skin.label) { fontSize = 18, richText = true, alignment = TextAnchor.MiddleLeft };
            small = new GUIStyle(GUI.skin.label) { fontSize = 14, richText = true, alignment = TextAnchor.MiddleLeft };
            center = new GUIStyle(small) { alignment = TextAnchor.MiddleCenter, fontSize = 16 };
            right = new GUIStyle(small) { alignment = TextAnchor.MiddleRight };
            shadow = new GUIStyle(small);
            box = new GUIStyle(GUI.skin.box); box.normal.background = panelTex;
            btn = new GUIStyle(GUI.skin.button) { fontSize = 16, fontStyle = FontStyle.Bold, richText = true };
            btn.normal.background = Tex(new Color(0.16f, 0.18f, 0.15f, 0.95f)); btn.hover.background = Tex(new Color(0.26f, 0.29f, 0.22f, 1)); btn.active.background = Tex(new Color(0.35f, 0.38f, 0.28f, 1));
            btn.normal.textColor = btn.hover.textColor = btn.active.textColor = new Color(0.93f, 0.92f, 0.86f);
            btnOn = new GUIStyle(btn); btnOn.normal.background = Tex(new Color(0.55f, 0.47f, 0.18f, 1)); btnOn.normal.textColor = Color.white;
        }
        static Texture2D Tex(Color c) { var t = new Texture2D(1, 1); t.SetPixel(0, 0, c); t.Apply(); return t; }
        static string Strip(string s) => s?.Replace("<size=85%>", "").Replace("<size=80%>", "").Replace("</size>", "");

        void Update()
        {
            fpsT += Time.unscaledDeltaTime; fps = Mathf.Lerp(fps, 1f / Mathf.Max(0.001f, Time.unscaledDeltaTime), 0.05f);
            Graphics2.AutoTick(Time.unscaledDeltaTime);
            if (Match.state == "playing")
            {
                if (GameInput.RawHit("Escape"))
                {
                    if (mapOpen || invOpen) { mapOpen = invOpen = false; PlayerController.LockCursor(true); }
                    else if (panel != "") panel = "";
                    else { pause = !pause; game.paused = pause; PlayerController.LockCursor(!pause); }
                }
                if (!pause && GameInput.RawHit(GameInput.Code("map"))) { mapOpen = !mapOpen; }
                if (!pause && GameInput.RawHit(GameInput.Code("inventory")) && PlayerCtl.a != null && PlayerCtl.a.alive) { invOpen = !invOpen; PlayerController.LockCursor(!invOpen); }
            }
            else { mapOpen = invOpen = false; pause = false; }
            if (Match.state == "ended" && Match.spectating && GameInput.RawHit("Escape")) Match.StopSpectate();
            overlayOpen = invOpen || pause || panel != "";
            if (waitKey != null) { var k = GameInput.AnyKeyCode(); if (k != null && k != "Escape") { GameInput.binds[waitKey] = k; GameInput.Save(); waitKey = null; } else if (k == "Escape") waitKey = null; }
        }

        void OnGUI()
        {
            Styles();
            float s = Mathf.Max(0.75f, Screen.height / 900f);
            GUI.matrix = Matrix4x4.TRS(Vector3.zero, Quaternion.identity, new Vector3(s, s, 1));
            float W = Screen.width / s, H = Screen.height / s;
            if (Match.state == "menu") { Menu(W, H); if (panel != "") Panel(W, H); return; }
            if (Match.state == "ended" && !Match.spectating) { Results(W, H); return; }
            Hud(W, H);
            if (mapOpen) MapView(W, H);
            if (invOpen) Inventory(W, H);
            if (pause) { Pause(W, H); if (panel != "") Panel(W, H); }
            if (Settings.showFps) GUI.Label(new Rect(8, 4, 200, 20), $"<color=#cfe>FPS {Mathf.RoundToInt(fps)}</color>", small);
        }

        /* ---------------- 메뉴 ---------------- */
        void Menu(float W, float H)
        {
            GUI.DrawTexture(new Rect(0, 0, 520, H), panelTex);
            GUI.Label(new Rect(40, 40, 460, 80), "<color=#ffd23f>LAST</color> ZONE", title);
            GUI.Label(new Rect(44, 112, 460, 24), "<color=#bbb>배틀로얄 FPS · Unity</color>", small);
            float y = 160;
            GUI.Label(new Rect(40, y, 120, 26), "닉네임", mid);
            Settings.name = GUI.TextField(new Rect(160, y, 300, 26), Settings.name, 16); y += 40;
            Row(ref y, "모드", new[] { "solo", "duo", "trio", "squad" }, new[] { "솔로", "듀오", "트리오", "스쿼드" }, ref Settings.mode);
            var pl = Settings.players.ToString(); Row(ref y, "인원", new[] { "24", "40", "60" }, new[] { "24", "40", "60" }, ref pl); Settings.players = int.Parse(pl);
            Row(ref y, "난이도", new[] { "easy", "normal", "hard" }, new[] { "쉬움", "보통", "어려움" }, ref Settings.diff);
            Row(ref y, "시작 무기", new[] { "all", "rifle", "shotgun", "pistol", "none" }, new[] { "전부", "소총", "산탄", "권총", "없음" }, ref Settings.loadout);
            Row(ref y, "시간대", new[] { "day", "sunset", "night", "fog", "rain", "random" }, new[] { "낮", "노을", "밤", "안개", "비", "무작위" }, ref Settings.tod);
            Row(ref y, "그래픽", Settings.Qualities, Settings.QualityNames, ref Settings.quality);
            y += 16;
            if (GUI.Button(new Rect(40, y, 440, 54), "<size=22>게임 시작</size>", btnOn)) { Settings.Save(); Settings.Apply(); game.StartMatch(Settings.Options(false)); Graphics2.TimeOfDay(Settings.tod); }
            y += 62;
            if (GUI.Button(new Rect(40, y, 215, 42), "훈련장", btn)) { Settings.Save(); Settings.Apply(); game.StartMatch(Settings.Options(true)); Graphics2.TimeOfDay("day"); }
            if (GUI.Button(new Rect(265, y, 215, 42), "전적 · 업적", btn)) panel = "stats";
            y += 50;
            if (GUI.Button(new Rect(40, y, 140, 38), "설정", btn)) panel = "settings";
            if (GUI.Button(new Rect(190, y, 140, 38), "조작법", btn)) panel = "help";
            if (GUI.Button(new Rect(340, y, 140, 38), "종료", btn)) Application.Quit();
        }
        void Row(ref float y, string label, string[] vals, string[] names, ref string cur)
        {
            GUI.Label(new Rect(40, y, 120, 30), label, mid);
            float x = 160, w = (300 - (vals.Length - 1) * 4) / (float)vals.Length;
            for (int i = 0; i < vals.Length; i++)
            {
                if (GUI.Button(new Rect(x, y, w, 30), names[i], cur == vals[i] ? btnOn : btn)) cur = vals[i];
                x += w + 4;
            }
            y += 38;
        }

        void Panel(float W, float H)
        {
            var r = new Rect(W / 2 - 330, H / 2 - 300, 660, 600);
            GUI.Box(r, "", box);
            GUILayout.BeginArea(new Rect(r.x + 20, r.y + 14, r.width - 40, r.height - 28));
            if (panel == "settings")
            {
                GUILayout.Label("<size=24><b>설정</b></size>", mid);
                Slider("감도", ref Settings.sens, 0.2f, 3); Slider("조준 감도", ref Settings.adsSens, 0.3f, 1.5f); Slider("배율 감도", ref Settings.scopeSens, 0.3f, 1.5f);
                Slider("시야각", ref Settings.fov, 70, 100); Slider("전체 음량", ref Settings.volMaster, 0, 1.5f); Slider("총소리", ref Settings.volWeapons, 0, 1.5f); Slider("환경음", ref Settings.volAmbient, 0, 1.5f);
                Settings.invertY = GUILayout.Toggle(Settings.invertY, " 마우스 상하 반전");
                Settings.showFps = GUILayout.Toggle(Settings.showFps, " FPS 표시");
                GUILayout.BeginHorizontal(); GUILayout.Label("목표 FPS", mid, GUILayout.Width(120));
                foreach (var f in new[] { 60, 120, 144, 240 }) if (GUILayout.Button(f.ToString(), Settings.fpsTarget == f ? btnOn : btn)) Settings.fpsTarget = f;
                GUILayout.EndHorizontal();
                GUILayout.Space(8);
                if (GUILayout.Button("키 바꾸기", btn)) panel = "keys";
                GUILayout.FlexibleSpace();
                if (GUILayout.Button("저장하고 닫기", btnOn, GUILayout.Height(40))) { Settings.Save(); Settings.Apply(); panel = ""; }
            }
            else if (panel == "keys")
            {
                GUILayout.Label("<size=24><b>키 바꾸기</b></size>  <size=14>(버튼을 누른 뒤 원하는 키 · Esc 취소)</size>", mid);
                scroll = GUILayout.BeginScrollView(scroll);
                foreach (var kv in GameInput.actionNames)
                {
                    GUILayout.BeginHorizontal();
                    GUILayout.Label(kv.Value, mid, GUILayout.Width(260));
                    if (GUILayout.Button(waitKey == kv.Key ? "키를 누르세요…" : GameInput.Label(kv.Key), waitKey == kv.Key ? btnOn : btn, GUILayout.Width(220))) waitKey = kv.Key;
                    GUILayout.EndHorizontal();
                }
                GUILayout.EndScrollView();
                GUILayout.BeginHorizontal();
                if (GUILayout.Button("기본값", btn, GUILayout.Height(36))) { foreach (var kv in GameInput.defaults) GameInput.binds[kv.Key] = kv.Value; GameInput.Save(); }
                if (GUILayout.Button("닫기", btnOn, GUILayout.Height(36))) panel = "settings";
                GUILayout.EndHorizontal();
            }
            else if (panel == "stats")
            {
                var d = Stats.data;
                GUILayout.Label("<size=24><b>전적 · 업적</b></size>", mid);
                string pct(int a, int b) => b > 0 ? Mathf.RoundToInt(a * 100f / b) + "%" : "-";
                GUILayout.Label($"플레이 <b>{d.matches}판</b> · 승리 <b>{d.wins}회 ({pct(d.wins, d.matches)})</b> · 3위 이내 <b>{d.top3}회</b>", mid);
                GUILayout.Label($"처치 <b>{d.kills}</b> · 판당 {(d.matches > 0 ? (d.kills / (float)d.matches).ToString("0.0") : "-")} · 한 판 최다 <b>{d.bestKills}</b> · 명중률 <b>{pct(d.hits, d.shots)}</b>", mid);
                GUILayout.Label($"헤드샷 처치 <b>{d.heads}</b> · 최장 처치 거리 <b>{Mathf.RoundToInt(d.longest)}m</b> · 총 피해량 <b>{d.dmg}</b>", mid);
                GUILayout.Space(8);
                foreach (var a in Stats.ACH) GUILayout.Label((d.ach.Contains(a[0]) ? "<color=#ffd23f>★</color> " : "<color=#666>☆</color> ") + "<b>" + a[1] + "</b>  <color=#aaa>" + a[2] + "</color>", small);
                GUILayout.FlexibleSpace();
                GUILayout.BeginHorizontal();
                if (GUILayout.Button("기록 지우기", btn, GUILayout.Height(36))) Stats.ResetAll();
                if (GUILayout.Button("닫기", btnOn, GUILayout.Height(36))) panel = "";
                GUILayout.EndHorizontal();
            }
            else if (panel == "help")
            {
                GUILayout.Label("<size=24><b>조작법</b></size>", mid);
                string L(string a) => "<b>" + GameInput.Label(a) + "</b>";
                foreach (var line in new[]
                {
                    $"{L("forward")}{L("left")}{L("back")}{L("right")} 이동 · {L("sprint")} 달리기 · {L("jump")} 점프/넘기 · {L("crouch")} 앉기 · {L("prone")} 엎드리기",
                    $"좌클릭 사격 · 우클릭 정조준 · {L("reload")} 재장전 · {L("fireMode")} 사격 모드 · {L("scope")} 조준경 교체",
                    $"{L("leanL")}/{L("leanR")} 기울이기 · {L("sprint")}(배율 조준 중) 숨 참기",
                    $"{L("slot1")}·{L("slot2")}·{L("slot3")} 소총·산탄총·권총 · {L("slot4")} 투척무기(반복: 종류) · {L("grenade")} 빠른 투척 · 휠 무기 넘기기",
                    $"투척: 누르고 있다가 떼면 던짐 · {L("reload")} 안전핀 뽑기 · 우클릭 굴리기",
                    $"{L("use")} 줍기 · 소생(길게) · 차량 · 수송기 강하 · 낙하산",
                    $"{L("heal")} 치료 · {L("map")} 지도 · {L("inventory")} 부착물 · Esc 일시정지",
                    "차량: WASD 운전 · Space 핸드브레이크(드리프트) · F 내리기"
                }) GUILayout.Label(line, mid);
                GUILayout.FlexibleSpace();
                if (GUILayout.Button("닫기", btnOn, GUILayout.Height(36))) panel = "";
            }
            GUILayout.EndArea();
        }
        Vector2 scroll;
        void Slider(string label, ref float v, float a, float b)
        {
            GUILayout.BeginHorizontal();
            GUILayout.Label(label, mid, GUILayout.Width(120));
            v = GUILayout.HorizontalSlider(v, a, b, GUILayout.Width(380));
            GUILayout.Label(v.ToString(b > 10 ? "0" : "0.00"), mid, GUILayout.Width(60));
            GUILayout.EndHorizontal();
        }

        /* ---------------- 일시정지 · 결과 ---------------- */
        void Pause(float W, float H)
        {
            GUI.DrawTexture(new Rect(0, 0, W, H), dark);
            GUI.Label(new Rect(0, H / 2 - 160, W, 50), "일시정지", big);
            float x = W / 2 - 150, y = H / 2 - 90;
            if (GUI.Button(new Rect(x, y, 300, 48), "계속하기", btnOn)) { pause = false; game.paused = false; PlayerController.LockCursor(true); }
            if (GUI.Button(new Rect(x, y + 58, 300, 44), "설정", btn)) panel = "settings";
            if (GUI.Button(new Rect(x, y + 112, 300, 44), "조작법", btn)) panel = "help";
            if (GUI.Button(new Rect(x, y + 166, 300, 44), "메뉴로 나가기", btn)) { pause = false; game.ToMenu(); }
        }
        void Results(float W, float H)
        {
            var r = Match.lastResult; var e = Stats.lastEnd;
            GUI.DrawTexture(new Rect(0, 0, W, H), dark);
            if (r == null) { if (GUI.Button(new Rect(W / 2 - 150, H / 2, 300, 48), "메뉴로", btnOn)) game.ToMenu(); return; }
            GUI.Label(new Rect(0, H / 2 - 220, W, 70), r.win ? "<color=#ffd23f><size=48>최후의 생존자!</size></color>" : $"<size=44>#{r.rank}</size> <size=24>/ {r.teams}</size>", big);
            string acc = e != null && e.shots > 0 ? Mathf.RoundToInt(e.acc * 100) + "%" : "-";
            GUI.Label(new Rect(0, H / 2 - 130, W, 30), $"처치 <b>{r.kills}</b> · 피해량 <b>{r.dmg}</b> · 생존 <b>{U.FmtTime(r.time)}</b> · 명중률 <b>{acc}</b>" + (e != null && e.longest > 0 ? $" · 최장 <b>{Mathf.RoundToInt(e.longest)}m</b>" : ""), center);
            if (e != null && e.fresh != null && e.fresh.Count > 0) GUI.Label(new Rect(0, H / 2 - 96, W, 30), "<color=#ffcf3a>업적 달성: " + string.Join(", ", e.fresh) + "</color>", center);
            if (r.canSpectate && Match.TeamsAlive() > 1 && GUI.Button(new Rect(W / 2 - 310, H / 2 - 30, 300, 48), "관전하기", btn)) { Match.StartSpectate(); PlayerController.LockCursor(true); }
            if (GUI.Button(new Rect(W / 2 + (r.canSpectate ? 10 : -150), H / 2 - 30, 300, 48), "메뉴로", btnOn)) game.ToMenu();
        }

        /* ---------------- HUD ---------------- */
        void Hud(float W, float H)
        {
            var a = Match.player; if (a == null) return;
            float now = Time.unscaledTime;
            // 섬광
            if (PlayerCtl.flashAmt > 0.01f) { GUI.color = new Color(1, 1, 1, Mathf.Clamp01(PlayerCtl.flashAmt * 1.2f)); GUI.DrawTexture(new Rect(0, 0, W, H), white); GUI.color = Color.white; }
            // 피격
            float hk = Mathf.Clamp01(GameUI.hurtAmt * (1 - (now - GameUI.hurtT) / 0.9f));
            if (hk > 0) { GUI.color = new Color(0.7f, 0, 0, hk * 0.35f); GUI.DrawTexture(new Rect(0, 0, W, H), white); GUI.color = Color.white; }
            GameUI.hurtAmt = Mathf.Max(0, GameUI.hurtAmt - Time.unscaledDeltaTime * 0.6f);
            foreach (var hd in GameUI.hurtDirs)
            {
                float k = 1 - (now - hd.t) / 1.6f; if (k <= 0) continue;
                var c = new Vector2(W / 2, H / 2); float ang = -hd.ang;
                var p = c + new Vector2(Mathf.Sin(ang), -Mathf.Cos(ang)) * 140;
                GUI.color = new Color(1, 0.2f, 0.15f, k);
                var m = GUI.matrix; GUIUtility.RotateAroundPivot(ang * Mathf.Rad2Deg, p); GUI.DrawTexture(new Rect(p.x - 40, p.y - 5, 80, 10), white); GUI.matrix = m;
                GUI.color = Color.white;
            }
            bool scoped = PlayerCtl.scopeView > 0.6f;
            if (scoped) ScopeOverlay(W, H);
            if (a.alive && a.state == "ground" && PlayerCtl.vehicle == null) Crosshair(W, H, scoped);
            // 위: 나침반 · 생존자
            Compass(W);
            GUI.Label(new Rect(W - 260, 12, 240, 26), $"<b>생존 {Match.AliveCount()}</b>  <color=#ff8a7a>처치 {a.kills}</color>", right);
            var Z = Match.zone;
            if (Z != null && Z.state != "pre" && Z.state != "done") GUI.Label(new Rect(W - 260, 36, 240, 22), (Z.state == "wait" ? "자기장 축소까지 " : "<color=#8fd0ff>자기장 축소 중</color> ") + U.FmtTime(Z.timer), right);
            else if (Z != null && Z.state == "pre") GUI.Label(new Rect(W - 260, 36, 240, 22), "안전 구역 표시까지 " + U.FmtTime(Z.timer), right);
            MiniMap(W, H);
            if (a.alive && Z != null && !Match.InZone(a.pos) && a.state == "ground") GUI.Label(new Rect(0, 90, W, 26), "<color=#8fd0ff><b>자기장 밖! 안전 구역으로 이동하세요</b></color>", center);
            // 아래 왼쪽: 체력 · 장비
            float bx = 24, by = H - 92;
            GUI.DrawTexture(new Rect(bx, by, 300, 70), dark);
            GUI.Label(new Rect(bx + 10, by + 4, 280, 22), $"<b>{a.name}</b>  " + Gear("조끼", a.vest) + Gear("헬멧", a.helmet) + Gear("가방", a.bag), small);
            float hp = a.knocked ? a.bleed : a.hp;
            GUI.DrawTexture(new Rect(bx + 10, by + 30, 280, 14), Tex2(new Color(0.15f, 0.15f, 0.15f, 0.9f)));
            GUI.DrawTexture(new Rect(bx + 10, by + 30, 280 * Mathf.Clamp01(hp / 100), 14), Tex2(a.knocked ? RED : hp < 30 ? new Color(1, 0.45f, 0.3f) : new Color(0.92f, 0.92f, 0.88f)));
            GUI.Label(new Rect(bx + 10, by + 46, 280, 20), $"{(a.knocked ? "<color=#ff6050>기절</color> " : "")}붕대 {a.bandage} · 구급상자 {a.medkit} · 투척 {a.ThrowCount()}", small);
            // 아래 오른쪽: 무기
            float wx = W - 330, wy = H - 120;
            GUI.DrawTexture(new Rect(wx, wy, 306, 98), dark);
            var inst = a.W(a.cur);
            if (inst != null)
            {
                var d = inst.Def; string am = Data.Extra[inst.id].ammo;
                GUI.Label(new Rect(wx + 10, wy + 4, 290, 44), $"<size=36><b>{inst.mag}</b></size> <size=20>/ {a.ammo[am]}</size>", mid);
                GUI.Label(new Rect(wx + 10, wy + 48, 290, 22), $"<b>{d.displayName}</b> · {(d.auto ? (PlayerCtl.fullAuto ? "연사" : "단발") : "단발")}" + (Attachments.Optic(inst, d) != null ? " · " + Data.Scopes[Attachments.Optic(inst, d)].name : ""), small);
            }
            else if (a.cur == "throw") GUI.Label(new Rect(wx + 10, wy + 10, 290, 40), $"<size=24><b>{Data.ThrowNames[PlayerCtl.throwKind]}</b></size> x{a.throwables[PlayerCtl.throwKind]}" + (PlayerCtl.throwSt != null && PlayerCtl.throwSt.pinT >= 0 ? $"  <color={(PlayerCtl.FuseLeft(PlayerCtl.throwSt) < 1.2f ? "#ff5040" : "#ffd23f")}>{PlayerCtl.FuseLeft(PlayerCtl.throwSt):0.0}s</color>" : ""), mid);
            else GUI.Label(new Rect(wx + 10, wy + 10, 290, 40), "<size=24><b>맨손</b></size>", mid);
            string slots = "";
            foreach (var (k, n) in new[] { ("rifle", "1"), ("shotgun", "2"), ("pistol", "3") }) { var w = a.W(k); slots += (a.cur == k ? "<color=#ffd23f>" : "<color=#bbb>") + n + " " + (w != null ? w.Def.shortName : "-") + "</color>   "; }
            slots += (a.cur == "throw" ? "<color=#ffd23f>" : "<color=#bbb>") + "4 투척" + "</color>";
            GUI.Label(new Rect(wx + 10, wy + 72, 296, 22), slots, small);
            // 장전 · 치료 · 소생 진행
            if (PlayerCtl.reload != null && (PlayerCtl.reload.kind == "mag" || PlayerCtl.reload.kind == "revolver")) Progress(W, H, "재장전", PlayerCtl.reload.t / PlayerCtl.reload.dur);
            if (PlayerCtl.heal != null) Progress(W, H, PlayerCtl.heal.kind == "medkit" ? "구급상자" : "붕대", PlayerCtl.heal.t / PlayerCtl.heal.dur);
            if (PlayerCtl.revive != null) Progress(W, H, "소생 중", PlayerCtl.revive.t / 5);
            // 상호작용 문구
            if (!string.IsNullOrEmpty(PlayerCtl.prompt)) { GUI.DrawTexture(new Rect(W / 2 - 230, H * 0.62f, 460, 30), dark); GUI.Label(new Rect(W / 2 - 230, H * 0.62f, 460, 30), Strip(PlayerCtl.prompt), center); }
            // 중앙 알림
            var cm = GameUI.center;
            if (cm != null && now - cm.t < cm.dur)
            {
                float al = Mathf.Clamp01((cm.dur - (now - cm.t)) * 2);
                GUI.color = new Color(1, 1, 1, al);
                GUI.Label(new Rect(0, H * 0.2f, W, 46), (cm.kind == "zone" ? "<color=#8fd0ff>" : cm.kind == "win" ? "<color=#ffd23f>" : "<color=#ffffff>") + Strip(cm.title) + "</color>", big);
                GUI.Label(new Rect(0, H * 0.2f + 46, W, 28), Strip(cm.sub), center);
                GUI.color = Color.white;
            }
            if (GameUI.killMsg.HasValue && now - GameUI.killMsg.Value.t < 2.6f)
            {
                var km = GameUI.killMsg.Value;
                GUI.Label(new Rect(0, H * 0.7f, W, 34), (km.knock ? "<color=#ffcf3a>" : "<color=#ff6a5a>") + "<size=22><b>" + km.title + "</b></size></color>", center);
                GUI.Label(new Rect(0, H * 0.7f + 30, W, 24), km.sub, center);
            }
            // 킬피드 · 줍기 · 토스트
            float fy = 70;
            foreach (var f in GameUI.feed) { if (now - f.t > 7) continue; GUI.Label(new Rect(W - 520, fy, 500, 22), f.text, right); fy += 22; }
            float py = H - 180;
            foreach (var p in GameUI.pickups) { if (now - p.t > 2.5f) continue; GUI.Label(new Rect(24, py, 400, 22), "<color=#ffd23f>+</color> " + Strip(p.text), small); py -= 22; }
            float ty = H * 0.55f;
            foreach (var t in GameUI.toasts) { if (now - t.t > 2.4f) continue; GUI.Label(new Rect(0, ty, W, 24), Strip(t.text), center); ty += 24; }
            // 피해 숫자
            var cam = game.cam;
            foreach (var n in Extras.nums) Num(cam, n.pos, n.dmg, n.head, n.kill, n.armored, n.t, null, H);
            if (Match.training) foreach (var n in Training.nums) Num(cam, n.pos, n.dmg, n.head, n.kill, false, n.t, n.text, H);
            // 상태별 안내
            if (a.state == "plane") GUI.Label(new Rect(0, H - 170, W, 28), Match.PlaneCanJump() ? $"<b>[{GameInput.Label("use")}]</b> 뛰어내리기" : "<color=#aaa>섬 위에서 뛰어내릴 수 있습니다</color>", center);
            if (a.state == "freefall" || a.state == "chute") GUI.Label(new Rect(0, H - 170, W, 28), $"고도 <b>{Mathf.RoundToInt(PlayerCtl.altitude)}m</b>" + (a.state == "freefall" ? $" · <b>[{GameInput.Label("use")}]</b> 낙하산" : ""), center);
            if (!a.alive)
            {
                var K = PlayerCtl.killcam;
                GUI.Label(new Rect(0, H - 150, W, 28), K != null ? $"<color=#ff8a7a>킬캠</color> · <b>{K.killer.name}</b> · {Data.WeaponLabel(K.weapon)} · {Mathf.RoundToInt(K.dist)}m · 남은 체력 {Mathf.RoundToInt(K.killer.hp)}" : PlayerCtl.specTarget != null ? $"관전 중: <b>{PlayerCtl.specTarget.name}</b> · 좌클릭 다음" : "", center);
            }
            if (Match.training)
            {
                var st = Training.stats; int acc = st.shots > 0 ? Mathf.RoundToInt(st.hits * 100f / st.shots) : 0;
                GUI.DrawTexture(new Rect(W / 2 - 260, 44, 520, 26), dark);
                GUI.Label(new Rect(W / 2 - 260, 44, 520, 26), $"<b>훈련장</b>  명중 <b>{st.hits}</b>/{st.shots} ({acc}%)  헤드샷 <b>{st.heads}</b>  최근 피해 <b>{Mathf.RoundToInt(st.last)}</b>  쓰러뜨림 <b>{st.downs}</b>", center);
                var K = Training.kh;
                if (K != null && K.active) GUI.Label(new Rect(W / 2 - 200, 74, 400, 30), $"<b>킬하우스</b> <size=22>{K.t:0.0}</size>  적 {K.enemies - Training.KhLeft()} / {K.enemies}" + (K.civHit > 0 ? $"  <color=#ff6050>민간인 {K.civHit}</color>" : ""), center);
            }
        }
        string Gear(string n, int lv) => lv > 0 ? $"<color=#cfc28f>{n}{lv}</color> " : "";
        readonly Dictionary<Color, Texture2D> texCache = new Dictionary<Color, Texture2D>();
        Texture2D Tex2(Color c) { if (!texCache.TryGetValue(c, out var t)) texCache[c] = t = Tex(c); return t; }
        void Progress(float W, float H, string label, float p)
        {
            GUI.DrawTexture(new Rect(W / 2 - 120, H * 0.58f, 240, 8), Tex2(new Color(0, 0, 0, 0.6f)));
            GUI.DrawTexture(new Rect(W / 2 - 120, H * 0.58f, 240 * Mathf.Clamp01(p), 8), accent);
            GUI.Label(new Rect(W / 2 - 120, H * 0.58f - 24, 240, 22), label, center);
        }
        void Num(Camera cam, Vector3 wpos, float dmg, bool head, bool kill, bool armored, float t, string text, float H)
        {
            var sp = cam.WorldToScreenPoint(Conv.U(wpos)); if (sp.z < 0.2f) return;
            float s = GUI.matrix.m00; float k = Mathf.Max(0, t) / 1.1f;
            var p = new Vector2(sp.x / s, (Screen.height - sp.y) / s - 18 - 60 * k);
            string col = text != null ? "#ffffff" : kill ? "#ff5a46" : head ? "#ffd23f" : armored ? "#7fc4ff" : "#ffffff";
            GUI.color = new Color(1, 1, 1, k < 0.7f ? 1 : 1 - (k - 0.7f) / 0.3f);
            GUI.Label(new Rect(p.x - 80, p.y - 14, 160, 28), $"<color={col}><size={(text != null ? 18 : head || kill ? 22 : 18)}><b>{text ?? Mathf.RoundToInt(dmg).ToString()}</b></size></color>", center);
            GUI.color = Color.white;
        }
        void Crosshair(float W, float H, bool scoped)
        {
            var a = Match.player; float now = Time.unscaledTime;
            var inst = a.W(a.cur);
            if (!scoped && PlayerCtl.ads < 0.6f && inst != null)
            {
                float sp = Mathf.Clamp((inst.Def.spread * (1 - PlayerCtl.ads) + PlayerCtl.bloom) * 600, 4, 60);
                var c = new Vector2(W / 2, H / 2); var col = Tex2(new Color(1, 1, 1, 0.85f));
                GUI.DrawTexture(new Rect(c.x - 1, c.y - sp - 8, 2, 8), col); GUI.DrawTexture(new Rect(c.x - 1, c.y + sp, 2, 8), col);
                GUI.DrawTexture(new Rect(c.x - sp - 8, c.y - 1, 8, 2), col); GUI.DrawTexture(new Rect(c.x + sp, c.y - 1, 8, 2), col);
                GUI.DrawTexture(new Rect(c.x - 1, c.y - 1, 2, 2), col);
            }
            if (inst != null && PlayerCtl.ads > 0.8f && !scoped)
            {
                var op = Attachments.Optic(inst, inst.Def);
                if (op == "reddot") GUI.DrawTexture(new Rect(W / 2 - 2.5f, H / 2 - 2.5f, 5, 5), Tex2(new Color(1, 0.15f, 0.1f, 0.95f)));
                else if (op == "holo") { var c = Tex2(new Color(1, 0.2f, 0.15f, 0.85f)); GUI.DrawTexture(new Rect(W / 2 - 1.5f, H / 2 - 1.5f, 3, 3), c); GUI.Box(new Rect(W / 2 - 22, H / 2 - 22, 44, 44), "", RingStyle()); }
            }
            if (a.cur == "fists" || inst == null && a.cur != "throw") GUI.DrawTexture(new Rect(W / 2 - 2, H / 2 - 2, 4, 4), Tex2(new Color(1, 1, 1, 0.8f)));
            float hk = 1 - (now - GameUI.hitT) / 0.25f;
            if (hk > 0)
            {
                var col = Tex2(GameUI.hitKill ? new Color(1, 0.25f, 0.2f, hk) : GameUI.hitHead ? new Color(1, 0.85f, 0.2f, hk) : new Color(1, 1, 1, hk));
                var c = new Vector2(W / 2, H / 2); var m = GUI.matrix;
                foreach (var ang in new[] { 45f, 135f, 225f, 315f }) { GUI.matrix = m; GUIUtility.RotateAroundPivot(ang, c); GUI.DrawTexture(new Rect(c.x + 7, c.y - 1, 9, 2), col); }
                GUI.matrix = m;
            }
        }
        GUIStyle ring;
        GUIStyle RingStyle()
        {
            if (ring != null) return ring;
            const int S = 64; var t = new Texture2D(S, S);
            for (int y = 0; y < S; y++) for (int x = 0; x < S; x++) { float d = Mathf.Sqrt((x - 31.5f) * (x - 31.5f) + (y - 31.5f) * (y - 31.5f)); t.SetPixel(x, y, new Color(1, 0.2f, 0.15f, Mathf.Clamp01(1.5f - Mathf.Abs(d - 29)) * 0.9f)); }
            t.Apply(); ring = new GUIStyle(); ring.normal.background = t; return ring;
        }
        void ScopeOverlay(float W, float H)
        {
            float r = H * 0.46f; var c = new Vector2(W / 2, H / 2);
            var black = Tex2(Color.black);
            GUI.DrawTexture(new Rect(0, 0, c.x - r, H), black); GUI.DrawTexture(new Rect(c.x + r, 0, W - c.x - r, H), black);
            if (scopeMask == null) { const int S = 256; scopeMask = new Texture2D(S, S); for (int y = 0; y < S; y++) for (int x = 0; x < S; x++) { float d = Mathf.Sqrt((x - 127.5f) * (x - 127.5f) + (y - 127.5f) * (y - 127.5f)) / 127.5f; scopeMask.SetPixel(x, y, new Color(0, 0, 0, Mathf.Clamp01((d - 0.93f) * 20))); } scopeMask.Apply(); }
            GUI.DrawTexture(new Rect(c.x - r, c.y - r, r * 2, r * 2), scopeMask);
            var line = Tex2(new Color(0, 0, 0, 0.9f));
            GUI.DrawTexture(new Rect(c.x - r, c.y - 0.75f, r * 2, 1.5f), line); GUI.DrawTexture(new Rect(c.x - 0.75f, c.y - r, 1.5f, r * 2), line);
            GUI.DrawTexture(new Rect(c.x - r, c.y - 2, r * 0.7f, 4), line); GUI.DrawTexture(new Rect(c.x + r * 0.3f, c.y - 2, r * 0.7f, 4), line); GUI.DrawTexture(new Rect(c.x - 2, c.y + r * 0.3f, 4, r * 0.7f), line);
            GUI.DrawTexture(new Rect(c.x - 1.5f, c.y - 1.5f, 3, 3), Tex2(new Color(1, 0.15f, 0.1f, 1)));
            if (PlayerCtl.breathLock) GUI.Label(new Rect(0, c.y + r * 0.5f, W, 24), "<color=#ff8a7a>숨이 찹니다</color>", center);
            else if (PlayerCtl.holding) GUI.Label(new Rect(0, c.y + r * 0.5f, W, 24), "숨 참는 중", center);
        }
        Texture2D scopeMask;
        void Compass(float W)
        {
            var a = Match.player; float yaw = (a.state == "ground" ? a.yaw : PlayerCtl.orbitYaw);
            float deg = ((-yaw * Mathf.Rad2Deg) % 360 + 360) % 360;   // 0 = 북(-z), 시계 방향
            GUI.DrawTexture(new Rect(W / 2 - 220, 10, 440, 26), dark);
            for (int d = -90; d <= 90; d += 15)
            {
                float v = ((deg + d) % 360 + 360) % 360; int vi = Mathf.RoundToInt(v / 15) * 15 % 360;
                float x = W / 2 + (d - (deg - Mathf.Round(deg / 15) * 15)) * 2.3f;
                if (x < W / 2 - 215 || x > W / 2 + 215) continue;
                string lab = vi == 0 ? "<b>N</b>" : vi == 90 ? "<b>E</b>" : vi == 180 ? "<b>S</b>" : vi == 270 ? "<b>W</b>" : vi % 45 == 0 ? vi.ToString() : "·";
                GUI.Label(new Rect(x - 20, 12, 40, 22), lab, center);
            }
            GUI.DrawTexture(new Rect(W / 2 - 1, 34, 2, 6), accent);
        }
        Vector2 MapPx(Vector3 w, Rect r) => new Vector2(r.x + (w.x + World.HALF) / World.SIZE * r.width, r.y + (w.z + World.HALF) / World.SIZE * r.height);
        void DrawMap(Rect r, bool full)
        {
            if (mapTex != null) GUI.DrawTexture(r, mapTex); else GUI.DrawTexture(r, Tex2(new Color(0.25f, 0.32f, 0.22f)));
            var Z = Match.zone;
            if (Z != null && Z.state != "pre") { Circle(r, Z.cur, new Color(0.3f, 0.7f, 1f, 0.9f)); if (Z.next != null) Circle(r, Z.next, new Color(1, 1, 1, 0.9f)); }
            if (full && MapData.Current != null) foreach (var t in MapData.Current.towns) { var p = MapPx(Conv.W(t.pos), r); GUI.Label(new Rect(p.x - 60, p.y - 10, 120, 20), "<size=12>" + t.name + "</size>", center); }
            var pl = Match.plane;
            if (pl != null && pl.visible && !pl.done)
            {
                var a = MapPx(pl.start, r); var b = MapPx(pl.start + pl.dir * pl.len, r);
                Line(a, b, new Color(1, 1, 1, 0.5f), 2); var pp = MapPx(pl.pos, r); GUI.DrawTexture(new Rect(pp.x - 4, pp.y - 4, 8, 8), Tex2(Color.white));
            }
            foreach (var d in Extras.drops) if (d.item == null || !d.item.taken) { var p = MapPx(new Vector3(d.x, 0, d.z), r); GUI.DrawTexture(new Rect(p.x - 5, p.y - 4, 10, 8), Tex2(new Color(1, 0.35f, 0.27f))); }
            foreach (var m in Match.teams.Count > 0 && Match.player != null ? Match.teams[Match.player.team].members : new List<Actor>())
            {
                if (!m.alive) continue;
                var p = MapPx(m.pos, r);
                GUI.DrawTexture(new Rect(p.x - 4, p.y - 4, 8, 8), Tex2(m.isPlayer ? ACC : Match.TeamColors[m.idx % 4]));
                if (m.isPlayer) { float yaw = m.yaw; var q = p + new Vector2(Mathf.Sin(yaw) * -12, -Mathf.Cos(yaw) * 12); Line(p, q, ACC, 2); }
            }
        }
        void Circle(Rect r, Zone.Circle c, Color col)
        {
            int n = 64; Vector2 prev = default;
            for (int i = 0; i <= n; i++)
            {
                float t = i / (float)n * Mathf.PI * 2;
                var p = MapPx(new Vector3(c.x + Mathf.Cos(t) * c.r, 0, c.z + Mathf.Sin(t) * c.r), r);
                if (i > 0) Line(prev, p, col, 2);
                prev = p;
            }
        }
        void Line(Vector2 a, Vector2 b, Color col, float w)
        {
            var m = GUI.matrix; float ang = Mathf.Atan2(b.y - a.y, b.x - a.x) * Mathf.Rad2Deg, len = (b - a).magnitude;
            GUIUtility.RotateAroundPivot(ang, a);
            GUI.DrawTexture(new Rect(a.x, a.y - w / 2, len, w), Tex2(col));
            GUI.matrix = m;
        }
        void MiniMap(float W, float H)
        {
            var a = Match.player; float S = 200;
            var r = new Rect(W - S - 20, H - S - 140, S, S);
            GUI.BeginGroup(r);
            float zoom = 6; var full = new Rect(-((a.pos.x + World.HALF) / World.SIZE * S * zoom) + S / 2, -((a.pos.z + World.HALF) / World.SIZE * S * zoom) + S / 2, S * zoom, S * zoom);
            DrawMap(full, false);
            GUI.EndGroup();
            GUI.Box(new Rect(r.x - 2, r.y - 2, S + 4, S + 4), "", Frame());
        }
        GUIStyle frame;
        GUIStyle Frame() { if (frame != null) return frame; var t = new Texture2D(8, 8); for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) t.SetPixel(x, y, x == 0 || y == 0 || x == 7 || y == 7 ? new Color(1, 1, 1, 0.5f) : Color.clear); t.Apply(); frame = new GUIStyle(); frame.normal.background = t; frame.border = new RectOffset(2, 2, 2, 2); return frame; }
        void MapView(float W, float H)
        {
            float S = Mathf.Min(W, H) - 120; var r = new Rect(W / 2 - S / 2, H / 2 - S / 2, S, S);
            GUI.DrawTexture(new Rect(0, 0, W, H), dark);
            DrawMap(r, true);
            GUI.Label(new Rect(r.x, r.yMax + 6, S, 22), $"<b>[{GameInput.Label("map")}]</b> 닫기", center);
        }

        /* ---------------- 부착물 (Tab) ---------------- */
        void Inventory(float W, float H)
        {
            var a = Match.player; if (a == null) return;
            var r = new Rect(W / 2 - 420, H / 2 - 300, 840, 600);
            GUI.Box(r, "", box);
            GUILayout.BeginArea(new Rect(r.x + 20, r.y + 14, r.width - 40, r.height - 28));
            GUILayout.Label($"<size=24><b>부착물</b></size>  <size=14>가방: 탄약 {string.Join(" · ", AmmoList(a))}</size>", mid);
            invScroll = GUILayout.BeginScrollView(invScroll);
            foreach (var slot in Data.Slots)
            {
                var w = a.W(slot); if (w == null) continue;
                var d = w.Def;
                GUILayout.Label($"<b>{d.displayName}</b>  탄창 {w.mag}/{Attachments.Capacity(w, d)}", mid);
                foreach (var kv in Attachments.Options(d))
                {
                    GUILayout.BeginHorizontal();
                    GUILayout.Label(SlotName(kv.Key), small, GUILayout.Width(80));
                    string cur = kv.Key == "optic" ? (w.iron ? "iron" : w.scope ?? Data.Extra[w.id].baseSight ?? "iron") : (w.Att(kv.Key) ?? "none");
                    foreach (var o in kv.Value)
                    {
                        string item = kv.Key == "optic" ? (o.Key != "iron" && o.Key != Data.Extra[w.id].baseSight ? "scope_" + o.Key : null) : (o.Key != "none" ? "att_" + kv.Key + "_" + o.Key : null);
                        int have = item == null ? 1 : item.StartsWith("scope_") ? a.scopes[item.Substring(6)] : (a.attachmentBag.TryGetValue(item, out var n) ? n : 0);
                        bool on = cur == o.Key;
                        GUI.enabled = on || have > 0 || Match.training;
                        if (GUILayout.Button(o.Value + (item != null && !on ? $" ({have})" : ""), on ? btnOn : btn))
                        {
                            if (Match.training && item != null && have <= 0) { if (item.StartsWith("scope_")) a.scopes[item.Substring(6)]++; else a.attachmentBag[item] = 1; }
                            if (!Attachments.Change(a, w, kv.Key, o.Key, Match.training, out var msg) && msg != null) GameUI.Toast(msg);
                            else Sfx.Click("switch", null);
                        }
                        GUI.enabled = true;
                    }
                    GUILayout.EndHorizontal();
                }
                GUILayout.Space(10);
            }
            GUILayout.EndScrollView();
            if (GUILayout.Button("닫기 (Tab)", btnOn, GUILayout.Height(36))) { invOpen = false; PlayerController.LockCursor(true); }
            GUILayout.EndArea();
        }
        Vector2 invScroll;
        static IEnumerable<string> AmmoList(Actor a) { foreach (var kv in a.ammo) if (kv.Value > 0) yield return Data.AmmoNames[kv.Key] + " " + kv.Value; }
        static string SlotName(string k) => k == "optic" ? "조준경" : k == "muzzle" ? "총구" : k == "under" ? "손잡이" : k == "magazine" ? "탄창" : k == "stock" ? "개머리판" : "측면";
    }
}
