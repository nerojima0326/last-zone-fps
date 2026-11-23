using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 총알: 탄속·중력으로 날아가며 프레임마다 구간 레이캐스트 (웹판 weapons.js Ballistics 와 같은 방식)
    public class Ballistics : MonoBehaviour
    {
        public static Ballistics I;
        public LayerMask hitMask = Physics.DefaultRaycastLayers;   // 플레이어는 Ignore Raycast 층이라 맞지 않는다
        public Material tracerMat, impactMat;

        class Bullet
        {
            public Vector3 pos, vel, visOff;
            public GunDef def;
            public float dist, life;
            public LineRenderer tracer;
        }

        readonly List<Bullet> list = new List<Bullet>();
        readonly Stack<LineRenderer> tracerPool = new Stack<LineRenderer>();
        readonly List<Transform> impacts = new List<Transform>();
        int impactNext;
        public int shots, hits;

        void Awake() { I = this; }

        public void Fire(Vector3 origin, Vector3 dir, GunDef def, Vector3 muzzle, bool tracer)
        {
            var b = new Bullet { pos = origin, vel = dir * def.vel * Random.Range(0.97f, 1.03f), def = def, visOff = muzzle - origin };
            if (tracer) b.tracer = GetTracer();
            list.Add(b);
        }

        LineRenderer GetTracer()
        {
            LineRenderer lr;
            if (tracerPool.Count > 0) { lr = tracerPool.Pop(); lr.gameObject.SetActive(true); return lr; }
            var go = new GameObject("Tracer");
            go.transform.SetParent(transform, false);
            lr = go.AddComponent<LineRenderer>();
            lr.positionCount = 2;
            lr.useWorldSpace = true;
            lr.material = tracerMat;
            lr.startWidth = 0.025f; lr.endWidth = 0.006f;
            lr.startColor = new Color(1f, 0.85f, 0.55f, 0.95f); lr.endColor = new Color(1f, 0.6f, 0.25f, 0f);
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            lr.receiveShadows = false;
            return lr;
        }

        void Free(Bullet b)
        {
            if (b.tracer != null) { b.tracer.gameObject.SetActive(false); tracerPool.Push(b.tracer); b.tracer = null; }
        }

        void Update()
        {
            float dt = Time.deltaTime;
            for (int i = list.Count - 1; i >= 0; i--)
            {
                var b = list[i];
                b.life += dt;
                b.vel.y -= 9.8f * dt;
                Vector3 step = b.vel * dt;
                float L = step.magnitude;
                Vector3 d = step / Mathf.Max(L, 1e-6f);
                bool done = false;
                if (Physics.Raycast(b.pos, d, out RaycastHit hit, L, hitMask, QueryTriggerInteraction.Ignore))
                {
                    b.dist += hit.distance;
                    OnImpact(b, hit);
                    b.pos = hit.point;
                    done = true;
                }
                else { b.pos += step; b.dist += L; }
                if (b.dist > b.def.range * 1.3f || b.life > 4f) done = true;

                if (b.tracer != null)
                {
                    // 총구에서 나와 조준선으로 모인다 (총알 자체는 눈에서 나간다)
                    float k = Mathf.Clamp01(1f - b.dist / 25f);
                    Vector3 head = b.pos + b.visOff * k;
                    Vector3 tail = head - d * Mathf.Min(b.def.tracerLen, b.dist);
                    b.tracer.SetPosition(0, head);
                    b.tracer.SetPosition(1, tail);
                }
                if (done) { Free(b); list.RemoveAt(i); }
            }
        }

        void OnImpact(Bullet b, RaycastHit hit)
        {
            var zone = hit.collider.GetComponent<HitZone>();
            if (zone != null && zone.target != null)
            {
                if (!zone.target.IsDown) hits++;
                float dmg = b.def.Damage(b.dist) * (zone.head ? b.def.head : 1f);
                zone.target.Hit(dmg, zone.head, b.dist);
            }
            else SpawnImpact(hit);
        }

        // 탄흔: 작은 검은 원판을 64개까지 돌려 쓴다
        void SpawnImpact(RaycastHit hit)
        {
            Transform t;
            if (impacts.Count < 64)
            {
                var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
                go.name = "Impact";
                Destroy(go.GetComponent<Collider>());
                var r = go.GetComponent<Renderer>();
                r.sharedMaterial = impactMat;
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                go.transform.SetParent(transform, false);
                go.transform.localScale = Vector3.one * 0.07f;
                t = go.transform;
                impacts.Add(t);
            }
            else { t = impacts[impactNext]; impactNext = (impactNext + 1) % impacts.Count; }
            t.position = hit.point + hit.normal * 0.004f;
            t.rotation = Quaternion.LookRotation(-hit.normal) * Quaternion.Euler(0f, 0f, Random.Range(0f, 360f));
        }
    }
}
