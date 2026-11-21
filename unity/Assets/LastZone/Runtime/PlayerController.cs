using UnityEngine;

namespace LastZone
{
    // 1인칭 이동·시선 (웹판 player.js 의 값: 걷기 4.6 · 달리기 6.8 · 앉기 2.3 m/s, 점프 7.2 m/s, 조준 중 0.62배)
    [RequireComponent(typeof(CharacterController))]
    [DefaultExecutionOrder(-50)]   // 무기보다 먼저: 쏘는 순간의 시선이 이번 프레임 값이 되게
    public class PlayerController : MonoBehaviour
    {
        public Transform head;                 // 카메라가 달린 머리
        public Camera cam;
        [Range(0.1f, 5f)] public float sensitivity = 1f;
        public float baseFov = 75f;
        public float walkSpeed = 4.6f, sprintSpeed = 6.8f, crouchSpeed = 2.3f, jumpSpeed = 7.2f, gravity = 22f;
        public float standEye = 1.62f, crouchEye = 1.12f;

        [HideInInspector] public float yaw, pitch;          // 라디안 (pitch + = 위)
        [HideInInspector] public float kickPitch;           // 사격 반동으로 잠깐 튀는 시선 (조준점도 함께 움직인다)
        [HideInInspector] public float ads;                 // 무기 쪽에서 넣어 준다 (0~1)
        [HideInInspector] public bool sprinting, crouching, grounded, blockSprint;
        [HideInInspector] public float speed01;             // 수평 속도 / 걷기 속도
        [HideInInspector] public float stepPhase;           // 걸음 흔들림 위상

        CharacterController cc;
        Vector3 vel;
        float eye;

        void Awake()
        {
            cc = GetComponent<CharacterController>();
            yaw = transform.eulerAngles.y * Mathf.Deg2Rad;
            eye = standEye;
        }

        // 시작할 땐 잡지 않는다: 첫 클릭은 '마우스 잡기'로만 쓰이고 총은 쏘지 않게
        void Start() { LockCursor(false); }

        // 마우스를 잡는 순간 커서가 가운데로 순간 이동하며 큰 이동량이 들어온다 → 잡은 뒤 몇 프레임은 시선·사격을 무시
        public static int lockFrame = -100;

        public static void LockCursor(bool on)
        {
            if (on && Cursor.lockState != CursorLockMode.Locked) lockFrame = Time.frameCount;
            Cursor.lockState = on ? CursorLockMode.Locked : CursorLockMode.None;
            Cursor.visible = !on;
        }

        // 에디터에선 재생 시작 때 이미 '잠김' 상태라, 게임 화면을 처음 클릭하는 순간 포커스만 바뀐다 → 그때도 몇 프레임 무시
        void OnApplicationFocus(bool f) { if (f) lockFrame = Time.frameCount; }

        void Update()
        {
            if (!Application.isFocused) lockFrame = Time.frameCount;
            float dt = Time.deltaTime;
            if (LZInput.Down(K.Escape)) LockCursor(false);
            if (Cursor.lockState != CursorLockMode.Locked && LZInput.FirePressed()) LockCursor(true);
            bool locked = Cursor.lockState == CursorLockMode.Locked;

            // ---- 시선 ----
            if (locked && Time.frameCount - lockFrame > 3)
            {
                Vector2 md = LZInput.MouseDelta();
                float k = 0.0022f * sensitivity * Mathf.Lerp(1f, 0.75f, ads);   // 조준 중엔 조금 느리게
                yaw += md.x * k;
                pitch = Mathf.Clamp(pitch + md.y * k, -1.45f, 1.45f);
            }
            kickPitch = Mathf.Lerp(kickPitch, 0f, 1f - Mathf.Exp(-12f * dt));
            transform.rotation = Quaternion.Euler(0f, yaw * Mathf.Rad2Deg, 0f);
            ApplyHead();

            // ---- 이동 ----
            Vector2 mv = locked ? LZInput.Move() : Vector2.zero;
            crouching = locked && (LZInput.Held(K.LeftCtrl) || LZInput.Held(K.C));
            sprinting = locked && LZInput.Held(K.LeftShift) && mv.y > 0.1f && ads < 0.3f && !crouching && !blockSprint;
            float speed = sprinting ? sprintSpeed : crouching ? crouchSpeed : walkSpeed;
            if (ads > 0.5f) speed *= 0.62f;
            Vector3 want = (transform.right * mv.x + transform.forward * mv.y) * speed;
            grounded = cc.isGrounded;
            float accel = grounded ? 14f : 3f;
            vel.x = Mathf.Lerp(vel.x, want.x, 1f - Mathf.Exp(-accel * dt));
            vel.z = Mathf.Lerp(vel.z, want.z, 1f - Mathf.Exp(-accel * dt));
            if (grounded)
            {
                vel.y = -2f;
                if (locked && LZInput.Down(K.Space) && !crouching) vel.y = jumpSpeed;
            }
            else vel.y -= gravity * dt;
            cc.Move(vel * dt);

            float hs = new Vector2(vel.x, vel.z).magnitude;
            speed01 = hs / walkSpeed;
            if (grounded) stepPhase += hs * dt * 1.9f;

            // ---- 앉기 (캡슐 높이·눈높이) ----
            float h = crouching ? 1.25f : 1.8f;
            cc.height = Mathf.Lerp(cc.height, h, 1f - Mathf.Exp(-12f * dt));
            cc.center = new Vector3(0f, cc.height * 0.5f, 0f);
            eye = Mathf.Lerp(eye, crouching ? crouchEye : standEye, 1f - Mathf.Exp(-12f * dt));
            head.localPosition = new Vector3(0f, eye, 0f);
        }

        void LateUpdate() { ApplyHead(); }

        void ApplyHead() { head.localRotation = Quaternion.Euler(-(pitch + kickPitch) * Mathf.Rad2Deg, 0f, 0f); }

        // 반동: 시선을 실제로 올린다 (웹판처럼 쏘다 멈추면 조금 내려온다)
        public void AddRecoil(float v, float h)
        {
            pitch = Mathf.Min(1.45f, pitch + v);
            yaw += h;
        }
    }
}
