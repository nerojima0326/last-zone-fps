using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 게임 본체: 규칙(Match·PlayerCtl·Bot …, 웹 좌표)을 매 프레임 돌리고 결과를 유니티 화면(카메라·캐릭터·전리품·차량·효과)에 옮긴다
    [DefaultExecutionOrder(-100)]
    public class GameView : MonoBehaviour
    {
        [Header("데이터")]
        public TextAsset heights, water, colliders, mapinfo;
        public MapData mapData;
        [Header("화면")]
        public Camera cam;
        public GunLibrary library;
        public GameObject charTemplate;
        public Material[] charSkins;
        public GameObject[] vehicleTemplates;      // porter · e2200 · izh 순서
        public GameObject[] throwTemplates;        // frag · smoke · molotov · flash
        public Material zoneMat, chuteMat, crateMat, lootMat, targetMat, civMat, gongMat, darkMat;
        public Light sun;
        public static GameView I;

        [System.Serializable] class InfoJ { public float[] roads; }

        readonly Dictionary<Actor, (CharacterRig rig, CharacterView view)> chars = new Dictionary<Actor, (CharacterRig, CharacterView)>();
        readonly Dictionary<LootItem, GameObject> lootViews = new Dictionary<LootItem, GameObject>();
        readonly Dictionary<Throwables.T, GameObject> throwViews = new Dictionary<Throwables.T, GameObject>();
        readonly Dictionary<Vehicle, (GameObject go, List<(Transform t, Quaternion q0, bool front)> wheels)> vehViews = new Dictionary<Vehicle, (GameObject, List<(Transform, Quaternion, bool)>)>();
        readonly Dictionary<Training.Target, (Transform root, Transform pivot)> targetViews = new Dictionary<Training.Target, (Transform, Transform)>();
        readonly Dictionary<Extras.Drop, GameObject> dropViews = new Dictionary<Extras.Drop, GameObject>();
        GameObject planeView, dropPlaneView, zoneView; Transform lootRoot, actorRoot;
        float lootT, menuT;
        public bool paused;

        void Awake()
        {
            I = this;
            World.Load(heights.bytes, water.bytes, colliders.bytes);
            if (mapData != null) { MapData.Current = mapData; Match.lootSpots.Clear(); foreach (var p in mapData.loot) Match.lootSpots.Add(Conv.W(p)); }
            if (mapinfo != null)
            {
                var info = JsonUtility.FromJson<InfoJ>(mapinfo.text);
                Vehicles.roads.Clear();
                if (info.roads != null) for (int i = 0; i + 6 <= info.roads.Length; i += 6) Vehicles.roads.Add(new[] { info.roads[i], info.roads[i + 1], info.roads[i + 2], info.roads[i + 3], info.roads[i + 4], info.roads[i + 5] });
            }
            Sfx.lib = library; CharacterRig.lib = library; CharacterRig.chuteMat = chuteMat; Graphics2.sun = sun;
            Sfx.Init(cam.transform); Fx.Init();
            Stats.Load(); GameInput.Load(); Settings.Load(); Settings.Apply();
            for (int i = 0; i < Vehicles.Kinds.Length && vehicleTemplates != null && i < vehicleTemplates.Length; i++) if (vehicleTemplates[i] != null) Vehicles.dims[Vehicles.Kinds[i]] = MeasureVehicle(vehicleTemplates[i]);
            if (throwTemplates != null) for (int i = 0; i < Data.ThrowOrder.Length && i < throwTemplates.Length; i++) ViewModel.throwTemplates[Data.ThrowOrder[i]] = throwTemplates[i];
            lootRoot = new GameObject("Loot").transform; actorRoot = new GameObject("Actors").transform;
            Match.onLootAdded = OnLootAdded; Match.onLootRemoved = OnLootRemoved; Match.onActorAdded = OnActorAdded;
            Match.onFinish = win => { PlayerController.LockCursor(false); Sfx.StopLoops(); };
            Throwables.onSpawn = OnThrowSpawn; Throwables.onRemove = t => { if (throwViews.TryGetValue(t, out var g)) { Destroy(g); throwViews.Remove(t); } };
            Vehicles.onSpawn = OnVehSpawn; Vehicles.onRemove = v => { if (vehViews.TryGetValue(v, out var g)) { Destroy(g.go); vehViews.Remove(v); } };
            Vehicles.onExplode = OnVehExplode;
            Training.onBuild = BuildTraining; Training.onClear = ClearTraining;
            zoneView = MakeZone();
        }

        /* ---------------- 시작 · 메뉴 ---------------- */
        public void StartMatch(MatchOptions o)
        {
            foreach (var kv in chars) Destroy(kv.Value.rig.gameObject);
            chars.Clear();
            Fx.ResetAll(); GameUI.Clear();
            Match.Start(o);
            paused = false;
            PlayerController.LockCursor(true);
        }
        public void ToMenu()
        {
            Match.Cleanup();
            foreach (var kv in chars) Destroy(kv.Value.rig.gameObject);
            chars.Clear();
            foreach (var kv in dropViews) Destroy(kv.Value);
            dropViews.Clear();
            Fx.ResetAll(); GameUI.Clear(); Sfx.StopLoops();
            paused = false;
            PlayerController.LockCursor(false);
        }

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            GameInput.enabled = !paused && !GameHud.overlayOpen;
            GameInput.Poll();
            if (Match.state == "playing" && !paused && Cursor.lockState != CursorLockMode.Locked && GameInput.RawHit("Escape") == false && Input2.ClickedThisFrame() && !GameHud.overlayOpen) PlayerController.LockCursor(true);
            if (Match.state == "playing" || Match.spectating)
            {
                if (!paused) Match.Update(dt);
            }
            Fx.Update(dt); Sfx.Tick(dt);
            SyncCamera(dt);
            SyncActors(dt);
            SyncLoot(dt);
            SyncThrowables();
            SyncVehicles();
            SyncPlanes();
            SyncZone();
            SyncTraining();
            SyncDrops();
        }

        void SyncCamera(float dt)
        {
            if (Match.state == "menu")
            {
                menuT += dt * 0.03f;
                var c = new Vector3(Mathf.Cos(menuT) * 520, 170, Mathf.Sin(menuT) * 520);
                cam.transform.position = Conv.U(c);
                cam.transform.rotation = Quaternion.LookRotation(Conv.U(new Vector3(0, 30, 0)) - cam.transform.position);
                cam.fieldOfView = 60;
                return;
            }
            cam.transform.position = Conv.U(PlayerCtl.camPos);
            var f = Conv.U(PlayerCtl.camQ * Vector3.forward); var u = Conv.U(PlayerCtl.camQ * Vector3.up);
            if (f.sqrMagnitude > 1e-6f) cam.transform.rotation = Quaternion.LookRotation(f, u);
            cam.fieldOfView = PlayerCtl.camFov * Settings.fovScale;
        }

        /* ---------------- 캐릭터 ---------------- */
        void OnActorAdded(Actor a)
        {
            var skin = charSkins != null && charSkins.Length > 0 ? charSkins[a.team % charSkins.Length] : null;
            var rig = CharacterRig.Create(a, charTemplate, skin);
            rig.transform.SetParent(actorRoot, true);
            var v = new CharacterView { root = rig.gameObject };
            a.model = v;
            chars[a] = (rig, v);
        }
        void SyncActors(float dt)
        {
            var camW = Conv.W(cam.transform.position);
            foreach (var kv in chars)
            {
                var a = kv.Key; var rig = kv.Value.rig;
                bool vis;
                if (a.state == "plane") vis = false;
                else
                {
                    float dx = a.pos.x - camW.x, dz = a.pos.z - camW.z, d2 = dx * dx + dz * dz, far = PlayerCtl.scopeView > 0.5f ? 620 : 380;
                    vis = d2 < (a.alive ? far * far : 160 * 160);
                    if (a.isPlayer && a.alive && (PlayerCtl.camMode == "fp" || PlayerCtl.vehicle != null)) vis = false;
                    if (a.inVehicle && a.alive) vis = false;
                }
                if (rig.gameObject.activeSelf != vis) rig.gameObject.SetActive(vis);
                if (vis) rig.Drive(dt, kv.Value.view);
            }
        }

        /* ---------------- 전리품 ---------------- */
        void OnLootAdded(LootItem it)
        {
            var g = LootModel(it.kind);
            g.transform.SetParent(lootRoot, false);
            g.transform.position = Conv.U(it.pos) + Vector3.up * 0.02f;
            g.transform.rotation = Quaternion.Euler(0, -it.rotY * Mathf.Rad2Deg, 0);
            g.SetActive(false);
            lootViews[it] = g;
        }
        void OnLootRemoved(LootItem it) { if (lootViews.TryGetValue(it, out var g)) { Destroy(g); lootViews.Remove(it); } }
        GameObject LootModel(string kind)
        {
            var gd = Data.Gun(kind);
            if (gd != null)
            {
                var e = library != null ? library.Get(kind) : null;
                var root = new GameObject("loot_" + kind);
                if (e != null && e.model != null)
                {
                    var m = Instantiate(e.model, root.transform, false);
                    foreach (var c in m.GetComponentsInChildren<Collider>()) Destroy(c);
                    m.transform.localRotation = Quaternion.Euler(0, 0, 90);   // 옆으로 눕혀 놓는다
                    m.transform.localPosition = new Vector3(0, 0.04f, 0);
                }
                else Box(root.transform, new Vector3(0, 0.05f, 0), new Vector3(0.08f, 0.08f, gd.muzzleFwd + 0.2f), darkMat);
                return root;
            }
            int ti = System.Array.IndexOf(Data.ThrowOrder, kind);
            if (ti >= 0 && throwTemplates != null && ti < throwTemplates.Length && throwTemplates[ti] != null)
            {
                var root = new GameObject("loot_" + kind); var m = Instantiate(throwTemplates[ti], root.transform, false); m.transform.localScale = Vector3.one * 1.3f;
                foreach (var c in m.GetComponentsInChildren<Collider>()) Destroy(c);
                return root;
            }
            var r = new GameObject("loot_" + kind);
            Color col = kind.StartsWith("ammo_") ? new Color(0.55f, 0.45f, 0.2f) : kind.StartsWith("scope_") || kind.StartsWith("att_") ? new Color(0.15f, 0.15f, 0.16f) : kind == "bandage" ? new Color(0.9f, 0.88f, 0.82f) : kind == "medkit" ? new Color(0.8f, 0.15f, 0.12f) : kind == "vest" ? new Color(0.3f, 0.34f, 0.24f) : kind == "helmet" ? new Color(0.3f, 0.34f, 0.24f) : kind == "bag" ? new Color(0.35f, 0.3f, 0.2f) : kind == "crate" ? new Color(0.45f, 0.12f, 0.1f) : Color.gray;
            var size = kind == "crate" ? new Vector3(0.9f, 0.6f, 0.6f) : kind == "vest" ? new Vector3(0.4f, 0.12f, 0.45f) : kind == "bag" ? new Vector3(0.35f, 0.3f, 0.2f) : kind == "helmet" ? new Vector3(0.26f, 0.16f, 0.3f) : kind.StartsWith("ammo_") ? new Vector3(0.22f, 0.12f, 0.12f) : new Vector3(0.16f, 0.08f, 0.12f);
            var b = Box(r.transform, new Vector3(0, size.y / 2, 0), size, lootMat);
            var mpb = new MaterialPropertyBlock(); mpb.SetColor("_BaseColor", col); mpb.SetColor("_Color", col); b.GetComponent<Renderer>().SetPropertyBlock(mpb);
            return r;
        }
        static GameObject Box(Transform parent, Vector3 c, Vector3 s, Material m)
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Cube); Destroy(g.GetComponent<Collider>());
            g.transform.SetParent(parent, false); g.transform.localPosition = c; g.transform.localScale = s;
            if (m != null) g.GetComponent<Renderer>().sharedMaterial = m;
            return g;
        }
        void SyncLoot(float dt)
        {
            lootT -= dt; if (lootT > 0) return;
            lootT = 0.25f;
            var c = Conv.W(cam.transform.position);
            float R = PlayerCtl.scopeView > 0.5f ? 70 : 40;
            bool low = c.y - World.HeightAt(c.x, c.z) < 60;
            foreach (var kv in lootViews)
            {
                var it = kv.Key; float dx = it.pos.x - c.x, dz = it.pos.z - c.z;
                bool v = low && dx * dx + dz * dz < R * R || it.train || it.airdrop;
                if (kv.Value.activeSelf != v) kv.Value.SetActive(v);
            }
        }

        /* ---------------- 투척물 · 차량 · 비행기 · 자기장 ---------------- */
        void OnThrowSpawn(Throwables.T t)
        {
            int i = System.Array.IndexOf(Data.ThrowOrder, t.kind);
            GameObject g = i >= 0 && throwTemplates != null && i < throwTemplates.Length && throwTemplates[i] != null ? Instantiate(throwTemplates[i]) : GameObject.CreatePrimitive(PrimitiveType.Sphere);
            foreach (var c in g.GetComponentsInChildren<Collider>()) Destroy(c);
            g.transform.localScale = i >= 0 && throwTemplates != null && i < throwTemplates.Length && throwTemplates[i] != null ? Vector3.one * 1.3f : Vector3.one * 0.08f;
            throwViews[t] = g;
        }
        void SyncThrowables()
        {
            foreach (var kv in throwViews) { kv.Value.transform.position = Conv.U(kv.Key.pos); kv.Value.transform.rotation = Quaternion.Euler(kv.Key.rot.x, -kv.Key.rot.y, -kv.Key.rot.z); }
        }

        static Vehicles.Dim MeasureVehicle(GameObject tpl)
        {
            var inst = Instantiate(tpl); inst.transform.position = Vector3.zero;
            var bounds = new Bounds(Vector3.zero, Vector3.zero); bool has = false;
            foreach (var r in inst.GetComponentsInChildren<Renderer>()) { if (!has) { bounds = r.bounds; has = true; } else bounds.Encapsulate(r.bounds); }
            var wheels = new List<Vector2>(); float wr = 0.42f;
            foreach (var t in inst.GetComponentsInChildren<Transform>())
                if (t.name.StartsWith("wheel_"))
                {
                    var rr = t.GetComponentInChildren<Renderer>(); var c = rr != null ? rr.bounds.center : t.position;
                    if (rr != null) wr = Mathf.Max(0.2f, rr.bounds.size.y / 2);
                    wheels.Add(new Vector2(-c.x, c.z));
                }
            Destroy(inst);
            float cz = 0; if (wheels.Count > 0) { float mn = float.MaxValue, mx = float.MinValue; foreach (var w in wheels) { mn = Mathf.Min(mn, w.y); mx = Mathf.Max(mx, w.y); } cz = (mn + mx) / 2; }
            for (int i = 0; i < wheels.Count; i++) wheels[i] = new Vector2(wheels[i].x, wheels[i].y - cz);
            var d = new Vehicles.Dim { hl = bounds.extents.z, hw = Mathf.Min(bounds.extents.x, 1.2f), top = bounds.size.y, r = wr, wheelPts = wheels.Count >= 4 ? wheels.ToArray() : Vehicles.Jeep.wheelPts };
            return d;
        }
        void OnVehSpawn(Vehicle v)
        {
            int i = System.Array.IndexOf(Vehicles.Kinds, v.kind);
            GameObject g;
            var wheels = new List<(Transform, Quaternion, bool)>();
            if (vehicleTemplates != null && i >= 0 && i < vehicleTemplates.Length && vehicleTemplates[i] != null)
            {
                g = new GameObject("veh_" + v.kind);
                var inner = Instantiate(vehicleTemplates[i], g.transform, false);
                foreach (var c in inner.GetComponentsInChildren<Collider>()) Destroy(c);
                // 바퀴 바닥 = 0, 앞뒤 바퀴 가운데 = 원점, 앞 = -z (웹과 같게: 모델 앞이 +z 면 돌린다)
                var bounds = new Bounds(); bool has = false;
                foreach (var r in inner.GetComponentsInChildren<Renderer>()) { if (!has) { bounds = r.bounds; has = true; } else bounds.Encapsulate(r.bounds); }
                inner.transform.localPosition = new Vector3(0, -bounds.min.y + g.transform.position.y, 0);
                foreach (var t in inner.GetComponentsInChildren<Transform>()) if (t.name.StartsWith("wheel_")) wheels.Add((t, t.localRotation, t.name.Contains("front")));
            }
            else { g = new GameObject("veh_jeep"); Box(g.transform, new Vector3(0, 0.9f, 0), new Vector3(1.85f, 1.1f, 3.8f), darkMat); }
            vehViews[v] = (g, wheels);
        }
        void OnVehExplode(Vehicle v)
        {
            if (!vehViews.TryGetValue(v, out var vv)) return;
            foreach (var r in vv.go.GetComponentsInChildren<Renderer>()) { var ms = r.sharedMaterials; for (int k = 0; k < ms.Length; k++) ms[k] = darkMat; r.sharedMaterials = ms; }
        }
        void SyncVehicles()
        {
            foreach (var kv in vehViews)
            {
                var v = kv.Key; var t = kv.Value.go.transform;
                var p = v.pos; if (v.hop.HasValue) p.y += v.hop.Value.x;
                t.position = Conv.U(p);
                var q = Vehicles.BodyRot(v);
                var f = Conv.U(q * Vector3.forward); var u = Conv.U(q * Vector3.up);
                t.rotation = Quaternion.LookRotation(f, u);
                foreach (var w in kv.Value.wheels) w.t.localRotation = Quaternion.AngleAxis(w.front ? -v.steer * 0.42f * Mathf.Rad2Deg : 0, Vector3.up) * Quaternion.AngleAxis(v.spin * Mathf.Rad2Deg, Vector3.right) * w.q0;
            }
        }

        GameObject MakePlane(string name)
        {
            var g = new GameObject(name);
            Box(g.transform, Vector3.zero, new Vector3(4.2f, 4.2f, 30), darkMat);
            Box(g.transform, new Vector3(0, 1, -1), new Vector3(40, 0.5f, 5), darkMat);
            Box(g.transform, new Vector3(0, 3, 13), new Vector3(0.5f, 6, 4), darkMat);
            Box(g.transform, new Vector3(0, 1.5f, 13), new Vector3(12, 0.4f, 3), darkMat);
            foreach (var x in new[] { -12f, -6f, 6f, 12f }) Box(g.transform, new Vector3(x, 0.2f, -2.5f), new Vector3(1.4f, 1.4f, 4), darkMat);
            return g;
        }
        void SyncPlanes()
        {
            var p = Match.plane;
            bool on = p != null && p.visible && Match.state != "menu";
            if (on && planeView == null) planeView = MakePlane("Plane");
            if (planeView != null) { planeView.SetActive(on); if (on) { planeView.transform.position = Conv.U(p.pos); planeView.transform.rotation = Quaternion.LookRotation(Conv.U(-p.dir)); } }
            var dp = Extras.plane;
            if (dp != null && dropPlaneView == null) dropPlaneView = MakePlane("DropPlane");
            if (dropPlaneView != null) { dropPlaneView.SetActive(dp != null); if (dp != null) { dropPlaneView.transform.position = Conv.U(dp.pos); dropPlaneView.transform.rotation = Quaternion.LookRotation(Conv.U(-dp.dir)); } }
        }
        GameObject MakeZone()
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Cylinder); Destroy(g.GetComponent<Collider>());
            g.name = "ZoneWall"; if (zoneMat != null) g.GetComponent<Renderer>().sharedMaterial = zoneMat;
            g.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            // 안쪽에서도 보이게: 면을 뒤집은 두 번째 원통
            var mf = g.GetComponent<MeshFilter>(); var m = Instantiate(mf.sharedMesh); var tri = m.triangles;
            for (int i = 0; i < tri.Length; i += 3) { var t = tri[i]; tri[i] = tri[i + 1]; tri[i + 1] = t; }
            var inner = new GameObject("inner"); inner.transform.SetParent(g.transform, false);
            inner.AddComponent<MeshFilter>().sharedMesh = m; var mr = inner.AddComponent<MeshRenderer>(); mr.sharedMaterial = zoneMat; mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            m.triangles = tri;
            g.SetActive(false);
            return g;
        }
        void SyncZone()
        {
            var Z = Match.zone;
            bool on = Z != null && Z.state != "pre" && Match.state != "menu";
            zoneView.SetActive(on);
            if (!on) return;
            zoneView.transform.position = Conv.U(new Vector3(Z.cur.x, 150, Z.cur.z));
            float r = Mathf.Max(0.5f, Z.cur.r);
            zoneView.transform.localScale = new Vector3(r * 2, 350, r * 2);
        }

        /* ---------------- 훈련 기지 · 보급 ---------------- */
        void BuildTraining()
        {
            foreach (var t in Training.targets)
            {
                var root = new GameObject("target").transform;
                var pivot = new GameObject("pivot").transform; pivot.SetParent(root, false);
                if (t.kind == "sil")
                {
                    Box(root, new Vector3(0, 0.03f, 0), new Vector3(0.7f, 0.06f, 0.4f), darkMat);
                    var q = GameObject.CreatePrimitive(PrimitiveType.Quad); Destroy(q.GetComponent<Collider>());
                    q.transform.SetParent(pivot, false); q.transform.localPosition = new Vector3(0, 0.9f, 0); q.transform.localScale = new Vector3(0.6f, 1.8f, 1);
                    q.GetComponent<Renderer>().sharedMaterial = t.civ ? civMat : targetMat;
                    var q2 = Instantiate(q, pivot); q2.transform.localRotation = Quaternion.Euler(0, 180, 0);
                    if (t.cart) Box(root, new Vector3(0, 0.12f, 0), new Vector3(0.9f, 0.18f, 0.5f), darkMat);
                }
                else
                {
                    Box(root, new Vector3(0.5f, 0.85f, 0), new Vector3(0.06f, 1.7f, 0.06f), darkMat);
                    Box(root, new Vector3(-0.5f, 0.85f, 0), new Vector3(0.06f, 1.7f, 0.06f), darkMat);
                    Box(root, new Vector3(0, 1.7f, 0), new Vector3(1.06f, 0.06f, 0.06f), darkMat);
                    var disc = GameObject.CreatePrimitive(PrimitiveType.Cylinder); Destroy(disc.GetComponent<Collider>());
                    disc.transform.SetParent(pivot, false); disc.transform.localPosition = new Vector3(0, t.cy, 0); disc.transform.localRotation = Quaternion.Euler(90, 0, 0);
                    disc.transform.localScale = new Vector3(t.r * 2, 0.0125f, t.r * 2); disc.GetComponent<Renderer>().sharedMaterial = gongMat;
                }
                targetViews[t] = (root, pivot);
            }
        }
        void ClearTraining() { foreach (var kv in targetViews) Destroy(kv.Value.root.gameObject); targetViews.Clear(); }
        void SyncTraining()
        {
            foreach (var kv in targetViews)
            {
                var t = kv.Key; var (root, pivot) = kv.Value;
                root.position = Conv.U(t.root);
                var q = Vehicles.Rot(0, t.yaw, 0); root.rotation = Quaternion.LookRotation(Conv.U(q * Vector3.forward), Vector3.up);
                pivot.localPosition = new Vector3(0, t.pivotY, 0);
                float ang = t.kind == "sil" ? -Mathf.PI / 2 * (1 - (1 - t.fall) * (1 - t.fall)) : -t.swing * 0.35f;
                pivot.localRotation = Quaternion.AngleAxis(ang * Mathf.Rad2Deg, Vector3.right);
            }
        }
        void SyncDrops()
        {
            foreach (var d in Extras.drops)
            {
                if (!dropViews.TryGetValue(d, out var g))
                {
                    g = new GameObject("airdrop");
                    Box(g.transform, new Vector3(0, 0.475f, 0), new Vector3(1.5f, 0.95f, 1.1f), crateMat);
                    var ch = GameObject.CreatePrimitive(PrimitiveType.Sphere); Destroy(ch.GetComponent<Collider>()); ch.name = "chute";
                    ch.transform.SetParent(g.transform, false); ch.transform.localPosition = new Vector3(0, 4.6f, 0); ch.transform.localScale = new Vector3(5.2f, 2.8f, 5.2f);
                    ch.GetComponent<Renderer>().sharedMaterial = chuteMat;
                    dropViews[d] = g;
                }
                g.transform.position = Conv.U(new Vector3(d.x, d.y, d.z));
                g.transform.Find("chute").gameObject.SetActive(!d.landed);
            }
        }
    }

    // 마우스 클릭 한 번 (입력 시스템 둘 다)
    public static class Input2
    {
        public static bool ClickedThisFrame()
        {
#if ENABLE_INPUT_SYSTEM
            var m = UnityEngine.InputSystem.Mouse.current; return m != null && m.leftButton.wasPressedThisFrame;
#else
            return Input.GetMouseButtonDown(0);
#endif
        }
    }
}
