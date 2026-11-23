using System;
using System.Collections.Generic;
using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace LastZone
{
    // 게임 입력 (웹판 Input + Settings 키 설정): 키는 웹판과 같은 코드 이름("KeyW", "ShiftLeft", "Digit1"...)
    //  동작 이름 → 키 코드 표(binds)로 다시 지정할 수 있다
    public static class GameInput
    {
        public static float mdx, mdy, wheel;
        public static bool lmb, rmb, lmbHit, rmbHit, locked, enabled = true;

        public static readonly Dictionary<string, string> defaults = new Dictionary<string, string>
        {
            { "forward", "KeyW" }, { "back", "KeyS" }, { "left", "KeyA" }, { "right", "KeyD" }, { "jump", "Space" }, { "sprint", "ShiftLeft" },
            { "crouch", "KeyC" }, { "prone", "KeyZ" }, { "leanL", "KeyQ" }, { "leanR", "KeyE" }, { "reload", "KeyR" }, { "use", "KeyF" },
            { "heal", "KeyH" }, { "map", "KeyM" }, { "grenade", "KeyG" }, { "fireMode", "KeyB" }, { "scope", "KeyV" }, { "light", "KeyL" },
            { "slot1", "Digit1" }, { "slot2", "Digit2" }, { "slot3", "Digit3" }, { "slot4", "Digit4" }, { "inventory", "Tab" }
        };
        public static readonly Dictionary<string, string> binds = new Dictionary<string, string>(defaults);
        public static readonly Dictionary<string, string> actionNames = new Dictionary<string, string>
        {
            { "forward", "앞으로" }, { "back", "뒤로" }, { "left", "왼쪽" }, { "right", "오른쪽" }, { "jump", "점프 · 넘기" }, { "sprint", "달리기 · 숨 참기" },
            { "crouch", "앉기" }, { "prone", "엎드리기" }, { "leanL", "왼쪽 기울이기" }, { "leanR", "오른쪽 기울이기" }, { "reload", "재장전" }, { "use", "줍기 · 탑승 · 강하" },
            { "heal", "치료" }, { "map", "지도" }, { "grenade", "빠른 투척" }, { "fireMode", "사격 모드" }, { "scope", "조준경 교체" }, { "light", "손전등" },
            { "slot1", "소총" }, { "slot2", "산탄총" }, { "slot3", "권총" }, { "slot4", "투척무기" }, { "inventory", "부착물" }
        };

        public static string Code(string action) => binds.TryGetValue(action, out var c) ? c : action;
        public static string Label(string action)
        {
            string c = Code(action);
            if (c.StartsWith("Key")) return c.Substring(3);
            if (c.StartsWith("Digit")) return c.Substring(5);
            switch (c) { case "ShiftLeft": return "Shift"; case "ControlLeft": return "Ctrl"; case "Space": return "Space"; case "Tab": return "Tab"; }
            return c;
        }

        // 매 프레임 처음에 (Match 보다 먼저)
        public static void Poll()
        {
            locked = Cursor.lockState == CursorLockMode.Locked && Time.frameCount - PlayerController.lockFrame > 3;
            if (!locked || !enabled) { mdx = mdy = wheel = 0; lmb = rmb = lmbHit = rmbHit = false; return; }
#if ENABLE_INPUT_SYSTEM
            var m = Mouse.current;
            if (m != null)
            {
                var d = m.delta.ReadValue(); mdx = d.x; mdy = -d.y;
                float s = m.scroll.ReadValue().y; wheel = s > 0 ? -1 : s < 0 ? 1 : 0;
                lmb = m.leftButton.isPressed; rmb = m.rightButton.isPressed;
                lmbHit = m.leftButton.wasPressedThisFrame; rmbHit = m.rightButton.wasPressedThisFrame;
            }
#else
            mdx = Input.GetAxisRaw("Mouse X") * 10f; mdy = -Input.GetAxisRaw("Mouse Y") * 10f;
            float s = Input.mouseScrollDelta.y; wheel = s > 0 ? -1 : s < 0 ? 1 : 0;
            lmb = Input.GetMouseButton(0); rmb = Input.GetMouseButton(1); lmbHit = Input.GetMouseButtonDown(0); rmbHit = Input.GetMouseButtonDown(1);
#endif
        }

        // 동작 이름 또는 키 코드
        public static bool Down(string actionOrCode) => locked && enabled && RawDown(Code(actionOrCode));
        public static bool Hit(string actionOrCode) => locked && enabled && RawHit(Code(actionOrCode));

        public static bool RawDown(string code)
        {
#if ENABLE_INPUT_SYSTEM
            var kb = Keyboard.current; if (kb == null) return false;
            var k = ToKey(code); return k != Key.None && kb[k].isPressed;
#else
            var k = ToKeyCode(code); return k != KeyCode.None && Input.GetKey(k);
#endif
        }
        public static bool RawHit(string code)
        {
#if ENABLE_INPUT_SYSTEM
            var kb = Keyboard.current; if (kb == null) return false;
            var k = ToKey(code); return k != Key.None && kb[k].wasPressedThisFrame;
#else
            var k = ToKeyCode(code); return k != KeyCode.None && Input.GetKeyDown(k);
#endif
        }

        static readonly Dictionary<string, object> cache = new Dictionary<string, object>();
        static string Name(string code)
        {
            if (code.StartsWith("Key")) return code.Substring(3);
            switch (code) { case "ShiftLeft": return "LeftShift"; case "ShiftRight": return "RightShift"; case "ControlLeft": return "LeftCtrl"; case "AltLeft": return "LeftAlt"; case "Enter": return "Enter"; }
            return code;
        }
#if ENABLE_INPUT_SYSTEM
        static Key ToKey(string code)
        {
            if (cache.TryGetValue(code, out var o)) return (Key)o;
            Key k = Key.None;
            try { Enum.TryParse(Name(code), out k); } catch { }
            cache[code] = k; return k;
        }
        // 키 설정 화면: 지금 눌린 키의 코드
        public static string AnyKeyCode()
        {
            var kb = Keyboard.current; if (kb == null) return null;
            foreach (var kc in kb.allKeys) if (kc.wasPressedThisFrame) return FromName(kc.keyCode.ToString());
            return null;
        }
#else
        static KeyCode ToKeyCode(string code)
        {
            if (cache.TryGetValue(code, out var o)) return (KeyCode)o;
            string n = Name(code);
            if (code.StartsWith("Digit")) n = "Alpha" + code.Substring(5);
            if (n == "LeftCtrl") n = "LeftControl"; if (n == "Enter") n = "Return";
            KeyCode k = KeyCode.None;
            try { Enum.TryParse(n, out k); } catch { }
            cache[code] = k; return k;
        }
        public static string AnyKeyCode()
        {
            foreach (KeyCode k in Enum.GetValues(typeof(KeyCode))) if (k != KeyCode.None && (int)k < 323 && Input.GetKeyDown(k)) { var s = k.ToString(); if (s.StartsWith("Alpha")) return "Digit" + s.Substring(5); if (s == "LeftControl") return "ControlLeft"; return FromName(s); }
            return null;
        }
#endif
        static string FromName(string n)
        {
            if (n.Length == 1) return "Key" + n.ToUpperInvariant();
            switch (n) { case "LeftShift": return "ShiftLeft"; case "RightShift": return "ShiftRight"; case "LeftCtrl": return "ControlLeft"; case "LeftAlt": return "AltLeft"; }
            return n;
        }

        public static void Load()
        {
            foreach (var kv in defaults) binds[kv.Key] = PlayerPrefs.GetString("lz_key_" + kv.Key, kv.Value);
        }
        public static void Save() { foreach (var kv in binds) PlayerPrefs.SetString("lz_key_" + kv.Key, kv.Value); PlayerPrefs.Save(); }
    }
}
