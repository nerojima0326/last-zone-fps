using UnityEngine;

namespace LastZone
{
    // 맞으면 쓰러졌다가 다시 일어나는 사람 모양 과녁. moveAmp > 0 이면 좌우로 움직인다
    public class Target : MonoBehaviour
    {
        public float maxHp = 100f;
        public Transform pivot;                 // 발밑 축 (뒤로 넘어간다)
        public float moveAmp, moveSpeed = 1.2f;
        public float resetTime = 2.5f;

        float hp, downT = -1f, flash, phase;
        Vector3 home;
        Renderer[] rends;
        MaterialPropertyBlock mpb;
        Color[] baseCols;

        void Awake()
        {
            hp = maxHp;
            home = transform.position;
            phase = Random.value * 6.28f;
            rends = GetComponentsInChildren<Renderer>();
            mpb = new MaterialPropertyBlock();
            baseCols = new Color[rends.Length];
            for (int i = 0; i < rends.Length; i++)
            {
                var m = rends[i].sharedMaterial;
                baseCols[i] = m == null ? Color.white : m.HasProperty("_BaseColor") ? m.GetColor("_BaseColor") : m.HasProperty("_Color") ? m.color : Color.white;
            }
        }

        public bool IsDown => downT >= 0f;

        public void Hit(float dmg, bool head, float dist)
        {
            if (IsDown) return;
            hp -= dmg;
            flash = 0.12f;
            bool kill = hp <= 0f;
            if (kill) downT = 0f;
            if (Hud.I != null) Hud.I.OnHit(dmg, head, kill, dist);
        }

        void Update()
        {
            float dt = Time.deltaTime;
            if (moveAmp > 0f && !IsDown)
            {
                phase += dt * moveSpeed;
                transform.position = home + transform.right * Mathf.Sin(phase) * moveAmp;
            }
            float fall = 0f;
            if (IsDown)
            {
                downT += dt;
                fall = downT < resetTime ? Mathf.Clamp01(downT / 0.22f) : Mathf.Clamp01(1f - (downT - resetTime) / 0.35f);
                if (downT > resetTime + 0.35f) { downT = -1f; hp = maxHp; fall = 0f; }
            }
            if (pivot != null) pivot.localRotation = Quaternion.Euler(-85f * fall * fall * (3f - 2f * fall), 0f, 0f);

            flash = Mathf.Max(0f, flash - dt);
            float f = flash / 0.12f;
            for (int i = 0; i < rends.Length; i++)
            {
                rends[i].GetPropertyBlock(mpb);
                Color c = Color.Lerp(baseCols[i], new Color(1f, 0.25f, 0.2f), f);
                mpb.SetColor("_BaseColor", c);
                mpb.SetColor("_Color", c);
                rends[i].SetPropertyBlock(mpb);
            }
        }
    }
}
