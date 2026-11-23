using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 총마다의 모델·소리. 'LAST ZONE > 프로토타입 씬 만들기' 메뉴가 Models/, Audio/ 폴더에서 채운다
    [CreateAssetMenu(menuName = "LAST ZONE/Gun Library")]
    public class GunLibrary : ScriptableObject
    {
        [System.Serializable]
        public class Entry
        {
            public string id;
            public GameObject model;           // glTFast 로 가져온 .glb (없으면 상자 모양 대체 총)
            public AudioClip shot0, shot1;     // 내 총 소리 (번갈아)
            public AudioClip magout, magin, open, close, dry, shell, port, up, down, near, far;
        }

        public List<Entry> entries = new List<Entry>();
        public AudioClip switchClip;

        public Entry Get(string id)
        {
            foreach (var e in entries) if (e.id == id) return e;
            return null;
        }
    }
}
