using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace LastZone
{
    // 새 입력 시스템(Input System 패키지)과 예전 입력 관리자 둘 다에서 돌아가게 감싼다
    public enum K { W, A, S, D, Space, LeftShift, LeftCtrl, C, R, B, T, F1, F2, F3, F4, Escape, Alpha1, Alpha2, Alpha3, Up, Down }

    public static class LZInput
    {
        // 마우스 이동 (픽셀)
        public static Vector2 MouseDelta()
        {
#if ENABLE_INPUT_SYSTEM
            var m = Mouse.current;
            return m != null ? m.delta.ReadValue() : Vector2.zero;
#else
            return new Vector2(Input.GetAxisRaw("Mouse X"), Input.GetAxisRaw("Mouse Y")) * 10f;
#endif
        }

        public static float Scroll()
        {
#if ENABLE_INPUT_SYSTEM
            var m = Mouse.current;
            return m != null ? m.scroll.ReadValue().y : 0f;   // 부호만 쓴다 (기기마다 한 칸 값이 1 또는 120)
#else
            return Input.mouseScrollDelta.y;
#endif
        }

        public static bool FireHeld()
        {
#if ENABLE_INPUT_SYSTEM
            return Mouse.current != null && Mouse.current.leftButton.isPressed;
#else
            return Input.GetMouseButton(0);
#endif
        }

        public static bool FirePressed()
        {
#if ENABLE_INPUT_SYSTEM
            return Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame;
#else
            return Input.GetMouseButtonDown(0);
#endif
        }

        public static bool AimHeld()
        {
#if ENABLE_INPUT_SYSTEM
            return Mouse.current != null && Mouse.current.rightButton.isPressed;
#else
            return Input.GetMouseButton(1);
#endif
        }

        public static bool Held(K k)
        {
#if ENABLE_INPUT_SYSTEM
            var kb = Keyboard.current;
            return kb != null && kb[Map(k)].isPressed;
#else
            return Input.GetKey(Map(k));
#endif
        }

        public static bool Down(K k)
        {
#if ENABLE_INPUT_SYSTEM
            var kb = Keyboard.current;
            return kb != null && kb[Map(k)].wasPressedThisFrame;
#else
            return Input.GetKeyDown(Map(k));
#endif
        }

        public static Vector2 Move()
        {
            var v = new Vector2((Held(K.D) ? 1f : 0f) - (Held(K.A) ? 1f : 0f), (Held(K.W) ? 1f : 0f) - (Held(K.S) ? 1f : 0f));
            return v.sqrMagnitude > 1f ? v.normalized : v;
        }

#if ENABLE_INPUT_SYSTEM
        static Key Map(K k)
        {
            switch (k)
            {
                case K.W: return Key.W;
                case K.A: return Key.A;
                case K.S: return Key.S;
                case K.D: return Key.D;
                case K.Space: return Key.Space;
                case K.LeftShift: return Key.LeftShift;
                case K.LeftCtrl: return Key.LeftCtrl;
                case K.C: return Key.C;
                case K.R: return Key.R;
                case K.B: return Key.B;
                case K.T: return Key.T;
                case K.F1: return Key.F1;
                case K.F2: return Key.F2;
                case K.F3: return Key.F3;
                case K.F4: return Key.F4;
                case K.Escape: return Key.Escape;
                case K.Alpha1: return Key.Digit1;
                case K.Alpha2: return Key.Digit2;
                case K.Alpha3: return Key.Digit3;
                case K.Up: return Key.UpArrow;
                default: return Key.DownArrow;
            }
        }
#else
        static KeyCode Map(K k)
        {
            switch (k)
            {
                case K.W: return KeyCode.W;
                case K.A: return KeyCode.A;
                case K.S: return KeyCode.S;
                case K.D: return KeyCode.D;
                case K.Space: return KeyCode.Space;
                case K.LeftShift: return KeyCode.LeftShift;
                case K.LeftCtrl: return KeyCode.LeftControl;
                case K.C: return KeyCode.C;
                case K.R: return KeyCode.R;
                case K.B: return KeyCode.B;
                case K.T: return KeyCode.T;
                case K.F1: return KeyCode.F1;
                case K.F2: return KeyCode.F2;
                case K.F3: return KeyCode.F3;
                case K.F4: return KeyCode.F4;
                case K.Escape: return KeyCode.Escape;
                case K.Alpha1: return KeyCode.Alpha1;
                case K.Alpha2: return KeyCode.Alpha2;
                case K.Alpha3: return KeyCode.Alpha3;
                case K.Up: return KeyCode.UpArrow;
                default: return KeyCode.DownArrow;
            }
        }
#endif
    }
}
