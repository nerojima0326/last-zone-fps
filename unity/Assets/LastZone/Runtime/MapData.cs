using System;
using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 섬 맵 데이터 (웹판 world.js 에서 구운 것): 마을 · 전리품 자리 · 물 높이 격자
    // 좌표는 모두 유니티 좌표 (웹판 x 를 뒤집은 값: unity = (-x, y, z))
    public class MapData : ScriptableObject
    {
        [Serializable] public struct Town { public string name, type; public Vector3 pos; public float r; }

        public const float Size = 1600f, Half = 800f;
        public const int Res = 512, N = Res + 1;
        const float Cell = Size / Res;

        public List<Town> towns = new List<Town>();
        public List<Vector3> loot = new List<Vector3>();
        public float[] water;          // N×N, 행 = z, 열 = 웹판 x 기준 (WaterAt 이 뒤집어 읽는다)
        public float terrainMin;

        public static MapData Current;

        // 물 높이 (바다 0, 호수·강은 수면 높이, 물이 없으면 0)
        public float WaterAt(float ux, float uz)
        {
            if (water == null || water.Length != N * N) return 0f;
            float fx = Mathf.Clamp((-ux + Half) / Cell, 0f, Res - 0.0001f), fz = Mathf.Clamp((uz + Half) / Cell, 0f, Res - 0.0001f);
            int ix = (int)fx, iz = (int)fz; float u = fx - ix, v = fz - iz; int i = iz * N + ix;
            float a = water[i], b = water[i + 1], c = water[i + N], d = water[i + N + 1];
            return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
        }

        public Town NearestTown(Vector3 p)
        {
            Town best = default; float bd = float.MaxValue;
            foreach (var t in towns) { float d = (new Vector2(t.pos.x - p.x, t.pos.z - p.z)).sqrMagnitude; if (d < bd) { bd = d; best = t; } }
            return best;
        }
    }
}
