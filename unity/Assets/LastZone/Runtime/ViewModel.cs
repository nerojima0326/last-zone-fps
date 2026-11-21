using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 1인칭 총 (PlayerCtl 상태를 읽어 자세를 만든다). 조준하면 GunDef.sightHeight 선이 화면 정가운데
    public class ViewModel : MonoBehaviour
    {
        public Camera cam;
        public GunLibrary library;
        public Material flashMat;
        class VM { public string id; public GunDef def; public Transform root, muzzle, flash; public Light light; }
        readonly Dictionary<string, VM> cache = new Dictionary<string, VM>();
        VM cur; Transform throwRoot; readonly Dictionary<string, GameObject> throwModels = new Dictionary<string, GameObject>();
        public static Dictionary<string, GameObject> throwTemplates = new Dictionary<string, GameObject>();
        Vector3 swayRot, kickPos; float kickRot, kickRoll, sprintW, reloadW, flashT, flashRoll;

        void Awake()
        {
            PlayerCtl.onFireKick = (kick, hide) =>
            {
                kickPos += new Vector3(0, 0.004f, -0.035f) * kick;
                kickRot += 3.2f * kick; kickRoll += Random.Range(-1.5f, 1.5f) * kick;
                if (!hide && cur != null) { flashT = 0.05f; flashRoll = Random.Range(0, 360f); }
            };
            PlayerCtl.muzzleWorld = () => cur != null && cur.muzzle != null ? Conv.W(cur.muzzle.position) : PlayerCtl.camPos + PlayerCtl.CamFwd * 0.6f;
            throwRoot = new GameObject("VM_throw").transform; throwRoot.SetParent(transform, false); throwRoot.gameObject.SetActive(false);
        }

        VM Get(string id)
        {
            if (cache.TryGetValue(id, out var v)) return v;
            var def = Data.Gun(id);
            if (PlayerPrefs.HasKey("lz_sight_" + id)) def.sightHeight = PlayerPrefs.GetFloat("lz_sight_" + id);
            v = new VM { id = id, def = def };
            v.root = new GameObject("VM_" + id).transform; v.root.SetParent(transform, false);
            var holder = new GameObject("Model").transform; holder.SetParent(v.root, false);
            var e = library != null ? library.Get(id) : null;
            if (e != null && e.model != null)
            {
                var inst = Instantiate(e.model, holder, false);
                foreach (var c in inst.GetComponentsInChildren<Collider>()) Destroy(c);
                AutoOrient(holder);
            }
            else Fallback(holder, def);
            foreach (var r in v.root.GetComponentsInChildren<Renderer>()) { r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; r.receiveShadows = false; }
            v.muzzle = new GameObject("Muzzle").transform; v.muzzle.SetParent(v.root, false); v.muzzle.localPosition = new Vector3(0, def.muzzleUp, def.muzzleFwd);
            var fl = GameObject.CreatePrimitive(PrimitiveType.Quad); Destroy(fl.GetComponent<Collider>());
            fl.GetComponent<Renderer>().sharedMaterial = flashMat; fl.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            fl.transform.SetParent(v.muzzle, false); fl.transform.localPosition = new Vector3(0, 0, 0.04f); fl.SetActive(false);
            v.flash = fl.transform;
            v.light = new GameObject("FlashLight").AddComponent<Light>(); v.light.transform.SetParent(v.muzzle, false);
            v.light.type = LightType.Point; v.light.range = 7; v.light.intensity = 2.5f; v.light.color = new Color(1, 0.7f, 0.35f); v.light.enabled = false;
            v.root.gameObject.SetActive(false);
            cache[id] = v;
            return v;
        }
        static void AutoOrient(Transform holder)
        {
            float minZ = float.MaxValue, maxZ = float.MinValue;
            var toH = holder.worldToLocalMatrix;
            foreach (var mf in holder.GetComponentsInChildren<MeshFilter>())
            {
                if (mf.sharedMesh == null) continue;
                var bb = mf.sharedMesh.bounds; var m = toH * mf.transform.localToWorldMatrix;
                for (int i = 0; i < 8; i++)
                {
                    var p = m.MultiplyPoint3x4(new Vector3((i & 1) == 0 ? bb.min.x : bb.max.x, (i & 2) == 0 ? bb.min.y : bb.max.y, (i & 4) == 0 ? bb.min.z : bb.max.z));
                    minZ = Mathf.Min(minZ, p.z); maxZ = Mathf.Max(maxZ, p.z);
                }
            }
            if (minZ < float.MaxValue && -minZ > maxZ) holder.localRotation = Quaternion.Euler(0, 180, 0);
        }
        static void Fallback(Transform holder, GunDef def)
        {
            var sh = Shader.Find("Universal Render Pipeline/Lit"); if (sh == null) sh = Shader.Find("Standard");
            var mat = new Material(sh) { color = new Color(0.12f, 0.13f, 0.14f) }; if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", mat.color);
            void Box(Vector3 c, Vector3 s) { var g = GameObject.CreatePrimitive(PrimitiveType.Cube); Destroy(g.GetComponent<Collider>()); g.transform.SetParent(holder, false); g.transform.localPosition = c; g.transform.localScale = s; g.GetComponent<Renderer>().sharedMaterial = mat; }
            float len = def.muzzleFwd, top = def.sightHeight;
            Box(new Vector3(0, def.muzzleUp, len * 0.5f - 0.05f), new Vector3(0.035f, 0.05f, len + 0.1f));
            Box(new Vector3(0, -0.05f, 0), new Vector3(0.03f, 0.1f, 0.05f));
            Box(new Vector3(0, (def.muzzleUp + top) * 0.5f, len - 0.03f), new Vector3(0.004f, top - def.muzzleUp, 0.006f));
            Box(new Vector3(-0.007f, (def.muzzleUp + top) * 0.5f, def.sightFwd), new Vector3(0.006f, top - def.muzzleUp + 0.004f, 0.006f));
            Box(new Vector3(0.007f, (def.muzzleUp + top) * 0.5f, def.sightFwd), new Vector3(0.006f, top - def.muzzleUp + 0.004f, 0.006f));
        }

        static float Ease(float x) => x * x * (3 - 2 * x);

        void LateUpdate()
        {
            float dt = Time.deltaTime;
            var a = PlayerCtl.a;
            bool show = a != null && a.alive && a.state == "ground" && PlayerCtl.vehicle == null && !a.knocked && Match.state != "menu" && PlayerCtl.scopeView < 0.6f;
            string id = show && a.W(a.cur) != null ? a.W(a.cur).id : null;
            bool throwing = show && a.cur == "throw";
            if (cur != null && (id == null || cur.id != id)) { cur.root.gameObject.SetActive(false); cur = null; }
            if (id != null && cur == null) { cur = Get(id); cur.root.gameObject.SetActive(true); }
            throwRoot.gameObject.SetActive(throwing);
            if (throwing) PoseThrow(dt);
            if (cur == null) return;
            var def = cur.def;
            float ads = Ease(PlayerCtl.ads), w = 1 - 0.85f * ads;
            var inst = a.W(a.cur);
            string optic = inst != null ? Attachments.Optic(inst, def) : null;
            float sightH = def.sightHeight + (optic != null && Data.Scopes[optic].zoom <= 1 ? 0.035f : 0);
            var adsPos = new Vector3(0, -sightH, def.eyeDist - def.sightFwd);
            var hipOff = def.cls == GunClass.Pistol ? new Vector3(0.11f, -0.07f, -0.06f) : new Vector3(0.12f, -0.065f, 0.06f);
            var pos = adsPos + hipOff * (1 - ads);
            var rot = Quaternion.Euler(0, -2.5f * (1 - ads), 0);
            var want = new Vector3(Mathf.Clamp(-GameInput.mdy * 0.04f, -4, 4), Mathf.Clamp(-GameInput.mdx * 0.04f, -4, 4), Mathf.Clamp(GameInput.mdx * 0.06f, -5, 5));
            swayRot = Vector3.Lerp(swayRot, want, 1 - Mathf.Exp(-9 * dt));
            rot *= Quaternion.Euler(swayRot * w);
            float ph = PlayerCtl.stepPhase, mv = Mathf.Min(1, a.hspeed / 4.6f) * (a.onGround ? 1 : 0);
            pos += new Vector3(Mathf.Sin(ph) * 0.011f, -Mathf.Abs(Mathf.Cos(ph)) * 0.009f, 0) * mv * w;
            pos.y += Mathf.Sin(Time.time * 1.6f) * 0.0012f * w - PlayerCtl.landDip * 0.03f;
            kickPos = Vector3.Lerp(kickPos, Vector3.zero, 1 - Mathf.Exp(-16 * dt));
            kickRot = Mathf.Lerp(kickRot, 0, 1 - Mathf.Exp(-14 * dt));
            kickRoll = Mathf.Lerp(kickRoll, 0, 1 - Mathf.Exp(-12 * dt));
            pos += kickPos * (1 - ads * 0.4f);
            rot *= Quaternion.Euler(-kickRot * (1 - ads * 0.5f), 0, kickRoll);
            sprintW = Mathf.Lerp(sprintW, PlayerCtl.sprinting && a.hspeed > 3 ? 1 : 0, 1 - Mathf.Exp(-10 * dt));
            pos += new Vector3(-0.04f, -0.035f, -0.02f) * sprintW;
            rot *= Quaternion.Euler(12 * sprintW, -28 * sprintW, 14 * sprintW);
            var R = PlayerCtl.reload;
            float rl = R == null ? 0 : (R.kind == "mag" || R.kind == "revolver") ? Mathf.Sin(Mathf.PI * Mathf.Clamp01(R.t / Mathf.Max(0.01f, R.dur))) : 0.8f;
            reloadW = Mathf.Lerp(reloadW, rl, 1 - Mathf.Exp(-12 * dt));
            pos += new Vector3(-0.02f, -0.05f, 0) * reloadW;
            rot *= Quaternion.Euler(16 * reloadW, 0, 26 * reloadW);
            if (PlayerCtl.cycleT >= 0) { float c = Mathf.Sin(Mathf.PI * Mathf.Clamp01(PlayerCtl.cycleT / Mathf.Max(0.01f, def.cycle))); rot *= Quaternion.Euler(4 * c * w, 0, 8 * c * w); }
            if (PlayerCtl.pumpT >= 0) { float c = Mathf.Sin(Mathf.PI * Mathf.Clamp01(PlayerCtl.pumpT / 0.6f)); pos += new Vector3(0, 0, -0.03f) * c; rot *= Quaternion.Euler(3 * c, 0, 0); }
            float sw = 1 - Ease(PlayerCtl.raise);
            pos.y -= 0.22f * sw; rot *= Quaternion.Euler(25 * sw, 0, 0);
            if (PlayerCtl.heal != null) { pos.y -= 0.18f; rot *= Quaternion.Euler(20, 0, 0); }
            cur.root.localPosition = pos; cur.root.localRotation = rot;
            flashT -= dt;
            bool fon = flashT > 0;
            cur.flash.gameObject.SetActive(fon); cur.light.enabled = fon;
            if (fon) { cur.flash.rotation = Quaternion.LookRotation(cur.flash.position - cam.transform.position) * Quaternion.Euler(0, 0, flashRoll); cur.flash.localScale = Vector3.one * (def.cls == GunClass.Shotgun ? 0.26f : 0.18f); }
        }

        void PoseThrow(float dt)
        {
            string k = PlayerCtl.throwSt != null ? PlayerCtl.throwSt.kind : PlayerCtl.throwKind;
            foreach (var kv in throwModels) kv.Value.SetActive(kv.Key == k);
            if (!throwModels.ContainsKey(k))
            {
                GameObject g;
                if (throwTemplates.TryGetValue(k, out var t) && t != null) { g = Instantiate(t, throwRoot, false); g.transform.localScale = Vector3.one * 1.3f; }
                else { g = GameObject.CreatePrimitive(PrimitiveType.Sphere); Destroy(g.GetComponent<Collider>()); g.transform.SetParent(throwRoot, false); g.transform.localScale = Vector3.one * 0.07f; }
                foreach (var r in g.GetComponentsInChildren<Renderer>()) r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                throwModels[k] = g;
            }
            var T = PlayerCtl.throwSt;
            float p = T == null ? 0 : T.phase == "hold" ? 0.37f * Mathf.Min(1, T.holdT / 0.18f) : T.t / 0.68f;
            var hold = new Vector3(0.16f, -0.16f, 0.32f);
            Vector3 pos; Quaternion rot;
            if (p < 0.37f) { float k2 = p / 0.37f; pos = Vector3.Lerp(hold, new Vector3(0.2f, -0.02f, 0.15f), k2); rot = Quaternion.Euler(-40 * k2, 0, 0); }
            else { float k2 = Mathf.Clamp01((p - 0.37f) / 0.2f); pos = Vector3.Lerp(new Vector3(0.2f, -0.02f, 0.15f), new Vector3(0.05f, -0.1f, 0.6f), k2); rot = Quaternion.Euler(-40 + 80 * k2, 0, 0); if (T != null && T.released) pos.y -= 1; }
            pos.y -= 0.22f * (1 - Ease(PlayerCtl.raise));
            throwRoot.localPosition = pos; throwRoot.localRotation = rot;
        }
    }
}
