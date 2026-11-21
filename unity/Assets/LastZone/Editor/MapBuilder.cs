using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace LastZone.EditorTools
{
    // 메뉴 'LAST ZONE > 섬 맵 씬 만들기': 웹판에서 구운 섬 데이터(Assets/LastZone/Map)로 Island.unity 를 만든다
    //  지형(Terrain: 높이 513² · 풀/흙/모래/바위/포장 5겹) · 나무(Terrain 나무 + 먼 거리 임포스터) · 바위 · 건물(world.glb) · 물 · 상자 충돌체
    //  웹판 좌표 (x, y, z) → 유니티 (-x, y, z)  (glTFast 가 glb 를 읽을 때와 같은 변환)
    public static class MapBuilder
    {
        const string Root = PrototypeBuilder.Root, MapDir = Root + "/Map", Gen = Root + "/Generated", ScenePath = Root + "/Scenes/Island.unity";
        const int N = 513;
        const float Size = 1600f, Half = 800f;

        [System.Serializable] class TownJ { public string name, type; public float x, z, r; }
        [System.Serializable] class VegJ { public string name, kind; public int n; public float h, w; }
        [System.Serializable] class InfoJ { public TownJ[] towns; public float[] loot; public VegJ[] veg; public float[] sun; public float[] spawn; }

        [MenuItem("LAST ZONE/섬 맵 씬 만들기", priority = 1)]
        public static void Build()
        {
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            PrototypeBuilder.Folder(Root, "Generated"); PrototypeBuilder.Folder(Root, "Scenes"); PrototypeBuilder.Folder(Gen, "Map");
            string full(string p) => Path.Combine(Directory.GetCurrentDirectory(), p);
            var info = JsonUtility.FromJson<InfoJ>(File.ReadAllText(full(MapDir + "/mapinfo.json")));

            try
            {
                EditorUtility.DisplayProgressBar("LAST ZONE 섬", "높이 읽는 중", 0.05f);
                var lib = PrototypeBuilder.BuildLibrary();
                var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
                var oldCam = GameObject.Find("Main Camera");
                if (oldCam != null) Object.DestroyImmediate(oldCam);

                // ---- 해 ----
                var sunGo = GameObject.Find("Directional Light");
                if (sunGo != null)
                {
                    sunGo.name = "Sun";
                    var L = info.sun != null && info.sun.Length == 3 ? new Vector3(-info.sun[0], info.sun[1], info.sun[2]).normalized : new Vector3(-0.4f, 0.8f, 0.4f).normalized;
                    sunGo.transform.rotation = Quaternion.LookRotation(-L);
                    var sun = sunGo.GetComponent<Light>();
                    sun.shadows = LightShadows.Soft; sun.intensity = 1.25f; sun.color = new Color(1f, 0.96f, 0.9f);
                }
                RenderSettings.fog = true; RenderSettings.fogMode = FogMode.Linear;
                RenderSettings.fogStartDistance = 250f; RenderSettings.fogEndDistance = 1800f;
                RenderSettings.fogColor = new Color(0.72f, 0.79f, 0.86f);

                var world = new GameObject("Island").transform;

                // ---- 지형 ----
                var H = ReadFloats(full(MapDir + "/heights.bytes"));
                float hMin = float.MaxValue, hMax = float.MinValue;
                foreach (var h in H) { if (h < hMin) hMin = h; if (h > hMax) hMax = h; }
                hMin = Mathf.Floor(hMin) - 1f; hMax = Mathf.Ceil(hMax) + 1f;
                var td = new TerrainData { heightmapResolution = N };
                td.size = new Vector3(Size, hMax - hMin, Size);
                var hs = new float[N, N];
                for (int j = 0; j < N; j++) for (int i = 0; i < N; i++) hs[j, i] = (H[j * N + (N - 1 - i)] - hMin) / (hMax - hMin);
                td.SetHeights(0, 0, hs);

                EditorUtility.DisplayProgressBar("LAST ZONE 섬", "지형 칠하는 중", 0.2f);
                td.terrainLayers = new[]
                {
                    Layer("grass", "sparse_grass", 2.5f, new Color32(75, 95, 42, 255)), Layer("dirt", "dirt", 3.2f, new Color32(118, 100, 76, 255)),
                    Layer("sand", "coast_sand_01", 3.64f, new Color32(200, 184, 140, 255)), Layer("rock", "rock_face_03", 8.9f, new Color32(112, 110, 104, 255)),
                    Layer("asphalt", "asphalt_02", 4.44f, new Color32(105, 101, 95, 255))
                };
                const int AM = 1024;
                td.alphamapResolution = AM;
                var wT = LoadPng(full(MapDir + "/weights_png.bytes")); var pT = LoadPng(full(MapDir + "/paved_png.bytes"));
                var wpx = wT.GetPixels32(); var ppx = pT.GetPixels32(); int TS = wT.width;
                var am = new float[AM, AM, 5];
                for (int j = 0; j < AM; j++)
                    for (int i = 0; i < AM; i++)
                    {
                        float ux = -Half + (i + 0.5f) / AM * Size, uz = -Half + (j + 0.5f) / AM * Size;
                        float wx = -ux, wz = uz;
                        int px = Mathf.Clamp((int)((wx + Half) / Size * TS), 0, TS - 1), py = Mathf.Clamp((int)((wz + Half) / Size * TS), 0, TS - 1);
                        int k = (TS - 1 - py) * TS + px;   // PNG 는 아래 줄부터
                        float wD = wpx[k].r / 255f, wS = wpx[k].g / 255f, wR = wpx[k].b / 255f, wA = Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(0.25f, 0.75f, ppx[k].r / 255f));
                        // 웹판 셰이더: 풀 → 흙 → 모래 → 바위 → 포장 순서로 섞는다 → 겹별 비중
                        float a = wA, r = wR * (1 - wA), s = wS * (1 - wR) * (1 - wA), d = wD * (1 - wS) * (1 - wR) * (1 - wA);
                        am[j, i, 0] = Mathf.Max(0f, 1f - a - r - s - d); am[j, i, 1] = d; am[j, i, 2] = s; am[j, i, 3] = r; am[j, i, 4] = a;
                    }
                td.SetAlphamaps(0, 0, am);

                // ---- 나무 (Terrain 나무: LOD0 실제 메시, LOD1 임포스터) ----
                EditorUtility.DisplayProgressBar("LAST ZONE 섬", "나무 심는 중", 0.4f);
                var protos = new List<TreePrototype>(); var trees = new List<TreeInstance>();
                foreach (var v in info.veg)
                {
                    if (v.n == 0) continue;
                    var prefab = TreePrefab(v.name);
                    if (prefab == null) continue;
                    int pi = protos.Count;
                    protos.Add(new TreePrototype { prefab = prefab });
                    var M = ReadFloats(full(MapDir + "/" + v.name + ".bytes"));
                    for (int t = 0; t + 16 <= M.Length; t += 16)
                    {
                        float sx = new Vector3(M[t], M[t + 1], M[t + 2]).magnitude, sy = new Vector3(M[t + 4], M[t + 5], M[t + 6]).magnitude;
                        float rot = Mathf.Atan2(-M[t + 2], M[t]);
                        var p = new Vector3(-M[t + 12], M[t + 13], M[t + 14]);
                        trees.Add(new TreeInstance
                        {
                            prototypeIndex = pi,
                            position = new Vector3((p.x + Half) / Size, (p.y - hMin) / (hMax - hMin), (p.z + Half) / Size),
                            widthScale = sx, heightScale = sy, rotation = -rot,
                            color = Color.white, lightmapColor = Color.white
                        });
                    }
                }
                td.treePrototypes = protos.ToArray();
                td.SetTreeInstances(trees.ToArray(), false);
                AssetDatabase.CreateAsset(td, Gen + "/Map/IslandTerrain.asset");

                var tgo = Terrain.CreateTerrainGameObject(td);
                tgo.name = "Terrain"; tgo.transform.SetParent(world);
                tgo.transform.position = new Vector3(-Half, hMin, -Half);
                var terrain = tgo.GetComponent<Terrain>();
                terrain.treeDistance = 1500f; terrain.treeBillboardDistance = 1500f; terrain.treeMaximumFullLODCount = 2000;
                terrain.heightmapPixelError = 4f; terrain.basemapDistance = 400f; terrain.drawInstanced = true;
                tgo.isStatic = true;

                // ---- 바위 ----
                EditorUtility.DisplayProgressBar("LAST ZONE 섬", "바위 놓는 중", 0.55f);
                var rockAsset = AssetDatabase.LoadAssetAtPath<GameObject>(MapDir + "/rocks.glb");
                var rockMesh = FirstMesh(rockAsset, out var rockMat);
                if (rockMesh != null)
                {
                    var rocks = new GameObject("Rocks").transform; rocks.SetParent(world);
                    var R = ReadFloats(full(MapDir + "/rocks.bytes"));
                    for (int t = 0; t + 19 <= R.Length; t += 19)
                    {
                        var m = Mirror(R, t);
                        var g = new GameObject("rock"); g.transform.SetParent(rocks);
                        g.transform.SetPositionAndRotation(m.GetColumn(3), m.rotation); g.transform.localScale = m.lossyScale;
                        g.AddComponent<MeshFilter>().sharedMesh = rockMesh; g.AddComponent<MeshRenderer>().sharedMaterial = rockMat;
                        g.isStatic = true;
                    }
                }

                // ---- 건물 · 다리 · 소품 ----
                EditorUtility.DisplayProgressBar("LAST ZONE 섬", "건물 세우는 중", 0.65f);
                var wGlb = AssetDatabase.LoadAssetAtPath<GameObject>(MapDir + "/World/world.gltf") ?? AssetDatabase.LoadAssetAtPath<GameObject>(MapDir + "/world.glb");
                if (wGlb != null)
                {
                    var b = (GameObject)PrefabUtility.InstantiatePrefab(wGlb);
                    b.name = "Buildings"; b.transform.SetParent(world);
                    foreach (var tr in b.GetComponentsInChildren<Transform>()) tr.gameObject.isStatic = true;
                }

                // ---- 물: 바다 판 + 호수·강 수면 ----
                var waterMat = WaterMaterial();
                var sea = GameObject.CreatePrimitive(PrimitiveType.Plane);
                Object.DestroyImmediate(sea.GetComponent<Collider>());
                sea.name = "Sea"; sea.transform.SetParent(world); sea.transform.localScale = new Vector3(600f, 1f, 600f);
                sea.GetComponent<Renderer>().sharedMaterial = waterMat;
                var wtr = AssetDatabase.LoadAssetAtPath<GameObject>(MapDir + "/water.glb");
                if (wtr != null)
                {
                    var w = (GameObject)PrefabUtility.InstantiatePrefab(wtr);
                    w.name = "InlandWater"; w.transform.SetParent(world);
                    foreach (var r in w.GetComponentsInChildren<Renderer>()) { r.sharedMaterial = waterMat; r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; }
                }

                // ---- 맵 데이터 ----
                var data = AssetDatabase.LoadAssetAtPath<MapData>(Gen + "/Map/MapData.asset");
                if (data == null) { data = ScriptableObject.CreateInstance<MapData>(); AssetDatabase.CreateAsset(data, Gen + "/Map/MapData.asset"); }
                data.towns.Clear();
                foreach (var t in info.towns) data.towns.Add(new MapData.Town { name = t.name, type = t.type, r = t.r, pos = new Vector3(-t.x, 0f, t.z) });
                data.loot.Clear();
                for (int i = 0; i + 3 <= info.loot.Length; i += 3) data.loot.Add(new Vector3(-info.loot[i], info.loot[i + 1], info.loot[i + 2]));
                data.water = ReadFloats(full(MapDir + "/water.bytes"));
                data.terrainMin = hMin;
                EditorUtility.SetDirty(data);
                var mr = world.gameObject.AddComponent<MapRuntime>(); mr.data = data; mr.terrain = terrain;

                // ---- 게임 (규칙 · 화면 · HUD) ----
                EditorUtility.DisplayProgressBar("LAST ZONE 섬", "게임 붙이는 중", 0.92f);
                SetupGame(sunGo != null ? sunGo.GetComponent<Light>() : null, data, lib);

                EditorSceneManager.SaveScene(scene, ScenePath);
                PrototypeBuilder.AddToBuild(ScenePath);
                AssetDatabase.SaveAssets();
                EditorUtility.ClearProgressBar();
                EditorUtility.DisplayDialog("LAST ZONE", $"섬 맵 씬을 만들었습니다: {ScenePath}\n나무 {trees.Count}\n\n▶ 재생을 누르면 메뉴가 나옵니다.", "확인");
            }
            finally { EditorUtility.ClearProgressBar(); }
        }


        // 카메라 · 1인칭 총 · GameView · GameHud
        static void SetupGame(Light sun, MapData data, GunLibrary lib)
        {
            var camGo = new GameObject("Main Camera"); camGo.tag = "MainCamera";
            var cam = camGo.AddComponent<Camera>(); cam.nearClipPlane = 0.02f; cam.farClipPlane = 2600f; cam.fieldOfView = 75f;
            camGo.AddComponent<AudioListener>();
            var vmGo = new GameObject("ViewModel"); vmGo.transform.SetParent(camGo.transform, false);
            var vm = vmGo.AddComponent<ViewModel>(); vm.cam = cam; vm.library = lib; vm.flashMat = PrototypeBuilder.Unlit("Flash", new Color(1f, 0.82f, 0.45f));
            var go = new GameObject("Game");
            var gv = go.AddComponent<GameView>();
            gv.cam = cam; gv.library = lib; gv.mapData = data; gv.sun = sun;
            gv.heights = AssetDatabase.LoadAssetAtPath<TextAsset>(MapDir + "/heights.bytes");
            gv.water = AssetDatabase.LoadAssetAtPath<TextAsset>(MapDir + "/water.bytes");
            gv.colliders = AssetDatabase.LoadAssetAtPath<TextAsset>(MapDir + "/colliders.bytes");
            gv.mapinfo = AssetDatabase.LoadAssetAtPath<TextAsset>(MapDir + "/mapinfo.json");
            gv.charTemplate = AssetDatabase.LoadAssetAtPath<GameObject>(Root + "/Models/Char/swat.glb");
            var skins = new List<Material>();
            foreach (var v in new[] { "ranger", "black", "coyote", "grey" })
            {
                var tex = AssetDatabase.LoadAssetAtPath<Texture2D>($"{Root}/Models/Char/swat_{v}.png");
                var nPath = $"{Root}/Models/Char/swat_nor.png";
                var imp = AssetImporter.GetAtPath(nPath) as TextureImporter;
                if (imp != null && imp.textureType != TextureImporterType.NormalMap) { imp.textureType = TextureImporterType.NormalMap; imp.SaveAndReimport(); }
                var m = PrototypeBuilder.Mat("Swat_" + v, Color.white, tex, Vector2.one);
                var nor = AssetDatabase.LoadAssetAtPath<Texture2D>(nPath);
                if (nor != null && m.HasProperty("_BumpMap")) { m.SetTexture("_BumpMap", nor); m.EnableKeyword("_NORMALMAP"); }
                skins.Add(m);
            }
            gv.charSkins = skins.ToArray();
            gv.vehicleTemplates = new GameObject[Vehicles.Kinds.Length];
            for (int i = 0; i < Vehicles.Kinds.Length; i++) gv.vehicleTemplates[i] = AssetDatabase.LoadAssetAtPath<GameObject>($"{Root}/Models/Vehicles/{Vehicles.Kinds[i]}.glb");
            gv.throwTemplates = new GameObject[Data.ThrowOrder.Length];
            for (int i = 0; i < Data.ThrowOrder.Length; i++) gv.throwTemplates[i] = AssetDatabase.LoadAssetAtPath<GameObject>($"{Root}/Models/Throwables/{Data.ThrowOrder[i]}.glb");
            gv.zoneMat = TransparentMat("Zone", new Color(0.25f, 0.6f, 1f, 0.22f));
            gv.chuteMat = PrototypeBuilder.Mat("Chute", new Color(0.91f, 0.45f, 0.16f));
            gv.crateMat = PrototypeBuilder.Mat("Crate", new Color(0.48f, 0.12f, 0.1f));
            gv.lootMat = PrototypeBuilder.Mat("Loot", Color.white);
            gv.darkMat = PrototypeBuilder.Mat("Dark", new Color(0.17f, 0.18f, 0.19f));
            gv.gongMat = PrototypeBuilder.Mat("Gong", new Color(0.91f, 0.89f, 0.83f));
            gv.targetMat = CutoutMat("Silhouette", SilTex(false));
            gv.civMat = CutoutMat("SilhouetteCiv", SilTex(true));
            var hud = go.AddComponent<GameHud>(); hud.game = gv; hud.mapTex = MapTexture();
        }

        static Material TransparentMat(string name, Color c)
        {
            var m = PrototypeBuilder.Mat(name, c);
            if (m.HasProperty("_Surface"))
            {
                m.SetFloat("_Surface", 1); m.SetFloat("_Blend", 0); m.SetOverrideTag("RenderType", "Transparent");
                m.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha); m.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha); m.SetInt("_ZWrite", 0);
                m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT"); m.renderQueue = 3000;
                if (m.HasProperty("_Cull")) m.SetFloat("_Cull", 0);
            }
            EditorUtility.SetDirty(m);
            return m;
        }
        static Material CutoutMat(string name, Texture2D tex)
        {
            var m = PrototypeBuilder.Mat(name, Color.white, tex, Vector2.one);
            if (m.HasProperty("_AlphaClip")) { m.SetFloat("_AlphaClip", 1); m.SetFloat("_Cutoff", 0.5f); m.EnableKeyword("_ALPHATEST_ON"); }
            EditorUtility.SetDirty(m);
            return m;
        }
        // 사람 모양 과녁 그림 (가로 0.6 m · 세로 1.8 m)
        static Texture2D SilTex(bool civ)
        {
            string path = $"{Gen}/Map/{(civ ? "SilCiv" : "Sil")}.asset";
            var have = AssetDatabase.LoadAssetAtPath<Texture2D>(path); if (have != null) return have;
            const int W = 128, H = 384; var t = new Texture2D(W, H, TextureFormat.RGBA32, true);
            float sx = W / 0.6f, sy = H / 1.8f;
            var fill = civ ? new Color(0.56f, 0.7f, 0.84f) : new Color(0.78f, 0.64f, 0.43f); var edge = civ ? new Color(0.18f, 0.29f, 0.4f) : new Color(0.36f, 0.27f, 0.15f);
            bool In(float x, float y)
            {
                if (x * x + (y - 1.62f) * (y - 1.62f) <= 0.12f * 0.12f) return true;
                if (x >= -0.27f && x <= 0.27f && y >= 0.86f && y <= 1.47f) return true;
                if (x >= -0.06f && x <= 0.06f && y >= 1.44f && y <= 1.52f) return true;
                return x >= -0.19f && x <= 0.19f && y >= 0.06f && y <= 0.87f;
            }
            for (int py = 0; py < H; py++) for (int px = 0; px < W; px++)
                {
                    float x = px / sx - 0.3f, y = py / sy;
                    bool inside = In(x, y), border = inside && (!In(x + 0.012f, y) || !In(x - 0.012f, y) || !In(x, y + 0.012f) || !In(x, y - 0.012f));
                    bool zone = inside && ((Mathf.Abs(x) < 0.11f && Mathf.Abs(y - 1.21f) < 0.15f && (Mathf.Abs(Mathf.Abs(x) - 0.11f) < 0.006f || Mathf.Abs(Mathf.Abs(y - 1.21f) - 0.15f) < 0.006f)));
                    t.SetPixel(px, py, !inside ? Color.clear : border || zone ? edge : fill);
                }
            t.Apply(true);
            AssetDatabase.CreateAsset(t, path);
            return t;
        }
        static Texture2D MapTexture()
        {
            string path = Gen + "/Map/MapColor.asset";
            var have = AssetDatabase.LoadAssetAtPath<Texture2D>(path); if (have != null) return have;
            var t = LoadPng(Path.Combine(Directory.GetCurrentDirectory(), MapDir + "/color_png.bytes"));
            var o = new Texture2D(t.width, t.height, TextureFormat.RGB24, true); o.SetPixels32(t.GetPixels32()); o.Apply(true);
            AssetDatabase.CreateAsset(o, path);
            return o;
        }

        // ---------------- 도우미 ----------------
        static float[] ReadFloats(string path)
        {
            var b = File.ReadAllBytes(path); var f = new float[b.Length / 4];
            System.Buffer.BlockCopy(b, 0, f, 0, f.Length * 4);
            return f;
        }

        static Texture2D LoadPng(string path)
        {
            var t = new Texture2D(2, 2, TextureFormat.RGBA32, false, true);
            t.LoadImage(File.ReadAllBytes(path));
            return t;
        }

        // 웹판 열 우선 4×4 행렬 → 유니티 (x 뒤집기: S·M·S)
        static Matrix4x4 Mirror(float[] a, int o)
        {
            var m = new Matrix4x4();
            for (int c = 0; c < 4; c++) for (int r = 0; r < 4; r++) m[r, c] = a[o + c * 4 + r];
            var S = Matrix4x4.Scale(new Vector3(-1f, 1f, 1f));
            return S * m * S;
        }

        // 웹판 지형 셰이더처럼: 사진 텍스처를 평균색으로 나누고 겹마다 기준색(ref)을 곱한다 → diffuseRemapMax 로 색 맞춤
        static TerrainLayer Layer(string name, string tex, float tile, Color32 refC)
        {
            string path = $"{Gen}/Map/L_{name}.terrainlayer";
            var l = AssetDatabase.LoadAssetAtPath<TerrainLayer>(path);
            if (l == null) { l = new TerrainLayer(); AssetDatabase.CreateAsset(l, path); }
            l.diffuseTexture = AssetDatabase.LoadAssetAtPath<Texture2D>($"{MapDir}/Tex/{tex}_diff_1k.jpg");
            var nPath = $"{MapDir}/Tex/{tex}_nor_gl_1k.jpg";
            var imp = AssetImporter.GetAtPath(nPath) as TextureImporter;
            if (imp != null && imp.textureType != TextureImporterType.NormalMap) { imp.textureType = TextureImporterType.NormalMap; imp.SaveAndReimport(); }
            l.normalMapTexture = AssetDatabase.LoadAssetAtPath<Texture2D>(nPath);
            l.tileSize = new Vector2(tile, tile);
            var src = LoadPng(Path.Combine(Directory.GetCurrentDirectory(), $"{MapDir}/Tex/{tex}_diff_1k.jpg"));
            var px = src.GetPixels32(); double mr = 0, mg = 0, mb = 0;
            for (int i = 0; i < px.Length; i += 7) { mr += Lin(px[i].r); mg += Lin(px[i].g); mb += Lin(px[i].b); }
            int cnt = (px.Length + 6) / 7; mr /= cnt; mg /= cnt; mb /= cnt;
            l.diffuseRemapMin = Vector4.zero;
            l.diffuseRemapMax = new Vector4((float)(Lin(refC.r) / mr), (float)(Lin(refC.g) / mg), (float)(Lin(refC.b) / mb), 1f);
            l.smoothness = 0.05f; l.metallic = 0f;
            EditorUtility.SetDirty(l);
            return l;
        }

        static double Lin(byte c) { double v = c / 255.0; return v <= 0.04045 ? v / 12.92 : System.Math.Pow((v + 0.055) / 1.055, 2.4); }

        static Mesh FirstMesh(GameObject go, out Material mat)
        {
            mat = null;
            if (go == null) return null;
            var mf = go.GetComponentInChildren<MeshFilter>(true);
            if (mf == null) return null;
            var r = mf.GetComponent<MeshRenderer>(); if (r != null) mat = r.sharedMaterial;
            return mf.sharedMesh;
        }

        // 나무 변형 glb (bark · leaf · impostor) → LODGroup 프리팹
        static GameObject TreePrefab(string name)
        {
            var src = AssetDatabase.LoadAssetAtPath<GameObject>($"{MapDir}/{name}.glb");
            if (src == null) return null;
            PrototypeBuilder.Folder(Gen + "/Map", "Trees");
            var root = new GameObject(name);
            var near = new List<Renderer>(); var far = new List<Renderer>();
            foreach (var mf in src.GetComponentsInChildren<MeshFilter>(true))
            {
                var g = new GameObject(mf.name); g.transform.SetParent(root.transform, false);
                g.AddComponent<MeshFilter>().sharedMesh = mf.sharedMesh;
                var r = g.AddComponent<MeshRenderer>(); r.sharedMaterials = mf.GetComponent<MeshRenderer>().sharedMaterials;
                if (mf.name.Contains("impostor")) { far.Add(r); r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; }
                else near.Add(r);
            }
            var lg = root.AddComponent<LODGroup>();
            var lods = new List<LOD> { new LOD(0.06f, near.ToArray()) };
            if (far.Count > 0) lods.Add(new LOD(0.004f, far.ToArray()));
            lg.SetLODs(lods.ToArray()); lg.RecalculateBounds();
            var prefab = PrefabUtility.SaveAsPrefabAsset(root, $"{Gen}/Map/Trees/{name}.prefab");
            Object.DestroyImmediate(root);
            return prefab;
        }

        static Material WaterMaterial()
        {
            string path = Gen + "/Map/Water.mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (m == null) { m = new Material(PrototypeBuilder.LitShader()); AssetDatabase.CreateAsset(m, path); }
            var c = new Color(0.16f, 0.32f, 0.36f, 0.82f);
            m.SetColor("_BaseColor", c); m.color = c;
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", 0.92f);
            if (m.HasProperty("_Surface"))
            {
                m.SetFloat("_Surface", 1f); m.SetFloat("_Blend", 0f);
                m.SetOverrideTag("RenderType", "Transparent");
                m.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
                m.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                m.SetInt("_ZWrite", 0);
                m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
                m.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
            }
            EditorUtility.SetDirty(m);
            return m;
        }
    }
}
