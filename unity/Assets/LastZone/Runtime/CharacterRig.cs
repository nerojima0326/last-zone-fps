using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 3인칭 캐릭터 (웹판 character.js 절차적 관절 각도 → soldiers.js 처럼 Mixamo 뼈대에 옮긴다)
    //  root(웹 위치·yaw) → pose(기울임·엎드림) → model(뼈대). 캐릭터 앞 = 로컬 -z (웹과 같게)
    public class CharacterRig : MonoBehaviour
    {
        class BoneInfo { public Transform t; public Quaternion q0; public Vector3 d0; public Transform child; }
        Transform pose, hips; Vector3 hips0;
        readonly Dictionary<string, BoneInfo> b = new Dictionary<string, BoneInfo>();
        public Transform gunHolder; GameObject chute; string gunShown;
        float phase, deathT, fallDir = 1, kickS, flinchS, throwS;
        public Actor actor;
        public static GunLibrary lib; public static Material chuteMat;
        static readonly Dictionary<string, GameObject> tpGuns = new Dictionary<string, GameObject>();

        public static CharacterRig Create(Actor a, GameObject template, Material skin)
        {
            var root = new GameObject("Char_" + a.name);
            var rig = root.AddComponent<CharacterRig>();
            rig.actor = a;
            rig.pose = new GameObject("Pose").transform; rig.pose.SetParent(root.transform, false);
            GameObject model;
            if (template != null) model = Instantiate(template, rig.pose, false);
            else { model = GameObject.CreatePrimitive(PrimitiveType.Capsule); Destroy(model.GetComponent<Collider>()); model.transform.SetParent(rig.pose, false); model.transform.localPosition = new Vector3(0, 0.9f, 0); model.transform.localScale = new Vector3(0.5f, 0.9f, 0.5f); }
            foreach (var c in model.GetComponentsInChildren<Collider>()) Destroy(c);
            if (skin != null) foreach (var r in model.GetComponentsInChildren<Renderer>()) { var ms = r.sharedMaterials; for (int i = 0; i < ms.Length; i++) ms[i] = skin; r.sharedMaterials = ms; }
            foreach (var r in model.GetComponentsInChildren<SkinnedMeshRenderer>()) r.updateWhenOffscreen = false;
            rig.Setup(model.transform);
            rig.gunHolder = new GameObject("Gun").transform; rig.gunHolder.SetParent(root.transform, false);
            return rig;
        }

        static Transform Find(Transform r, string suffix)
        {
            foreach (var t in r.GetComponentsInChildren<Transform>(true))
            {
                string n = t.name; int i = n.LastIndexOf(':'); if (i >= 0) n = n.Substring(i + 1);
                if (n == suffix) return t;
            }
            return null;
        }

        void Setup(Transform model)
        {
            // 모델이 +z 를 보고 있으면 뒤로 돌려 -z 를 보게 (얼굴 = Head 가 Hips 보다 앞쪽)
            var hp = Find(model, "Hips"); var lf = Find(model, "LeftFoot"); var toe = Find(model, "LeftToeBase");
            if (lf != null && toe != null && transform.InverseTransformPoint(toe.position).z > transform.InverseTransformPoint(lf.position).z) model.localRotation = Quaternion.Euler(0, 180, 0) * model.localRotation;
            hips = hp; if (hips != null) hips0 = hips.localPosition;
            string[][] pairs =
            {
                new[] { "Spine", "Spine1" }, new[] { "Spine1", "Spine2" }, new[] { "Spine2", "Neck" }, new[] { "Neck", "Head" }, new[] { "Head", "HeadTop_End" },
                new[] { "LeftArm", "LeftForeArm" }, new[] { "LeftForeArm", "LeftHand" }, new[] { "RightArm", "RightForeArm" }, new[] { "RightForeArm", "RightHand" },
                new[] { "LeftUpLeg", "LeftLeg" }, new[] { "LeftLeg", "LeftFoot" }, new[] { "RightUpLeg", "RightLeg" }, new[] { "RightLeg", "RightFoot" }
            };
            var inv = Quaternion.Inverse(transform.rotation);
            foreach (var p in pairs)
            {
                var t = Find(model, p[0]); var c = Find(model, p[1]);
                if (t == null) continue;
                b[p[0]] = new BoneInfo { t = t, child = c, q0 = inv * t.rotation, d0 = c != null ? (inv * (c.position - t.position)).normalized : Vector3.up };
            }
        }

        // 웹 Euler (x,y,z 순서 'XYZ') → 유니티 로컬 (x 뒤집기: y·z 회전 부호 반대)
        static Quaternion WE(float x, float y, float z) => Quaternion.AngleAxis(x * Mathf.Rad2Deg, Vector3.right) * Quaternion.AngleAxis(-y * Mathf.Rad2Deg, Vector3.up) * Quaternion.AngleAxis(-z * Mathf.Rad2Deg, Vector3.forward);
        static Quaternion RX(float x) => Quaternion.AngleAxis(x * Mathf.Rad2Deg, Vector3.right);

        void Aim(string name, Quaternion procRot)
        {
            if (!b.TryGetValue(name, out var bi)) return;
            var dir = procRot * Vector3.down;   // 절차적 팔다리는 아래(-y)로 뻗은 것이 기본
            bi.t.rotation = transform.rotation * (Quaternion.FromToRotation(bi.d0, dir) * bi.q0);
        }
        void Pitch(string name, float x) { if (b.TryGetValue(name, out var bi)) bi.t.rotation = transform.rotation * (RX(x) * bi.q0); }

        public void Drive(float dt, CharacterView view)
        {
            var a = actor;
            transform.position = Conv.U(a.pos);
            transform.rotation = Quaternion.Euler(0, Conv.YawDeg(a.yaw) - 180, 0);
            float hipY = 0.95f, spineRX = 0, chestRX = U.Clamp(a.pitch, -1.1f, 1.1f) * 0.85f, headRX = U.Clamp(a.pitch, -1, 1) * 0.15f;
            float lT = 0, lK = 0, rT = 0, rK = 0;
            Vector3 aL = new Vector3(1.35f, 0, 0.55f), aR = new Vector3(1.1f, 0, -0.2f); float eL = 0.35f, eR = 0.9f;
            string gun = a.cur;
            if (gun == "pistol") { aL = new Vector3(1.42f, 0, 0.42f); eL = 0.25f; aR = new Vector3(1.45f, 0, -0.18f); eR = 0.12f; }
            else if (gun == "fists" || gun == "throw" || gun == null) { aL = new Vector3(0.9f, 0, 0.15f); eL = 1.5f; aR = new Vector3(0.9f, 0, -0.15f); eR = 1.5f; }
            if (view != null) { kickS = Mathf.Max(kickS, view.kick); view.kick = 0; flinchS = Mathf.Max(flinchS, view.flinch); view.flinch = 0; if (view.throwT > 0) { throwS = view.throwT; view.throwT = 0; } }
            kickS = U.Damp(kickS, 0, 14, dt); flinchS = U.Damp(flinchS, 0, 8, dt);
            float rx = 0, rz = 0, yOff = 0; bool showGun = true;
            float speed = a.hspeed;
            if (!a.alive)
            {
                deathT += dt;
                float d = U.Clamp(deathT / 0.75f, 0, 1), e = d * d * (3 - 2 * d);
                rx = fallDir * e * Mathf.PI / 2 * 0.97f; yOff = e * 0.14f;
                lK = -0.3f * e; rK = -0.5f * e; aL = new Vector3(0.5f + e, 0, 0.4f); aR = new Vector3(0.3f + e * 0.8f, 0, -0.4f); eL = 0.3f; eR = 0.5f;
                chestRX = 0; headRX = 0.2f * e; showGun = false;
            }
            else
            {
                deathT = 0; fallDir = U.R() < 0.5f ? 1 : -1;
                if (a.knocked || a.prone)
                {
                    rx = -1.4f; yOff = 0.2f;
                    phase += speed * dt * 3;
                    float s = Mathf.Sin(phase) * Mathf.Min(1, speed);
                    lT = -0.2f + s * 0.4f; rT = -0.2f - s * 0.4f; lK = -0.6f; rK = -0.6f;
                    aL = new Vector3(2.4f + s * 0.4f, 0, 0.3f); aR = new Vector3(2.4f - s * 0.4f, 0, -0.3f); eL = 0.5f; eR = 0.5f;
                    chestRX = 0.5f; headRX = 0.6f; showGun = false;
                    if (a.prone && !a.knocked) { rx = -1.45f; yOff = 0.02f; lT = 0.12f + s * 0.25f; rT = 0.12f - s * 0.25f; lK = -0.12f; rK = -0.12f; chestRX = 1.25f + U.Clamp(a.pitch, -0.4f, 0.4f) * 0.6f; spineRX = 0.15f; headRX = 0.1f; showGun = true; }
                }
                else if (a.state == "freefall") { rx = -1.25f; yOff = 1; aL = new Vector3(0.4f, 0, -1.3f); aR = new Vector3(0.4f, 0, 1.3f); eL = 0.6f; eR = 0.6f; lT = 0.25f; rT = 0.15f; lK = -0.6f; rK = -0.5f; chestRX = 0.4f; headRX = 0.6f; showGun = false; }
                else if (a.state == "chute") { aL = new Vector3(2.7f, 0, 0.3f); aR = new Vector3(2.7f, 0, -0.3f); eL = 0.3f; eR = 0.3f; phase += dt * 2; lT = 0.15f + Mathf.Sin(phase) * 0.1f; rT = 0.1f - Mathf.Sin(phase) * 0.1f; lK = -0.25f; rK = -0.3f; chestRX = 0; headRX = 0; showGun = false; }
                else
                {
                    float amp = U.Clamp(speed / 4.2f, 0, 1.25f);
                    phase += speed * dt * 1.9f;
                    float ph = phase;
                    lT = Mathf.Sin(ph) * 0.6f * amp; rT = -lT;
                    lK = -Mathf.Max(0, Mathf.Sin(ph - 1.2f)) * amp; rK = -Mathf.Max(0, Mathf.Sin(ph + Mathf.PI - 1.2f)) * amp;
                    hipY += Mathf.Abs(Mathf.Cos(ph)) * 0.035f * amp;
                    spineRX = -0.08f * amp;
                    if (a.crouch) { hipY = 0.62f + Mathf.Abs(Mathf.Cos(ph)) * 0.02f * amp; lT = 1.1f + lT * 0.5f; rT = 1.1f + rT * 0.5f; lK = -1.75f + lK * 0.3f; rK = -1.75f + rK * 0.3f; spineRX = -0.3f; }
                    if (!a.onGround) { lT = 0.5f; rT = -0.1f; lK = -0.9f; rK = -0.4f; }
                    if (throwS > 0) { throwS -= dt; float k = throwS / 0.5f; aR = new Vector3(2.6f * k + 0.6f, 0, -0.2f); eR = 0.8f * k; }
                }
                if (a.leanX != 0 && !a.knocked && !a.prone) rz = -Mathf.Asin(U.Clamp(a.leanX / Mathf.Max(0.8f, a.EyeH()), -0.5f, 0.5f));
            }
            pose.localRotation = Quaternion.AngleAxis(rx * Mathf.Rad2Deg, Vector3.right) * Quaternion.AngleAxis(-rz * Mathf.Rad2Deg, Vector3.forward);
            pose.localPosition = new Vector3(0, yOff, 0);
            if (hips != null) hips.localPosition = hips0 + hips.parent.InverseTransformVector(transform.up) * (hipY - 0.95f);
            float sp = spineRX - flinchS * 0.3f, ch = chestRX + kickS * 0.25f;
            var poseQ = Quaternion.Inverse(transform.rotation) * pose.rotation;   // 기울임까지 포함한 몸 회전
            Pitch2("Spine", sp * 0.5f, poseQ); Pitch2("Spine1", sp * 0.5f + (ch - sp) * 0.4f, poseQ); Pitch2("Spine2", ch, poseQ);
            Pitch2("Neck", ch + headRX * 0.5f, poseQ); Pitch2("Head", ch + headRX, poseQ);
            var chestQ = poseQ * RX(ch);
            var qaL = chestQ * WE(aL.x, aL.y, aL.z); var qaR = chestQ * WE(aR.x + kickS * 0.3f, aR.y, aR.z);
            AimP("LeftArm", qaL); AimP("LeftForeArm", qaL * RX(eL)); AimP("RightArm", qaR); AimP("RightForeArm", qaR * RX(eR));
            var qlL = poseQ * RX(lT); var qlR = poseQ * RX(rT);
            AimP("LeftUpLeg", qlL); AimP("LeftLeg", qlL * RX(lK)); AimP("RightUpLeg", qlR); AimP("RightLeg", qlR * RX(rK));
            // 총: 가슴 앞, 시선 방향
            UpdateGun(showGun && (gun == "rifle" || gun == "shotgun" || gun == "pistol") ? a.GunId(gun) : null, a, chestQ);
            // 낙하산
            bool chuteOn = a.alive && a.state == "chute";
            if (chuteOn && chute == null) chute = MakeChute(transform);
            if (chute != null) { chute.SetActive(chuteOn); if (chuteOn) chute.transform.localRotation = Quaternion.Euler(0, 0, Mathf.Sin(phase * 0.7f) * 3); }
        }
        void Pitch2(string n, float x, Quaternion poseQ) { if (b.TryGetValue(n, out var bi)) bi.t.rotation = transform.rotation * (poseQ * RX(x) * bi.q0); }
        void AimP(string n, Quaternion q) => Aim(n, q);

        void UpdateGun(string id, Actor a, Quaternion chestQ)
        {
            if (id != gunShown)
            {
                foreach (Transform c in gunHolder) Destroy(c.gameObject);
                gunShown = id;
                if (id != null)
                {
                    var e = lib != null ? lib.Get(id) : null;
                    if (e != null && e.model != null)
                    {
                        var g = Instantiate(e.model, gunHolder, false);
                        foreach (var c in g.GetComponentsInChildren<Collider>()) Destroy(c);
                        foreach (var r in g.GetComponentsInChildren<Renderer>()) r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
                        // 총구가 로컬 -z(캐릭터 앞)로
                        g.transform.localRotation = Quaternion.Euler(0, 180, 0);
                    }
                }
            }
            if (id == null) return;
            var d = Data.Gun(id);
            float pistol = d.cls == GunClass.Pistol ? 1 : 0;
            var chest = (b.TryGetValue("Spine2", out var bi) ? bi.t.position : transform.position + Vector3.up * 1.3f);
            gunHolder.rotation = transform.rotation * chestQ * Quaternion.Euler(0, 0, 0);
            gunHolder.position = chest + gunHolder.rotation * new Vector3(-0.12f, -0.02f - pistol * 0.05f, -0.28f - pistol * 0.15f);
        }

        static GameObject MakeChute(Transform parent)
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Sphere); Destroy(g.GetComponent<Collider>());
            g.name = "Chute"; g.transform.SetParent(parent, false);
            g.transform.localPosition = new Vector3(0, 4.6f, 0); g.transform.localScale = new Vector3(7.2f, 3f, 5.6f);
            if (chuteMat != null) g.GetComponent<Renderer>().sharedMaterial = chuteMat;
            return g;
        }
    }
}
