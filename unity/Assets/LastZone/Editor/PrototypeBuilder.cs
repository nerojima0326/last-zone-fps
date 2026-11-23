using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace LastZone.EditorTools
{
    // 메뉴 'LAST ZONE > 프로토타입 씬 만들기': 사격장 씬을 처음부터 만들어 Assets/LastZone/Scenes/Prototype.unity 로 저장한다
    //  (씬 파일을 손으로 만들지 않아도 되게 — 다시 누르면 최신 코드로 다시 만든다)
    public static class PrototypeBuilder
    {
        internal const string Root = "Assets/LastZone", Gen = Root + "/Generated", ScenePath = Root + "/Scenes/Prototype.unity";
        static readonly float[] Distances = { 10f, 25f, 50f, 75f, 100f, 150f, 200f, 300f };

        [MenuItem("LAST ZONE/프로토타입 씬 만들기", priority = 0)]
        public static void Build()
        {
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            Folder(Root, "Generated"); Folder(Root, "Scenes");
            var lib = BuildLibrary();

            var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
            var oldCam = GameObject.Find("Main Camera");
            if (oldCam != null) Object.DestroyImmediate(oldCam);
            var sunGo = GameObject.Find("Directional Light");
            if (sunGo != null)
            {
                sunGo.name = "Sun";
                sunGo.transform.rotation = Quaternion.Euler(48f, -35f, 0f);
                var sun = sunGo.GetComponent<Light>();
                sun.shadows = LightShadows.Soft;
                sun.intensity = 1.2f;
                sun.color = new Color(1f, 0.96f, 0.9f);
            }

            // ---- 재질 ----
            var checker = Checker();
            var mGround = Mat("Ground", new Color(0.55f, 0.62f, 0.45f), checker, new Vector2(150f, 150f));
            var mBerm = Mat("Berm", new Color(0.55f, 0.48f, 0.36f));
            var mWall = Mat("Wall", new Color(0.5f, 0.5f, 0.48f));
            var mWood = Mat("Wood", new Color(0.45f, 0.33f, 0.2f));
            var mTarget = Mat("Target", new Color(0.86f, 0.72f, 0.5f));
            var mPost = Mat("Post", new Color(0.2f, 0.2f, 0.2f));
            var mImpact = Mat("Impact", new Color(0.05f, 0.05f, 0.05f));
            var mTracer = Unlit("Tracer", new Color(1f, 0.85f, 0.5f));
            var mFlash = Unlit("Flash", new Color(1f, 0.82f, 0.45f));

            // ---- 땅 · 둑 · 벽 ----
            var env = new GameObject("Range").transform;
            var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
            ground.name = "Ground"; ground.transform.SetParent(env);
            ground.transform.position = new Vector3(0f, 0f, 150f);
            ground.transform.localScale = new Vector3(60f, 1f, 60f);
            ground.GetComponent<Renderer>().sharedMaterial = mGround;
            Box(env, "Berm", new Vector3(0f, 6f, 335f), new Vector3(90f, 12f, 6f), mBerm);
            Box(env, "WallL", new Vector3(-30f, 1.5f, 160f), new Vector3(0.5f, 3f, 340f), mWall);
            Box(env, "WallR", new Vector3(30f, 1.5f, 160f), new Vector3(0.5f, 3f, 340f), mWall);
            Box(env, "Bench", new Vector3(0f, 0.45f, 1.2f), new Vector3(20f, 0.9f, 0.7f), mWood);
            // 움직임 시험용 엄폐물
            Box(env, "Crate1", new Vector3(-6f, 0.6f, -10f), new Vector3(1.2f, 1.2f, 1.2f), mWood);
            Box(env, "Crate2", new Vector3(5f, 0.5f, -14f), new Vector3(2f, 1f, 1f), mWood);
            Box(env, "Wall1", new Vector3(10f, 1.25f, -8f), new Vector3(0.4f, 2.5f, 5f), mWall);

            // ---- 과녁: 거리별 한 개씩 (서로 가리지 않게 옆으로) + 움직이는 과녁 2개 ----
            var font = Font();
            for (int k = 0; k < Distances.Length; k++)
            {
                float d = Distances[k], x = -12.25f + k * 3.5f;
                Target(env, $"Target_{d}m", new Vector3(x, 0f, d), mTarget, mPost, 0f);
                Sign(env, font, $"{d}m", new Vector3(x, 0.25f, d - 0.6f), d);
            }
            Target(env, "Mover_35m", new Vector3(0f, 0f, 35f), mTarget, mPost, 4f);
            Target(env, "Mover_60m", new Vector3(-4f, 0f, 60f), mTarget, mPost, 6f);
            Sign(env, font, "35m", new Vector3(6f, 0.25f, 34.4f), 35f);
            Sign(env, font, "60m", new Vector3(5f, 0.25f, 59.4f), 60f);

            // ---- 플레이어 · 시스템 ----
            CreatePlayer(new Vector3(0f, 0.05f, 0.3f), lib, mFlash, mTracer, mImpact);   // 사격대 바로 뒤

            EditorSceneManager.SaveScene(scene, ScenePath);
            AddToBuild(ScenePath);
            int missing = 0;
            foreach (var e in lib.entries) if (e.model == null) missing++;
            EditorUtility.DisplayDialog("LAST ZONE",
                "프로토타입 씬을 만들었습니다: " + ScenePath + "\n\n▶ 재생 버튼을 누르세요." +
                (missing > 0 ? $"\n\n총 모델 {missing}개를 못 읽었습니다 → glTFast 패키지(com.unity.cloud.gltfast)를 설치한 뒤 다시 만들면 실제 모델이 나옵니다. 지금은 상자 모양 대체 총을 씁니다." : ""),
                "확인");
        }

        // 플레이어(이동·시선·총) + 시스템(총알·HUD) — 다른 씬 만들기(섬 맵)에서도 쓴다
        internal static PlayerController CreatePlayer(Vector3 pos, GunLibrary lib, Material mFlash, Material mTracer, Material mImpact)
        {
            var playerGo = new GameObject("Player");
            playerGo.layer = 2;   // Ignore Raycast: 내 총알·영점 레이가 나를 맞히지 않게
            playerGo.transform.position = pos;
            var cc = playerGo.AddComponent<CharacterController>();
            cc.height = 1.8f; cc.radius = 0.35f; cc.center = new Vector3(0f, 0.9f, 0f); cc.stepOffset = 0.4f;
            var headT = new GameObject("Head").transform;
            headT.SetParent(playerGo.transform, false);
            headT.localPosition = new Vector3(0f, 1.62f, 0f);
            var cam = headT.gameObject.AddComponent<Camera>();
            headT.gameObject.tag = "MainCamera";
            cam.nearClipPlane = 0.01f; cam.farClipPlane = 2500f; cam.fieldOfView = 75f;
            headT.gameObject.AddComponent<AudioListener>();
            var audio = headT.gameObject.AddComponent<AudioSource>();
            audio.playOnAwake = false; audio.spatialBlend = 0f;
            var viewRoot = new GameObject("ViewRoot").transform;
            viewRoot.SetParent(headT, false);
            var pc = playerGo.AddComponent<PlayerController>();
            pc.head = headT; pc.cam = cam;
            var wc = playerGo.AddComponent<WeaponController>();
            wc.player = pc; wc.cam = cam; wc.viewRoot = viewRoot; wc.library = lib; wc.audioSrc = audio; wc.flashMat = mFlash;

            var sys = new GameObject("Systems");
            var bal = sys.AddComponent<Ballistics>();
            bal.tracerMat = mTracer; bal.impactMat = mImpact;
            var hud = sys.AddComponent<Hud>();
            hud.weapons = wc; hud.player = pc;
            return pc;
        }

        // ---------------- 총 모델·소리 묶음 ----------------
        internal static GunLibrary BuildLibrary()
        {
            string path = Gen + "/GunLibrary.asset";
            var lib = AssetDatabase.LoadAssetAtPath<GunLibrary>(path);
            if (lib == null) { lib = ScriptableObject.CreateInstance<GunLibrary>(); AssetDatabase.CreateAsset(lib, path); }
            lib.entries.Clear();
            AudioClip A(string id, string cue) => AssetDatabase.LoadAssetAtPath<AudioClip>($"{Root}/Audio/{id}_{cue}.ogg");
            foreach (var g in GunTable.All)
            {
                lib.entries.Add(new GunLibrary.Entry
                {
                    id = g.id,
                    model = AssetDatabase.LoadAssetAtPath<GameObject>($"{Root}/Models/{g.id}.glb"),
                    shot0 = A(g.id, "own0"), shot1 = A(g.id, "own1"),
                    magout = A(g.id, "magout"), magin = A(g.id, "magin"), open = A(g.id, "open"), close = A(g.id, "close"),
                    dry = A(g.id, "dry"), shell = A(g.id, "shell"), port = A(g.id, "port"), up = A(g.id, "up"), down = A(g.id, "down"), near = A(g.id, "near"), far = A(g.id, "far")
                });
            }
            lib.switchClip = AssetDatabase.LoadAssetAtPath<AudioClip>($"{Root}/Audio/switch.ogg");
            EditorUtility.SetDirty(lib);
            AssetDatabase.SaveAssets();
            return lib;
        }

        // ---------------- 만들기 도우미 ----------------
        static GameObject Box(Transform parent, string name, Vector3 pos, Vector3 size, Material m)
        {
            var g = GameObject.CreatePrimitive(PrimitiveType.Cube);
            g.name = name; g.transform.SetParent(parent);
            g.transform.position = pos; g.transform.localScale = size;
            g.GetComponent<Renderer>().sharedMaterial = m;
            g.isStatic = true;
            return g;
        }

        // 사람 모양 과녁: 몸통(상자) + 머리(공), 발밑 축으로 뒤로 넘어간다
        static void Target(Transform parent, string name, Vector3 pos, Material skin, Material post, float moveAmp)
        {
            var root = new GameObject(name);
            root.transform.SetParent(parent);
            root.transform.position = pos;
            var t = root.AddComponent<Target>();
            t.moveAmp = moveAmp;
            var pivot = new GameObject("Pivot").transform;
            pivot.SetParent(root.transform, false);
            t.pivot = pivot;
            var stand = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Object.DestroyImmediate(stand.GetComponent<Collider>());
            stand.name = "Stand"; stand.transform.SetParent(root.transform, false);
            stand.transform.localPosition = new Vector3(0f, 0.05f, 0f); stand.transform.localScale = new Vector3(0.8f, 0.1f, 0.4f);
            stand.GetComponent<Renderer>().sharedMaterial = post;
            Part(pivot, PrimitiveType.Cube, "Legs", new Vector3(0f, 0.5f, 0f), new Vector3(0.36f, 0.8f, 0.06f), skin, t, false);
            Part(pivot, PrimitiveType.Cube, "Torso", new Vector3(0f, 1.18f, 0f), new Vector3(0.52f, 0.62f, 0.07f), skin, t, false);
            Part(pivot, PrimitiveType.Sphere, "Head", new Vector3(0f, 1.62f, 0f), new Vector3(0.25f, 0.25f, 0.25f), skin, t, true);
        }

        static void Part(Transform parent, PrimitiveType type, string name, Vector3 pos, Vector3 scale, Material m, Target t, bool head)
        {
            var g = GameObject.CreatePrimitive(type);
            g.name = name; g.transform.SetParent(parent, false);
            g.transform.localPosition = pos; g.transform.localScale = scale;
            g.GetComponent<Renderer>().sharedMaterial = m;
            var z = g.AddComponent<HitZone>();
            z.head = head; z.target = t;
        }

        static void Sign(Transform parent, Font font, string text, Vector3 pos, float dist)
        {
            var g = new GameObject("Sign_" + text);
            g.transform.SetParent(parent);
            g.transform.position = pos;
            var tm = g.AddComponent<TextMesh>();
            tm.text = text; tm.anchor = TextAnchor.LowerCenter; tm.alignment = TextAlignment.Center;
            tm.fontSize = 64; tm.characterSize = 0.012f * Mathf.Max(1f, dist / 25f); tm.color = Color.white;
            if (font != null) { tm.font = font; g.GetComponent<MeshRenderer>().sharedMaterial = font.material; }
        }

        static Font Font()
        {
            Font f = null;
            try { f = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"); } catch { }
            if (f == null) try { f = Resources.GetBuiltinResource<Font>("Arial.ttf"); } catch { }
            return f;
        }

        internal static Shader LitShader()
        {
            var s = Shader.Find("Universal Render Pipeline/Lit");
            return s != null ? s : Shader.Find("Standard");
        }

        internal static Material Mat(string name, Color c, Texture tex = null, Vector2 tiling = default)
        {
            string path = $"{Gen}/{name}.mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (m == null) { m = new Material(LitShader()); AssetDatabase.CreateAsset(m, path); }
            else m.shader = LitShader();
            m.color = c;
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", 0.15f);
            if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", 0.15f);
            if (tex != null)
            {
                m.mainTexture = tex;
                m.mainTextureScale = tiling;
                if (m.HasProperty("_BaseMap")) { m.SetTexture("_BaseMap", tex); m.SetTextureScale("_BaseMap", tiling); }
            }
            EditorUtility.SetDirty(m);
            return m;
        }

        internal static Material Unlit(string name, Color c)
        {
            string path = $"{Gen}/{name}.mat";
            var sh = Shader.Find("Sprites/Default");
            if (sh == null) sh = Shader.Find("Unlit/Color");
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (m == null) { m = new Material(sh); AssetDatabase.CreateAsset(m, path); }
            else m.shader = sh;
            m.color = c;
            EditorUtility.SetDirty(m);
            return m;
        }

        // 바닥 격자 무늬 (1 칸 = 2 m)
        internal static Texture2D Checker()
        {
            string path = Gen + "/GroundChecker.asset";
            var t = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            if (t != null) return t;
            t = new Texture2D(64, 64, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Trilinear, anisoLevel = 4 };
            for (int y = 0; y < 64; y++)
                for (int x = 0; x < 64; x++)
                {
                    bool a = ((x / 32) + (y / 32)) % 2 == 0;
                    bool line = x % 32 == 0 || y % 32 == 0;
                    float v = line ? 0.78f : a ? 0.95f : 0.88f;
                    t.SetPixel(x, y, new Color(v, v, v, 1f));
                }
            t.Apply(true);
            AssetDatabase.CreateAsset(t, path);
            return t;
        }

        internal static void Folder(string parent, string name)
        {
            if (!AssetDatabase.IsValidFolder(parent + "/" + name)) AssetDatabase.CreateFolder(parent, name);
        }

        internal static void AddToBuild(string path)
        {
            var list = new System.Collections.Generic.List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
            if (list.Exists(s => s.path == path)) return;
            list.Insert(0, new EditorBuildSettingsScene(path, true));
            EditorBuildSettings.scenes = list.ToArray();
        }
    }
}
