using UnityEngine;

namespace LastZone
{
    // 맵에 MapData 를 걸어 두면 Current 로 쓸 수 있게
    public class MapRuntime : MonoBehaviour
    {
        public MapData data;
        public Terrain terrain;
        public static MapRuntime I;
        void Awake() { I = this; MapData.Current = data; }

        public float HeightAt(float x, float z) => terrain != null ? terrain.SampleHeight(new Vector3(x, 0f, z)) + terrain.transform.position.y : 0f;
    }
}
