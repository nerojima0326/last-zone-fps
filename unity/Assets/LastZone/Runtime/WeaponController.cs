using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 총 들기·조준·사격·반동·장전. 1·2·3 = 소총·산탄총·권총 칸, T = 같은 종류의 다음 총, B = 연사/단발
    // 조준(우클릭)하면 GunDef.sightHeight 선이 화면 정가운데에 온다 — 총알도 화면 가운데로 나가므로 가늠쇠 = 탄착점
    public class WeaponController : MonoBehaviour
    {
        public PlayerController player;
        public Camera cam;
        public Transform viewRoot;              // 카메라 자식: 1인칭 총이 붙는 곳
        public GunLibrary library;
        public AudioSource audioSrc;
        public Material flashMat;
        public string[] startGuns = { "sc17", "s12", "m1911" };

        class Slot
        {
            public GunDef def;
            public int mag;
            public Transform view, muzzle, flash;
            public Light flashLight;
        }

        readonly Slot[] slots = new Slot[3];
        readonly Dictionary<string, Slot> cache = new Dictionary<string, Slot>();
        int cur;
        float adsRaw, nextFire, bloom, recoilAcc, lastShot = -9f, switchT = 1f, flashT, cycleT = -1f;
        bool fullAuto = true, shot0;
        Vector3 swayRot, kickPos; float kickRot, kickRoll;
        public bool zeroMode, centerDot, aimToggle;

        // 장전 상태
        enum RS { None, Mag, ShellOpen, ShellLoad, ShellClose }
        RS rs = RS.None;
        float rsT, rsDur;
        readonly List<(float t, string cue)> rsEvents = new List<(float, string)>();
        int rsEv;
        bool rsEmpty, rsClip;
        float autoReloadAt = -1f;

        public GunDef Def => slots[cur] != null ? slots[cur].def : null;
        public int Mag => slots[cur] != null ? slots[cur].mag : 0;
        public float Ads => Ease(adsRaw);
        public bool Reloading => rs != RS.None;
        public float ReloadProgress => rs == RS.Mag && rsDur > 0f ? rsT / rsDur : 0f;
        public bool FullAuto => fullAuto;
        public float CurrentSpread { get; private set; }

        static float Ease(float x) => x * x * (3f - 2f * x);

        void Start()
        {
            for (int i = 0; i < 3; i++) slots[i] = MakeSlot(startGuns[i]);
            Select(0, true);
        }

        // ---------------- 총 모델 ----------------
        Slot MakeSlot(string id)
        {
            if (cache.TryGetValue(id, out var have)) { have.mag = have.def.mag; return have; }
            var def = GunTable.Find(id);
            if (PlayerPrefs.HasKey("lz_sight_" + id)) def.sightHeight = PlayerPrefs.GetFloat("lz_sight_" + id);
            var s = new Slot { def = def, mag = def.mag };
            var root = new GameObject("VM_" + id).transform;
            root.SetParent(viewRoot, false);
            var holder = new GameObject("Model").transform;
            holder.SetParent(root, false);
            var e = library != null ? library.Get(id) : null;
            if (e != null && e.model != null)
            {
                var inst = Instantiate(e.model, holder, false);
                foreach (var c in inst.GetComponentsInChildren<Collider>()) Destroy(c);
                AutoOrient(holder);
            }
            else BuildFallback(holder, def);
            foreach (var r in root.GetComponentsInChildren<Renderer>())
            {
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                r.receiveShadows = false;
            }
            s.muzzle = new GameObject("Muzzle").transform;
            s.muzzle.SetParent(root, false);
            s.muzzle.localPosition = new Vector3(0f, def.muzzleUp, def.muzzleFwd);
            var fl = GameObject.CreatePrimitive(PrimitiveType.Quad);
            Destroy(fl.GetComponent<Collider>());
            fl.name = "Flash";
            fl.GetComponent<Renderer>().sharedMaterial = flashMat;
            fl.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            fl.transform.SetParent(s.muzzle, false);
            fl.transform.localPosition = new Vector3(0f, 0f, 0.04f);
            fl.SetActive(false);
            s.flash = fl.transform;
            s.flashLight = new GameObject("FlashLight").AddComponent<Light>();
            s.flashLight.transform.SetParent(s.muzzle, false);
            s.flashLight.type = LightType.Point; s.flashLight.range = 7f; s.flashLight.intensity = 2.5f;
            s.flashLight.color = new Color(1f, 0.7f, 0.35f); s.flashLight.enabled = false;
            s.view = root;
            root.gameObject.SetActive(false);
            cache[id] = s;
            return s;
        }

        // .glb 를 가져올 때 축 변환 방식과 상관없이 총구가 +Z(앞)로 오게: 정점이 더 멀리 뻗은 쪽이 총구
        static void AutoOrient(Transform holder)
        {
            float minZ = float.MaxValue, maxZ = float.MinValue;
            Matrix4x4 toHolder = holder.worldToLocalMatrix;
            foreach (var mf in holder.GetComponentsInChildren<MeshFilter>())
            {
                if (mf.sharedMesh == null) continue;
                var b = mf.sharedMesh.bounds;
                Matrix4x4 m = toHolder * mf.transform.localToWorldMatrix;
                for (int i = 0; i < 8; i++)
                {
                    var p = m.MultiplyPoint3x4(new Vector3((i & 1) == 0 ? b.min.x : b.max.x, (i & 2) == 0 ? b.min.y : b.max.y, (i & 4) == 0 ? b.min.z : b.max.z));
                    minZ = Mathf.Min(minZ, p.z); maxZ = Mathf.Max(maxZ, p.z);
                }
            }
            if (minZ < float.MaxValue && -minZ > maxZ) holder.localRotation = Quaternion.Euler(0f, 180f, 0f);
        }

        // 모델이 없을 때 (glTFast 미설치 등): 같은 조준선 높이를 가진 상자 총
        void BuildFallback(Transform holder, GunDef def)
        {
            var sh = Shader.Find("Universal Render Pipeline/Lit");
            if (sh == null) sh = Shader.Find("Standard");
            var mat = new Material(sh) { color = new Color(0.12f, 0.13f, 0.14f) };
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", mat.color);
            void Box(Vector3 c, Vector3 size)
            {
                var g = GameObject.CreatePrimitive(PrimitiveType.Cube);
                Destroy(g.GetComponent<Collider>());
                g.transform.SetParent(holder, false);
                g.transform.localPosition = c; g.transform.localScale = size;
                g.GetComponent<Renderer>().sharedMaterial = mat;
            }
            float len = def.muzzleFwd, top = def.sightHeight;
            Box(new Vector3(0f, def.muzzleUp, len * 0.5f - 0.05f), new Vector3(0.035f, 0.05f, len + 0.1f));
            Box(new Vector3(0f, -0.05f, 0f), new Vector3(0.03f, 0.1f, 0.05f));
            Box(new Vector3(0f, (def.muzzleUp + top) * 0.5f, len - 0.03f), new Vector3(0.004f, top - def.muzzleUp, 0.006f));       // 가늠쇠
            Box(new Vector3(-0.007f, (def.muzzleUp + top) * 0.5f, def.sightFwd), new Vector3(0.006f, top - def.muzzleUp + 0.004f, 0.006f));   // 가늠자 왼쪽
            Box(new Vector3(0.007f, (def.muzzleUp + top) * 0.5f, def.sightFwd), new Vector3(0.006f, top - def.muzzleUp + 0.004f, 0.006f));    // 가늠자 오른쪽
        }

        void Select(int i, bool instant = false)
        {
            if (i == cur && !instant && slots[cur].view.gameObject.activeSelf) return;
            if (slots[cur] != null) slots[cur].view.gameObject.SetActive(false);
            cur = i;
            slots[cur].view.gameObject.SetActive(true);
            CancelReload();
            autoReloadAt = -1f;
            switchT = instant ? 1f : 0f;
            cycleT = -1f;
            if (!instant) Play(library != null ? library.switchClip : null, 0.6f);
        }

        void NextGunInClass()
        {
            var def = Def;
            var list = GunTable.All.FindAll(g => g.cls == def.cls);
            int k = list.IndexOf(def);
            var next = list[(k + 1) % list.Count];
            slots[cur].view.gameObject.SetActive(false);
            slots[cur] = MakeSlot(next.id);
            Select(cur);
        }

        // ---------------- 매 프레임 ----------------
        void Update()
        {
            float dt = Time.deltaTime;
            bool locked = Cursor.lockState == CursorLockMode.Locked && Time.frameCount - PlayerController.lockFrame > 3;   // 화면을 눌러 마우스를 잡는 클릭은 쏘지 않는다
            var s = slots[cur]; var def = s.def;

            if (locked)
            {
                if (LZInput.Down(K.Alpha1)) Select(0);
                else if (LZInput.Down(K.Alpha2)) Select(1);
                else if (LZInput.Down(K.Alpha3)) Select(2);
                else if (LZInput.Down(K.T)) NextGunInClass();
                float sc = LZInput.Scroll();
                if (sc > 0.01f) Select((cur + 2) % 3); else if (sc < -0.01f) Select((cur + 1) % 3);
                if (LZInput.Down(K.B) && def.auto) fullAuto = !fullAuto;
                if (LZInput.Down(K.F2)) zeroMode = !zeroMode;
                if (LZInput.Down(K.F3)) centerDot = !centerDot;
                if (LZInput.Down(K.F4)) aimToggle = !aimToggle;   // 조준 고정 (누르고 있지 않아도)
                s = slots[cur]; def = s.def;
            }

            switchT = Mathf.Min(1f, switchT + dt / 0.35f);
            bool aiming = locked && (LZInput.AimHeld() || aimToggle) && rs != RS.Mag && rs != RS.ShellOpen && !player.sprinting && switchT > 0.5f;
            adsRaw = Mathf.MoveTowards(adsRaw, aiming ? 1f : 0f, dt / def.adsTime);
            player.ads = Ads;
            player.blockSprint = locked && LZInput.FireHeld();

            // 영점 조정 모드: 조준한 채 ↑↓ 로 조준선 높이를 0.5 mm 씩 (총마다 저장)
            if (zeroMode && Ads > 0.9f)
            {
                float dh = (LZInput.Down(K.Up) ? 0.0005f : 0f) - (LZInput.Down(K.Down) ? 0.0005f : 0f);
                if (dh != 0f) { def.sightHeight += dh; PlayerPrefs.SetFloat("lz_sight_" + def.id, def.sightHeight); }
            }

            // 퍼짐 (웹판 currentSpread)
            float sp = Mathf.Lerp(def.spread, def.adsSpread, Ads) + bloom + def.move * Mathf.Min(1f, player.speed01) * (1f - 0.6f * Ads);
            if (player.crouching) sp *= 0.8f;
            if (!player.grounded) sp += 0.05f;
            CurrentSpread = sp;
            bloom = Mathf.MoveTowards(bloom, 0f, dt * 0.1f);

            // 반동 회복: 쏘다 멈추면 올라간 시선을 조금 내린다
            if (Time.time - lastShot > 0.14f && recoilAcc > 0f)
            {
                float r = Mathf.Min(recoilAcc, dt * 0.45f);
                player.pitch -= r * 0.75f; recoilAcc -= r;
            }

            // ---- 사격 ----
            if (locked && switchT >= 1f)
            {
                bool wantFire = def.auto && fullAuto ? (LZInput.FireHeld() || LZInput.FirePressed()) : LZInput.FirePressed();   // 짧게 톡 눌러도 한 발은 나가게
                if (wantFire && (rs == RS.ShellLoad || rs == RS.ShellOpen) && s.mag > 0) CancelReload(true);   // 한 발씩 넣는 중엔 쏘면 멈춘다
                if (wantFire && rs == RS.None && Time.time >= nextFire && !player.sprinting)
                {
                    if (s.mag > 0) Fire(s);
                    else if (LZInput.FirePressed()) { Play(Clip(e => e.dry), 0.7f); StartReload(); }
                }
                if (LZInput.Down(K.R)) StartReload();
            }

            UpdateReload(dt);
            UpdateCycle(dt);
            if (autoReloadAt > 0f && Time.time >= autoReloadAt) { autoReloadAt = -1f; if (rs == RS.None && slots[cur].mag == 0) StartReload(); }

            flashT -= dt;
            s.flash.gameObject.SetActive(flashT > 0f);
            s.flashLight.enabled = flashT > 0f;

            cam.fieldOfView = Mathf.Lerp(player.baseFov, def.adsFov * player.baseFov / 80f, Ads);
        }

        // ---------------- 사격 ----------------
        void Fire(Slot s)
        {
            var def = s.def;
            s.mag--;
            nextFire = Time.time + Mathf.Max(60f / def.rpm, def.action == ActionType.Bolt ? def.cycle : 0f);
            lastShot = Time.time;
            Transform ct = cam.transform;
            Vector3 f = ct.forward, u = ct.up, r = ct.right;
            // 영점: 총알은 중력으로 떨어진다 → 조준한 곳까지의 거리에서 화면 가운데에 맞도록 낙차만큼 살짝 위로
            float zd = ZeroDistance(def, ct.position, f);
            f = (f + u * (9.8f * zd / (2f * def.vel * def.vel))).normalized;
            float spread = CurrentSpread;
            for (int k = 0; k < def.pellets; k++)
            {
                float rr = spread * Mathf.Sqrt(Random.value), th = Random.value * Mathf.PI * 2f;
                Vector3 d = (f + r * (Mathf.Cos(th) * rr) + u * (Mathf.Sin(th) * rr)).normalized;
                Ballistics.I.Fire(ct.position, d, def, s.muzzle.position, def.pellets == 1 || k < 3);
            }
            Ballistics.I.shots++;
            // 반동 (웹판과 같은 값)
            float rv = def.recoilV * (Ads > 0.5f ? 0.7f : 1f) * (player.crouching ? 0.82f : 1f) * Random.Range(0.85f, 1.15f);
            player.AddRecoil(rv, def.recoilH * Random.Range(-1f, 1.25f));
            recoilAcc += rv;
            player.kickPitch += def.kick * (def.cls == GunClass.Shotgun ? 0.019f : def.cls == GunClass.Pistol ? 0.014f : 0.016f);
            bloom = Mathf.Min(def.bloomMax, bloom + def.bloom);
            float kw = 1f - 0.5f * Ads;
            kickPos.z -= 0.022f * def.kick * kw;
            kickRot += 2.2f * def.kick * kw;
            kickRoll += Random.Range(-1f, 1f) * def.kick * kw;
            flashT = 0.045f;
            flashRoll = Random.Range(0f, 360f);
            s.flash.localScale = Vector3.one * Random.Range(0.09f, 0.13f) * (def.cls == GunClass.Pistol ? 0.7f : 1f);
            shot0 = !shot0;
            Play(Clip(e => shot0 ? e.shot0 : (e.shot1 != null ? e.shot1 : e.shot0)), 0.85f);
            if (s.mag == 0) autoReloadAt = Time.time + 0.25f;   // 다 쏘면 잠깐 뒤 자동 장전
            if (def.action == ActionType.Bolt || def.action == ActionType.Pump) cycleT = s.mag > 0 || def.action == ActionType.Pump ? 0f : -1f;
        }

        float ZeroDistance(GunDef def, Vector3 o, Vector3 d)
        {
            float far = Mathf.Min(def.range, 600f);
            if (Ads < 0.5f) return Mathf.Min(50f, far);
            if (Physics.Raycast(o, d, out RaycastHit hit, far, Ballistics.I.hitMask, QueryTriggerInteraction.Ignore)) return Mathf.Max(5f, hit.distance);
            return far;
        }

        // 볼트·펌프: 쏜 뒤 손잡이를 당겼다 민다 (소리만, 동작은 총을 살짝 기울여 표현)
        void UpdateCycle(float dt)
        {
            if (cycleT < 0f) return;
            var def = Def;
            float T = def.action == ActionType.Bolt ? def.cycle : 60f / def.rpm;
            float prev = cycleT; cycleT += dt;
            float a = T * 0.3f, b = T * 0.62f;
            if (prev < a && cycleT >= a) Play(Clip(e => def.action == ActionType.Bolt ? Or(e.up, e.open) : e.open), 0.7f);
            if (prev < b && cycleT >= b) Play(Clip(e => def.action == ActionType.Bolt ? Or(e.down, e.close) : e.close), 0.7f);
            if (cycleT > T) cycleT = -1f;
        }

        // ---------------- 장전 ----------------
        void StartReload()
        {
            var s = slots[cur]; var def = s.def;
            int cap = def.mag;
            if (rs != RS.None || s.mag >= cap || switchT < 1f) return;
            rsEmpty = s.mag == 0;
            rsEvents.Clear(); rsEv = 0; rsT = 0f;
            cycleT = -1f;
            switch (def.reloadType)
            {
                case ReloadType.Mag:
                    rs = RS.Mag; rsDur = def.reload * (rsEmpty ? 1.25f : 1f);
                    rsEvents.Add((rsDur * 0.22f, "magout"));
                    rsEvents.Add((rsDur * 0.6f, "magin"));
                    if (rsEmpty) rsEvents.Add((rsDur * 0.86f, "close"));
                    break;
                case ReloadType.Revolver:
                    rs = RS.Mag; rsDur = def.reload;
                    rsEvents.Add((rsDur * 0.12f, "open"));
                    rsEvents.Add((rsDur * 0.3f, "shell"));
                    rsEvents.Add((rsDur * 0.6f, "magin"));
                    rsEvents.Add((rsDur * 0.86f, "close"));
                    break;
                case ReloadType.Break:
                    rs = RS.Mag; rsDur = 0.35f + def.reload * 2f + 0.3f;
                    rsEvents.Add((0.08f, "open"));
                    rsEvents.Add((0.35f + def.reload * 0.6f, "shell"));
                    rsEvents.Add((0.35f + def.reload * 1.6f, "shell"));
                    rsEvents.Add((rsDur - 0.12f, "close"));
                    break;
                default:   // 한 발씩 (산탄총·볼트액션). 볼트액션이 비었으면 클립으로 한 번에
                    rs = RS.ShellOpen; rsDur = 0.3f;
                    Play(Clip(e => def.action == ActionType.Bolt ? Or(e.up, e.open) : Or(e.port, e.open)), 0.7f);
                    break;
            }
        }

        void CancelReload(bool close = false)
        {
            if (close && rs != RS.None) Play(Clip(e => Def.action == ActionType.Bolt ? Or(e.down, e.close) : e.close), 0.7f);
            rs = RS.None; rsEvents.Clear();
        }

        void UpdateReload(float dt)
        {
            if (rs == RS.None) return;
            var s = slots[cur]; var def = s.def;
            rsT += dt;
            while (rsEv < rsEvents.Count && rsT >= rsEvents[rsEv].t) { PlayCue(rsEvents[rsEv].cue); rsEv++; }
            if (rsT < rsDur) return;
            switch (rs)
            {
                case RS.Mag:
                    s.mag = def.mag; rs = RS.None; break;
                case RS.ShellOpen:
                    rs = RS.ShellLoad; rsT = 0f;
                    rsClip = def.clip > 0 && s.mag == 0;   // 볼트액션이 비었으면 클립으로 한 번에
                    rsDur = rsClip ? def.clipReload : def.reload;
                    break;
                case RS.ShellLoad:
                    s.mag = rsClip ? Mathf.Min(def.mag, def.clip) : s.mag + 1;
                    rsClip = false;
                    PlayCue("shell");
                    rsT = 0f;
                    if (s.mag >= def.mag) { rs = RS.ShellClose; rsDur = 0.3f; }
                    else rsDur = def.reload;
                    break;
                case RS.ShellClose:
                    Play(Clip(e => def.action == ActionType.Bolt ? Or(e.down, e.close) : e.close), 0.7f);
                    rs = RS.None; break;
            }
        }

        // ---------------- 소리 ----------------
        AudioClip Clip(System.Func<GunLibrary.Entry, AudioClip> pick)
        {
            var e = library != null ? library.Get(Def.id) : null;
            return e != null ? pick(e) : null;
        }

        void PlayCue(string cue)
        {
            var e = library != null ? library.Get(Def.id) : null;
            if (e == null) return;
            AudioClip c = null;
            switch (cue)
            {
                case "magout": c = e.magout; break;
                case "magin": c = e.magin; break;
                case "open": c = e.open; break;
                case "close": c = e.close; break;
                case "shell": c = Or(e.shell, e.magin); break;
            }
            Play(c, 0.7f);
        }

        // 유니티 객체는 ?? 대신 이것으로 (빈 칸이 '가짜 null' 일 수 있다)
        static AudioClip Or(AudioClip a, AudioClip b) => a != null ? a : b;

        void Play(AudioClip c, float vol)
        {
            if (c != null && audioSrc != null) audioSrc.PlayOneShot(c, vol);
        }

        // ---------------- 1인칭 총 자세 ----------------
        void LateUpdate()
        {
            float dt = Time.deltaTime;
            var s = slots[cur]; var def = s.def;
            float a = Ads, w = 1f - 0.85f * a;

            // 조준: 조준선(sightHeight)이 눈 앞 eyeDist 에서 화면 정가운데 (x=0, y=0)
            Vector3 adsPos = new Vector3(0f, -def.sightHeight, def.eyeDist - def.sightFwd);
            Vector3 hipOff = def.cls == GunClass.Pistol ? new Vector3(0.11f, -0.07f, -0.06f) : new Vector3(0.12f, -0.065f, 0.06f);
            Vector3 pos = adsPos + hipOff * (1f - a);
            Quaternion rot = Quaternion.Euler(0f, -2.5f * (1f - a), 0f);

            // 시선 흔들림 (마우스 따라 늦게)
            Vector2 md = Cursor.lockState == CursorLockMode.Locked && Time.frameCount - PlayerController.lockFrame > 3 ? LZInput.MouseDelta() : Vector2.zero;
            Vector3 want = new Vector3(Mathf.Clamp(md.y * 0.04f, -4f, 4f), Mathf.Clamp(-md.x * 0.04f, -4f, 4f), Mathf.Clamp(md.x * 0.06f, -5f, 5f));
            swayRot = Vector3.Lerp(swayRot, want, 1f - Mathf.Exp(-9f * dt));
            rot *= Quaternion.Euler(swayRot * w);

            // 걸음 흔들림 · 숨
            float ph = player.stepPhase, mv = Mathf.Min(1f, player.speed01) * (player.grounded ? 1f : 0f);
            pos += new Vector3(Mathf.Sin(ph) * 0.011f, -Mathf.Abs(Mathf.Cos(ph)) * 0.009f, 0f) * mv * w;
            pos.y += Mathf.Sin(Time.time * 1.6f) * 0.0012f * w;

            // 반동
            kickPos = Vector3.Lerp(kickPos, Vector3.zero, 1f - Mathf.Exp(-16f * dt));
            kickRot = Mathf.Lerp(kickRot, 0f, 1f - Mathf.Exp(-14f * dt));
            kickRoll = Mathf.Lerp(kickRoll, 0f, 1f - Mathf.Exp(-12f * dt));
            pos += kickPos;
            rot *= Quaternion.Euler(-kickRot, 0f, kickRoll);

            // 달리기 · 장전 · 꺼내기 · 볼트/펌프
            float sprint = player.sprinting ? 1f : 0f;
            sprintW = Mathf.Lerp(sprintW, sprint, 1f - Mathf.Exp(-10f * dt));
            pos += new Vector3(-0.04f, -0.035f, -0.02f) * sprintW;
            rot *= Quaternion.Euler(12f * sprintW, -28f * sprintW, 14f * sprintW);
            float rl = rs == RS.None ? 0f : rs == RS.Mag ? Mathf.Sin(Mathf.PI * Mathf.Clamp01(rsT / rsDur)) : 0.8f;
            reloadW = Mathf.Lerp(reloadW, rl, 1f - Mathf.Exp(-12f * dt));
            pos += new Vector3(-0.02f, -0.05f, 0f) * reloadW;
            rot *= Quaternion.Euler(16f * reloadW, 0f, 26f * reloadW);
            if (cycleT >= 0f) { float c = Mathf.Sin(Mathf.PI * Mathf.Clamp01(cycleT / Mathf.Max(0.01f, def.action == ActionType.Bolt ? def.cycle : 60f / def.rpm))); rot *= Quaternion.Euler(4f * c * w, 0f, 8f * c * w); }
            float sw = 1f - Ease(switchT);
            pos.y -= 0.22f * sw;
            rot *= Quaternion.Euler(25f * sw, 0f, 0f);

            s.view.localPosition = pos;
            s.view.localRotation = rot;
            // 총구 불빛은 카메라 쪽을 보게
            if (s.flash.gameObject.activeSelf) s.flash.rotation = Quaternion.LookRotation(s.flash.position - cam.transform.position) * Quaternion.Euler(0f, 0f, flashRoll);
        }

        float sprintW, reloadW, flashRoll;
    }
}
