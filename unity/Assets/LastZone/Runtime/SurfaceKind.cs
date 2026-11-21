using UnityEngine;

namespace LastZone
{
    // 충돌체 재질 (총알 자국·소리 구분): 웹판 box.mat
    public class SurfaceKind : MonoBehaviour
    {
        public enum Kind { Hard, Wood, Metal, Soft, Glass, Water }
        public Kind kind;
    }
}
