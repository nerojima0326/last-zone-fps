using System;
using System.Collections.Generic;
using UnityEngine;

namespace LastZone
{
    // 게임 규칙·물리는 웹판과 똑같이 '웹 좌표'(오른손 좌표, x 오른쪽 · y 위 · 정면 -z)에서 돈다.
    // 화면에 그릴 때만 유니티 좌표로 바꾼다: unity = (-x, y, z)
    public static class Conv
    {
        public static Vector3 U(Vector3 w) => new Vector3(-w.x, w.y, w.z);
        public static Vector3 W(Vector3 u) => new Vector3(-u.x, u.y, u.z);
        // 웹 yaw/pitch (yaw 0 = -z 방향, 왼쪽으로 돌면 +) → 유니티 회전
        public static Quaternion Look(float yaw, float pitch, float roll = 0f)
        {
            float cp = Mathf.Cos(pitch);
            var f = U(new Vector3(-Mathf.Sin(yaw) * cp, Mathf.Sin(pitch), -Mathf.Cos(yaw) * cp));
            var q = Quaternion.LookRotation(f, Vector3.up);
            return roll != 0f ? q * Quaternion.Euler(0f, 0f, roll * Mathf.Rad2Deg) : q;
        }
        // 웹 yaw 를 유니티 Y 회전(도)으로 (몸통용)
        public static float YawDeg(float yaw) => 180f - yaw * Mathf.Rad2Deg;
    }

    public enum SurfMat : byte { Hard, Wood, Metal, Soft, Glass, Water, Terrain, Flesh }

    public sealed class Box
    {
        public float minX, minY, minZ, maxX, maxY, maxZ;
        public SurfMat mat;
        public int stamp;
        public List<List<Box>> cells;   // 움직이는 상자(차량 등)
        public object tag;
    }

    public struct Hit
    {
        public float t; public Box box; public SurfMat mat; public Vector3 point, normal;
    }

    // 웹판 world.js 의 지형·충돌 질의 (heightAt · waterAt · queryBoxes · rayBoxes · rayTerrain · raycast · los · ground · covered)
    public static class World
    {
        public const float SIZE = 1600f, HALF = 800f, CELL = SIZE / RES, GCELL = 10f, WATER = 0f;
        public const int RES = 512, N = RES + 1, GN = 160;
        public static float[] heights, waterH;
        public static List<Box> boxes = new List<Box>();
        static List<Box>[] grid;
        static int stamp;
        public static Hit hit;
        public static SurfMat gmat;
        public static bool Ready => heights != null;

        public static void Load(byte[] h, byte[] w, byte[] cols)
        {
            heights = Floats(h); waterH = Floats(w);
            grid = new List<Box>[GN * GN];
            for (int i = 0; i < grid.Length; i++) grid[i] = new List<Box>(4);
            boxes.Clear();
            var c = Floats(cols);
            for (int t = 0; t + 7 <= c.Length; t += 7)
                AddCollider(c[t], c[t + 1], c[t + 2], c[t + 3], c[t + 4], c[t + 5], (SurfMat)(int)c[t + 6]);
        }

        static float[] Floats(byte[] b) { var f = new float[b.Length / 4]; Buffer.BlockCopy(b, 0, f, 0, f.Length * 4); return f; }

        static int Gc(float v) => Mathf.Clamp(Mathf.FloorToInt((v + HALF) / GCELL), 0, GN - 1);

        public static Box AddCollider(float x0, float y0, float z0, float x1, float y1, float z1, SurfMat mat, bool dynamic = false)
        {
            var b = new Box { minX = x0, minY = y0, minZ = z0, maxX = x1, maxY = y1, maxZ = z1, mat = mat };
            if (dynamic) b.cells = new List<List<Box>>(); else boxes.Add(b);
            for (int gz = Gc(z0); gz <= Gc(z1); gz++) for (int gx = Gc(x0); gx <= Gc(x1); gx++)
                {
                    var cell = grid[gz * GN + gx];
                    cell.Add(b);
                    if (dynamic) b.cells.Add(cell);
                }
            return b;
        }

        public static void RemoveCollider(Box b)
        {
            if (b?.cells == null) return;
            foreach (var cell in b.cells) cell.Remove(b);
            b.cells.Clear();
        }

        public static float HeightAt(float x, float z)
        {
            if (heights == null) return 0f;
            float fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
            if (fx < 0) fx = 0; else if (fx > RES - 0.0001f) fx = RES - 0.0001f;
            if (fz < 0) fz = 0; else if (fz > RES - 0.0001f) fz = RES - 0.0001f;
            int ix = (int)fx, iz = (int)fz; float u = fx - ix, v = fz - iz;
            var H = heights; int i = iz * N + ix;
            float ha = H[i], hb = H[i + N], hc = H[i + N + 1], hd = H[i + 1];
            if (u + v <= 1) return ha + (hd - ha) * u + (hb - ha) * v;
            return hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - v);
        }

        public static float WaterAt(float x, float z)
        {
            var Wh = waterH; if (Wh == null) return WATER;
            float fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
            if (fx < 0) fx = 0; else if (fx > RES - 0.0001f) fx = RES - 0.0001f;
            if (fz < 0) fz = 0; else if (fz > RES - 0.0001f) fz = RES - 0.0001f;
            int ix = (int)fx, iz = (int)fz; float u = fx - ix, v = fz - iz; int i = iz * N + ix;
            float a = Wh[i], b = Wh[i + 1], c = Wh[i + N], d = Wh[i + N + 1];
            return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
        }

        public static Vector3 NormalAt(float x, float z)
        {
            const float e = 1f;
            float hl = HeightAt(x - e, z), hr = HeightAt(x + e, z), hd = HeightAt(x, z - e), hu = HeightAt(x, z + e);
            return new Vector3(hl - hr, 2 * e, hd - hu).normalized;
        }

        public static void QueryBoxes(float x0, float z0, float x1, float z1, Action<Box> cb)
        {
            int s = ++stamp;
            int gx0 = Gc(x0), gx1 = Gc(x1), gz0 = Gc(z0), gz1 = Gc(z1);
            for (int gz = gz0; gz <= gz1; gz++) for (int gx = gx0; gx <= gx1; gx++)
                {
                    var cell = grid[gz * GN + gx];
                    for (int i = 0; i < cell.Count; i++)
                    {
                        var b = cell[i];
                        if (b.stamp == s) continue;
                        b.stamp = s;
                        if (b.maxX < x0 || b.minX > x1 || b.maxZ < z0 || b.minZ > z1) continue;
                        cb(b);
                    }
                }
        }

        // 상자 레이캐스트 (격자 DDA) — 가장 가까운 t
        public static float RayBoxes(float ox, float oy, float oz, float dx, float dy, float dz, float maxD, bool fill)
        {
            int s = ++stamp;
            float best = maxD; Box hb = null; int ax = 0; float sg = 0;
            int gx = Mathf.FloorToInt((ox + HALF) / GCELL), gz = Mathf.FloorToInt((oz + HALF) / GCELL);
            int stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
            float tMaxX = Mathf.Abs(dx) > 1e-9f ? (((gx + (dx > 0 ? 1 : 0)) * GCELL - HALF) - ox) / dx : float.PositiveInfinity;
            float tMaxZ = Mathf.Abs(dz) > 1e-9f ? (((gz + (dz > 0 ? 1 : 0)) * GCELL - HALF) - oz) / dz : float.PositiveInfinity;
            float tDX = Mathf.Abs(dx) > 1e-9f ? GCELL / Mathf.Abs(dx) : float.PositiveInfinity, tDZ = Mathf.Abs(dz) > 1e-9f ? GCELL / Mathf.Abs(dz) : float.PositiveInfinity;
            float t = 0; int guard = 0;
            float idx = Mathf.Abs(dx) > 1e-12f ? 1 / dx : 1e12f, idy = Mathf.Abs(dy) > 1e-12f ? 1 / dy : 1e12f, idz = Mathf.Abs(dz) > 1e-12f ? 1 / dz : 1e12f;
            while (t <= best && guard++ < 400)
            {
                if (gx >= 0 && gx < GN && gz >= 0 && gz < GN)
                {
                    var cell = grid[gz * GN + gx];
                    for (int i = 0; i < cell.Count; i++)
                    {
                        var b = cell[i];
                        if (b.stamp == s) continue;
                        b.stamp = s;
                        float t0 = (b.minX - ox) * idx, t1 = (b.maxX - ox) * idx; int a = 0; float sgn = dx > 0 ? -1 : 1;
                        if (t0 > t1) { var tmp = t0; t0 = t1; t1 = tmp; }
                        float ty0 = (b.minY - oy) * idy, ty1 = (b.maxY - oy) * idy;
                        if (ty0 > ty1) { var tmp = ty0; ty0 = ty1; ty1 = tmp; }
                        if (ty0 > t0) { t0 = ty0; a = 1; sgn = dy > 0 ? -1 : 1; }
                        if (ty1 < t1) t1 = ty1;
                        if (t0 > t1) continue;
                        float tz0 = (b.minZ - oz) * idz, tz1 = (b.maxZ - oz) * idz;
                        if (tz0 > tz1) { var tmp = tz0; tz0 = tz1; tz1 = tmp; }
                        if (tz0 > t0) { t0 = tz0; a = 2; sgn = dz > 0 ? -1 : 1; }
                        if (tz1 < t1) t1 = tz1;
                        if (t0 > t1 || t0 < 0 || t0 >= best) continue;
                        best = t0; hb = b; ax = a; sg = sgn;
                    }
                }
                else if ((gx < 0 && stepX < 0) || (gx >= GN && stepX > 0) || (gz < 0 && stepZ < 0) || (gz >= GN && stepZ > 0)) break;
                if (tMaxX < tMaxZ) { t = tMaxX; tMaxX += tDX; gx += stepX; } else { t = tMaxZ; tMaxZ += tDZ; gz += stepZ; }
            }
            if (hb != null && fill)
            {
                hit.t = best; hit.box = hb; hit.mat = hb.mat;
                hit.normal = new Vector3(ax == 0 ? sg : 0, ax == 1 ? sg : 0, ax == 2 ? sg : 0);
            }
            return hb != null ? best : float.PositiveInfinity;
        }

        public static float RayTerrain(float ox, float oy, float oz, float dx, float dy, float dz, float maxD)
        {
            float t = 0, prev = 0; int guard = 0;
            while (t < maxD && guard++ < 600)
            {
                float y = oy + dy * t, h = HeightAt(ox + dx * t, oz + dz * t);
                if (y < h) return Refine(ox, oy, oz, dx, dy, dz, prev, t);
                prev = t;
                t += Mathf.Max(0.35f, (y - h) * 0.55f);
            }
            float ye = oy + dy * maxD;
            if (ye < HeightAt(ox + dx * maxD, oz + dz * maxD)) return Refine(ox, oy, oz, dx, dy, dz, prev, maxD);
            return float.PositiveInfinity;
        }

        static float Refine(float ox, float oy, float oz, float dx, float dy, float dz, float a, float b)
        {
            for (int i = 0; i < 8; i++) { float m = (a + b) * 0.5f; if (oy + dy * m < HeightAt(ox + dx * m, oz + dz * m)) b = m; else a = m; }
            return b;
        }

        // 통합 레이캐스트: 결과는 World.hit
        public static bool Raycast(Vector3 o, Vector3 d, float maxD, bool noTerrain = false)
        {
            float tb = RayBoxes(o.x, o.y, o.z, d.x, d.y, d.z, maxD, true);
            float tt = noTerrain ? float.PositiveInfinity : RayTerrain(o.x, o.y, o.z, d.x, d.y, d.z, Mathf.Min(maxD, tb));
            if (tt < tb)
            {
                hit.t = tt; hit.box = null; hit.mat = SurfMat.Terrain;
                hit.point = o + d * tt;
                hit.normal = NormalAt(hit.point.x, hit.point.z);
                return true;
            }
            if (tb < float.PositiveInfinity) { hit.point = o + d * tb; return true; }
            return false;
        }

        public static Func<Vector3, Vector3, bool> smokeBlocks;

        public static bool Los(Vector3 a, Vector3 b)
        {
            float dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
            float d = Mathf.Sqrt(dx * dx + dy * dy + dz * dz);
            if (d < 0.01f) return true;
            float ix = dx / d, iy = dy / d, iz = dz / d;
            if (RayBoxes(a.x, a.y, a.z, ix, iy, iz, d - 0.2f, false) < float.PositiveInfinity) return false;
            if (RayTerrain(a.x, a.y, a.z, ix, iy, iz, d - 0.2f) < float.PositiveInfinity) return false;
            if (smokeBlocks != null && smokeBlocks(a, b)) return false;
            return true;
        }

        // 캐릭터 발 아래 지면 높이 (재질은 World.gmat)
        public static float Ground(float x, float z, float feetY, float r, float step)
        {
            float g = HeightAt(x, z); var mat = SurfMat.Terrain;
            float lim = feetY + step;
            int s = ++stamp;
            int gx0 = Gc(x - r), gx1 = Gc(x + r), gz0 = Gc(z - r), gz1 = Gc(z + r);
            for (int gz = gz0; gz <= gz1; gz++) for (int gx = gx0; gx <= gx1; gx++)
                {
                    var cell = grid[gz * GN + gx];
                    for (int i = 0; i < cell.Count; i++)
                    {
                        var b = cell[i];
                        if (b.stamp == s) continue;
                        b.stamp = s;
                        if (b.maxX < x - r || b.minX > x + r || b.maxZ < z - r || b.minZ > z + r) continue;
                        if (b.maxY > lim || b.maxY <= g) continue;
                        float cx = x < b.minX ? b.minX : x > b.maxX ? b.maxX : x;
                        float cz = z < b.minZ ? b.minZ : z > b.maxZ ? b.maxZ : z;
                        if ((cx - x) * (cx - x) + (cz - z) * (cz - z) <= r * r) { g = b.maxY; mat = b.mat; }
                    }
                }
            gmat = mat;
            return g;
        }

        public static bool Covered(float x, float y, float z) => RayBoxes(x, y, z, 0, 1, 0, 25, false) < float.PositiveInfinity;
    }
}
