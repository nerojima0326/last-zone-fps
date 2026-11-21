using UnityEngine;

namespace LastZone
{
    // 플레이어 조작 (웹판 player.js): 이동 · 사격 · 정조준 · 재장전 · 투척 · 치료 · 소생 · 넘기 · 기울이기 · 강하 · 운전 · 관전
    //  카메라 결과는 웹 좌표 camPos + camQ(웹 회전) + fov 로 내보내고, 화면 쪽(GameView)이 유니티 카메라에 옮긴다
    public static class PlayerCtl
    {
        public static Actor a;
        public static float sens = 1, adsSens = 1, scopeSens = 1, fov = 80; public static bool invertY;
        public static float ads, nextFire, lastShot = -9, recoilAcc, raise = 1, pumpT = -1, punchT = -1, cycleT = -1, scopeView, breath = 1, swayT, bloom, camY, landDip, stepPhase, stepDist, camKick, flashAmt, flashHold;
        public static bool breathLock, holding, sprinting, punchHit, fullAuto = true, freezeReq;
        public static float orbitYaw, orbitPitch = -0.3f, dropT, indoor, indoorT, indoorTarget, lean, altitude, time;
        public static int specIdx; public static Actor specTarget;
        public static string prompt = "", camMode = "plane", throwKind = "frag";
        public static LootItem lootTarget; public static Actor reviveTarget;
        public static Vehicle vehicle;
        public class Reload { public string kind, phase = "start", eventPhase, weaponId, soundKey; public float t, dur, shellT, cyc; public bool empty, port, pair, ej, ported, pumped, clip; public int per = 1, cycle, soundIndex; public Sfx.ReloadEvent[] sounds; }
        public static Reload reload;
        public class AutoReload { public Weapon weapon; public float at; }
        public static AutoReload autoReload;
        public class Switch { public float t; public string to; }
        public static Switch sw;
        public class ThrowSt { public string phase = "hold", kind, btn, prev; public float t, holdT, pinT = -1; public bool under, quick, released; }
        public static ThrowSt throwSt;
        public class HealSt { public string kind; public float t, dur, snd; }
        public static HealSt heal;
        public class ReviveSt { public Actor target; public float t; }
        public static ReviveSt revive;
        public class VaultSt { public float t, dur, x0, y0, z0, x1, y1, z1, top; }
        public static VaultSt vault;
        public class KillCam { public Actor killer; public string weapon; public bool head; public float dist, t; }
        public static KillCam killcam;
        // 카메라 (웹 좌표)
        public static Vector3 camPos; public static Quaternion camQ = Quaternion.identity; public static float camFov = 80, camRX, camRY, camRZ;
        public static System.Action<float, bool> onFireKick;
        static readonly string[] SlotOrder = { "rifle", "shotgun", "pistol", "throw" };

        public static void Init(Actor actor)
        {
            a = actor;
            ads = 0; nextFire = 0; lastShot = -9; recoilAcc = 0;
            reload = null; autoReload = null; sw = null; raise = 1; pumpT = -1; punchT = -1; cycleT = -1;
            scopeView = 0; breath = 1; breathLock = false; swayT = 0;
            throwSt = null; throwKind = "frag"; heal = null; revive = null; bloom = 0; fullAuto = true;
            camY = 0; landDip = 0; stepPhase = 0; stepDist = 0; camKick = 0; flashAmt = 0; flashHold = 0;
            orbitYaw = 0; orbitPitch = -0.3f; specIdx = 0; specTarget = null; dropT = 0; indoor = 0; indoorT = 0;
            prompt = ""; lootTarget = null; reviveTarget = null; lean = 0; vault = null; vehicle = null; killcam = null;
            camMode = "plane"; time = 0;
        }

        static void Look(float scale)
        {
            float m = scopeView > 0.5f ? scopeSens : U.Lerp(1, adsSens, U.Clamp(ads, 0, 1));
            float k = 0.0022f * sens * scale * m;
            a.yaw -= GameInput.mdx * k;
            a.pitch = U.Clamp(a.pitch - LookY() * k, -1.45f, 1.45f);
        }
        static float LookY() => GameInput.mdy * (invertY ? -1 : 1);

        public static void Update(float dt)
        {
            if (a == null) return;
            time += dt;
            if (!a.alive) { UpdateSpectate(dt); UpdateFlash(dt); return; }
            if (a.state == "plane") UpdatePlane(dt);
            else if (a.state == "freefall" || a.state == "chute") UpdateDrop(dt);
            else UpdateGround(dt);
            UpdateFlash(dt);
            Sfx.listener = camPos;
        }

        static void LookAt(Vector3 from, Vector3 to) { camPos = from; var d = to - from; if (d.sqrMagnitude > 1e-6f) camQ = Quaternion.LookRotation(d.normalized, Vector3.up); }
        // 웹 좌표의 LookRotation 은 +z 를 앞으로 본다 → 화면 쪽은 camQ 의 앞(+z)을 바라보는 방향으로 쓴다

        /* ---------------- 비행기 ---------------- */
        static void UpdatePlane(float dt)
        {
            var pl = Match.plane;
            camMode = "plane";
            orbitYaw -= GameInput.mdx * 0.003f * sens; orbitPitch = U.Clamp(orbitPitch - LookY() * 0.003f * sens, -1.2f, 0.5f);
            var c = new Vector3(Mathf.Sin(orbitYaw) * Mathf.Cos(orbitPitch), -Mathf.Sin(orbitPitch), Mathf.Cos(orbitYaw) * Mathf.Cos(orbitPitch)) * 34;
            LookAt(pl.pos + c, pl.pos);
            camFov = U.Damp(camFov, 70, 5, dt);
            if (GameInput.Hit("use") && Match.PlaneCanJump()) Match.Jump(a, false);
            Sfx.SetLoop("plane", 0.5f); Sfx.SetLoop("wind", 0.05f);
        }

        /* ---------------- 강하 ---------------- */
        static void UpdateDrop(float dt)
        {
            camMode = "drop";
            dropT += dt;
            orbitYaw -= GameInput.mdx * 0.0028f * sens;
            orbitPitch = U.Clamp(orbitPitch - LookY() * 0.0028f * sens, -1.3f, 0.6f);
            a.yaw = orbitYaw; a.pitch = 0;
            float fwd = (GameInput.Down("forward") ? 1 : 0) - (GameInput.Down("back") ? 1 : 0), str = (GameInput.Down("right") ? 1 : 0) - (GameInput.Down("left") ? 1 : 0);
            var f = new Vector3(-Mathf.Sin(a.yaw), 0, -Mathf.Cos(a.yaw)); var r = new Vector3(Mathf.Cos(a.yaw), 0, -Mathf.Sin(a.yaw));
            float gh = World.Ground(a.pos.x, a.pos.z, a.pos.y, 0.3f, 0.5f);
            float agl = a.pos.y - Mathf.Max(gh, World.WaterAt(a.pos.x, a.pos.z));
            float hs, vs;
            if (a.state == "freefall")
            {
                hs = fwd > 0 ? 34 : fwd < 0 ? 5 : 15; vs = fwd > 0 ? -62 : fwd < 0 ? -40 : -48;
                if ((GameInput.Hit("use") && agl < 260 && dropT > 1) || agl < 110) Match.OpenChute(a);
                Sfx.SetLoop("wind", U.Clamp(-a.vel.y / 60, 0.2f, 0.9f));
            }
            else { hs = fwd > 0 ? 13 : fwd < 0 ? 3 : 8; vs = fwd > 0 ? -8.5f : -5.2f; Sfx.SetLoop("wind", 0.15f); }
            var d = f * hs + r * (str * (a.state == "freefall" ? 9 : 5));
            float k = a.state == "freefall" ? 1.6f : 2.5f;
            a.vel.x = U.Damp(a.vel.x, d.x, k, dt); a.vel.z = U.Damp(a.vel.z, d.z, k, dt);
            a.vel.y = U.Damp(a.vel.y, vs, a.state == "freefall" ? 1.2f : 3, dt);
            a.pos += a.vel * dt;
            float lim = World.HALF - 5; a.pos.x = U.Clamp(a.pos.x, -lim, lim); a.pos.z = U.Clamp(a.pos.z, -lim, lim);
            var pl = Match.plane;
            Sfx.SetLoop("plane", pl != null && pl.visible ? 0.4f * 120 / (120 + Vector3.Distance(pl.pos, a.pos)) : 0);
            float g2 = World.Ground(a.pos.x, a.pos.z, a.pos.y + 0.5f, 0.3f, 0.6f);
            if (a.pos.y <= g2 + 0.02f || a.pos.y < World.WaterAt(a.pos.x, a.pos.z) - 1.2f) { Match.Land(a); OnLand(); return; }
            float dist = a.state == "freefall" ? 7 : 11;
            var c = new Vector3(Mathf.Sin(orbitYaw) * Mathf.Cos(orbitPitch), -Mathf.Sin(orbitPitch) + 0.15f, Mathf.Cos(orbitYaw) * Mathf.Cos(orbitPitch)) * dist;
            var e = a.pos; e.y += a.state == "chute" ? 2.5f : 1;
            LookAt(e + c, e);
            camFov = U.Damp(camFov, a.state == "freefall" ? 85 : 75, 4, dt);
            altitude = agl;
        }
        public static void OnLand()
        {
            a.pitch = 0; camY = a.pos.y + a.EyeH();
            a.cur = a.BestGun();
            raise = 0; sw = new Switch { t = 0.2f, to = a.cur };
            Sfx.SetLoop("wind", 0); Sfx.SetLoop("plane", 0);
            Sfx.Click("land", a.pos);
            landDip = 1;
        }

        /* ---------------- 지상 ---------------- */
        static void UpdateGround(float dt)
        {
            float now = time;
            if (vehicle != null) { Drive(dt); return; }
            camMode = "fp";
            var inst = a.W(a.cur); var def = inst?.Def;
            bool isGun = def != null;
            Look(camFov / fov);
            if (vault != null) { VaultLogic(dt); return; }
            if (now - lastShot > 0.14f && recoilAcc > 0)
            {
                float rr = Mathf.Min(recoilAcc, dt * 0.45f);
                a.pitch -= rr * 0.75f; recoilAcc -= rr;
            }
            float fwd = (GameInput.Down("forward") ? 1 : 0) - (GameInput.Down("back") ? 1 : 0), str = (GameInput.Down("right") ? 1 : 0) - (GameInput.Down("left") ? 1 : 0);
            if (GameInput.Hit("crouch") && !a.knocked)
            {
                if (a.prone) { if (CharPhysics.CanStand(a, 1.27f)) { a.prone = false; a.crouch = true; } }
                else if (a.crouch) { if (CharPhysics.CanStand(a)) a.crouch = false; }
                else a.crouch = true;
            }
            if (GameInput.Hit("prone") && !a.knocked)
            {
                if (a.prone) { if (CharPhysics.CanStand(a)) a.prone = false; else if (CharPhysics.CanStand(a, 1.27f)) { a.prone = false; a.crouch = true; } }
                else if (a.onGround && !a.inWater) { a.prone = true; a.crouch = false; CancelHeal(); }
            }
            if (a.prone && (a.knocked || a.inWater)) a.prone = false;
            bool sprint = GameInput.Down("sprint") && fwd > 0 && ads < 0.3f && !a.crouch && !a.prone && !a.knocked && heal == null && !(GameInput.lmb && isGun && reload == null);
            sprinting = sprint;
            float wantLean = sprint || a.knocked || !a.onGround ? 0 : (GameInput.Down("leanR") ? 1 : 0) - (GameInput.Down("leanL") ? 1 : 0);
            lean = U.Damp(lean, wantLean, 12, dt);
            float speed = a.knocked ? 1.1f : a.prone ? 0.95f : sprint ? 6.8f : a.crouch ? 2.3f : 4.6f;
            if (Mathf.Abs(lean) > 0.5f) speed *= 0.8f;
            if (ads > 0.5f) speed *= 0.62f;
            if (heal != null) speed = Mathf.Min(speed, 1.6f);
            if (revive != null) speed = 0;
            if (a.swimming) speed = sprint ? 3.6f : 2.6f;
            else if (a.inWater) speed *= 0.75f;
            var f = new Vector3(-Mathf.Sin(a.yaw), 0, -Mathf.Cos(a.yaw)); var r = new Vector3(Mathf.Cos(a.yaw), 0, -Mathf.Sin(a.yaw));
            var d = f * fwd + r * str;
            if (d.sqrMagnitude > 0) d = d.normalized * speed;
            float acc = a.onGround ? 48 : 7;
            a.vel.x = U.Approach(a.vel.x, d.x, acc * dt); a.vel.z = U.Approach(a.vel.z, d.z, acc * dt);
            if (GameInput.Hit("jump") && a.onGround && !a.knocked && !a.swimming)
            {
                if (a.prone) { if (CharPhysics.CanStand(a)) a.prone = false; else if (CharPhysics.CanStand(a, 1.27f)) { a.prone = false; a.crouch = true; } }
                else if (a.crouch) { if (CharPhysics.CanStand(a)) a.crouch = false; }
                else if (TryVault()) { CancelHeal(); return; }
                else { a.vel.y = 7.2f; CancelHeal(); }
            }
            CharPhysics.Move(a, dt);
            if (a.landV < -6)
            {
                landDip = U.Clamp(-a.landV / 16, 0.3f, 1);
                Sfx.Click("land", a.pos);
                if (a.landV < -15) Match.Damage(a, (-a.landV - 15) * 7, null, "fall", false, a.pos, Vector3.zero);
            }
            if (a.onGround && a.hspeed > 1.2f)
            {
                stepDist += a.hspeed * dt;
                float stride = sprint ? 2.5f : a.prone ? 1.1f : a.crouch ? 1.4f : 1.9f;
                if (stepDist > stride) { stepDist = 0; Sfx.Footstep(null, a.inWater ? SurfMat.Water : a.groundMat, a.prone ? 0.1f : a.crouch ? 0.18f : sprint ? 0.5f : 0.32f); }
            }
            stepPhase += a.onGround ? a.hspeed * dt * 1.75f : 0;
            indoorT -= dt;
            if (indoorT <= 0) { indoorT = 0.25f; indoorTarget = World.Covered(a.pos.x, a.pos.y + 2, a.pos.z) ? 1 : 0; }
            indoor = U.Damp(indoor, indoorTarget, 4, dt);
            if (!a.knocked) WeaponsLogic(dt, now);
            else { ads = 0; scopeView = 0; reload = null; AbortThrow(); heal = null; cycleT = -1; }
            Interact(dt);
            HealLogic(dt);
            UpdateCamera(dt);
        }

        static void WeaponsLogic(float dt, float now)
        {
            if (GameInput.Hit("slot1")) SwitchTo("rifle");
            if (GameInput.Hit("slot2")) SwitchTo("shotgun");
            if (GameInput.Hit("slot3")) SwitchTo("pistol");
            if (GameInput.Hit("slot4") && throwSt == null) { if (a.cur == "throw") CycleThrow(); else SwitchTo("throw"); }
            if (GameInput.wheel != 0 && throwSt == null)
            {
                var avail = new System.Collections.Generic.List<string>();
                foreach (var s in SlotOrder) if (s == "throw" ? a.ThrowCount() > 0 : a.W(s) != null) avail.Add(s);
                if (avail.Count > 0)
                {
                    int i = avail.IndexOf(sw != null ? sw.to : a.cur);
                    i = ((i + (GameInput.wheel > 0 ? 1 : -1)) % avail.Count + avail.Count) % avail.Count;
                    SwitchTo(avail[i]);
                }
            }
            if (GameInput.Hit("grenade") && throwSt == null && a.ThrowCount() > 0)
            {
                if (a.throwables[throwKind] <= 0) CycleThrow();
                StartThrow(false, a.cur != "throw", "grenade");
            }
            if (GameInput.Hit("fireMode")) { var dd = a.Wdef(a.cur); if (dd != null && dd.auto) { fullAuto = !fullAuto; Sfx.Click("switch", null); } }
            if (GameInput.Hit("scope")) CycleScope();
            if (GameInput.Hit("reload")) { if (throwSt != null) PullPin(); else StartReload(); }
            if (GameInput.Hit("heal")) StartHeal();
            if (sw != null)
            {
                sw.t += dt; float t = sw.t;
                if (t >= 0.2f && a.cur != sw.to) a.cur = sw.to;
                raise = t < 0.2f ? Mathf.Min(raise, 1 - t / 0.2f) : U.Clamp((t - 0.2f) / 0.26f, 0, 1);
                if (t >= 0.46f) { sw = null; raise = 1; }
            }
            var inst = a.W(a.cur); var def = inst?.Def;
            bool isGun = def != null;
            if (autoReload != null && now >= autoReload.at)
            {
                if (autoReload.weapon == inst && inst != null && inst.mag == 0 && heal == null) StartReload();
                autoReload = null;
            }
            bool wantAds = GameInput.rmb && isGun && sw == null && reload == null && !sprinting && a.cur != "throw";
            float zoom = isGun ? ZoomOf(inst, def) : 1;
            ads = U.Approach(ads, wantAds ? 1 : 0, dt / ((isGun ? def.adsTime * Attachments.Modifiers(inst).ads : 0.17f) + (zoom > 1 ? 0.06f : 0)));
            scopeView = zoom > 1 ? U.Smoothstep(0.8f, 1, ads) : 0;
            bool hold = zoom > 1 && ads > 0.8f && GameInput.Down("sprint") && !breathLock && breath > 0;
            holding = hold;
            if (hold) { breath = Mathf.Max(0, breath - dt / 5); if (breath <= 0) breathLock = true; }
            else { breath = Mathf.Min(1, breath + dt / 4); if (breath > 0.6f) breathLock = false; }
            bloom = Mathf.Max(0, bloom - dt * 0.07f);
            camKick = U.Damp(camKick, 0, 12, dt);
            if (reload != null) ReloadLogic(dt);
            if (pumpT >= 0)
            {
                float prev = pumpT; pumpT += dt;
                if (prev < 0.18f && pumpT >= 0.18f) Sfx.Event("open", inst?.id, null);
                if (prev < 0.50f && pumpT >= 0.50f) Sfx.Event("close", inst?.id, null);
                if (prev < 0.3f && pumpT >= 0.3f) EjectShell(true);
                if (pumpT > 0.6f) pumpT = -1;
            }
            if (cycleT >= 0)
            {
                float cyc = isGun && def.cycle > 0 ? def.cycle : 0.9f, c0 = cycleT / cyc;
                cycleT += dt; float c1 = cycleT / cyc;
                if (c0 < 0.24f && c1 >= 0.24f) Sfx.Event("open", inst?.id, null);
                if (c0 < 0.58f && c1 >= 0.58f) Sfx.Event("close", inst?.id, null);
                if (c0 < 0.4f && c1 >= 0.4f) EjectShell(false);
                if (c1 >= 1) cycleT = -1;
            }
            if (isGun && sw == null && throwSt == null)
            {
                bool trigger = def.auto && fullAuto ? (GameInput.lmb || GameInput.lmbHit) : GameInput.lmbHit;
                if (trigger)
                {
                    var R = reload;
                    if (R != null && R.kind == "shell" && inst.mag > 0 && R.phase != "end" && def.action == ActionType.Bolt) { R.phase = "end"; R.t = 0; }
                    else if (R != null && R.kind == "shell" && inst.mag > 0 && R.phase != "end") reload = null;
                    else if (R != null && R.kind == "break" && inst.mag > 0 && R.phase == "load") { R.phase = "end"; R.t = 0; }
                    if (reload == null && now >= nextFire && cycleT < 0)
                    {
                        if (inst.mag > 0) Fire(def, inst, now);
                        else if (GameInput.lmbHit) { Sfx.Event("dry", inst.id, null); nextFire = now + 0.25f; if (a.ammo[Data.Extra[inst.id].ammo] > 0) StartReload(); }
                    }
                }
            }
            if (a.cur == "fists" && sw == null)
                if (GameInput.lmbHit && now >= nextFire) { punchT = 0; nextFire = now + 0.55f; Sfx.Click("punch", null); punchHit = false; }
            if (punchT >= 0)
            {
                punchT += dt;
                if (punchT > 0.12f && !punchHit) { punchHit = true; DoPunch(); }
                if (punchT > 0.4f) punchT = -1;
            }
            if (a.cur == "throw" && sw == null && throwSt == null)
            {
                if (a.throwables[throwKind] <= 0) { if (!CycleThrow()) SwitchTo(a.BestGun()); }
                else if (GameInput.lmbHit) StartThrow(false, false, "lmb");
                else if (GameInput.rmbHit) StartThrow(true, false, "rmb");
            }
            if (throwSt != null) ThrowLogic(dt);
        }

        public static void SwitchTo(string slot)
        {
            if (throwSt != null) { if (throwSt.phase == "hold" && throwSt.pinT < 0 && slot != "throw") throwSt = null; else return; }
            if (slot == "throw") { if (a.ThrowCount() <= 0) return; if (a.throwables[throwKind] <= 0) CycleThrow(); }
            else if (slot != "fists" && a.W(slot) == null) return;
            if ((sw != null ? sw.to : a.cur) == slot) return;
            reload = null; autoReload = null; cycleT = -1; pumpT = -1;
            sw = new Switch { t = sw != null && sw.t < 0.2f ? sw.t : 0, to = slot };
            Sfx.Click("switch", null);
        }
        static bool CycleThrow()
        {
            var order = Data.ThrowOrder; int i = System.Array.IndexOf(order, throwKind);
            for (int k = 1; k <= order.Length; k++)
            {
                var n = order[(i + k) % order.Length];
                if (a.throwables[n] > 0) { throwKind = n; if (k < order.Length) Sfx.Click("switch", null); return true; }
            }
            return false;
        }

        static float CurrentSpread(GunDef def)
        {
            float s = U.Lerp(def.spread, def.adsSpread, ads) + bloom;
            s += U.Clamp(a.hspeed / 4.6f, 0, 1.5f) * def.move * (1 - ads * 0.5f);
            if (!a.onGround) s += 0.06f;
            if (a.prone) s *= 0.6f; else if (a.crouch) s *= 0.8f;
            if (Mathf.Abs(lean) > 0.3f) s *= 1.1f;
            var mod = Attachments.Modifiers(a.W(a.cur));
            s *= mod.spread * U.Lerp(mod.hip, 1, ads);
            return s;
        }

        // 카메라 방향 (웹 좌표): 앞 · 오른쪽 · 위
        public static Vector3 CamFwd => camQ * Vector3.forward;
        public static Vector3 CamRight => camQ * Vector3.left;   // LookRotation(+z 앞)에서 오른손 좌표의 오른쪽은 -x 축
        public static Vector3 CamUp => camQ * Vector3.up;
        public static System.Func<Vector3> muzzleWorld;   // 화면 쪽이 1인칭 총구 자리를 (웹 좌표로) 알려 준다

        // 조준 거리만큼 낙차 보정 (v70): 조준 중이면 가운데 레이가 닿는 곳, 아니면 50 m
        static float ZeroDist()
        {
            if (ads < 0.5f) return 50;
            return World.Raycast(camPos, CamFwd, 600) ? Mathf.Clamp(World.hit.t, 10, 600) : 300;
        }

        static void Fire(GunDef def, Weapon inst, float now)
        {
            inst.mag--;
            bool suppressed = inst.Att("muzzle") == "suppressor";
            Sfx.Shot(inst.id, a.pos, true, suppressed);
            nextFire = now + Mathf.Max(60f / def.rpm, def.action == ActionType.Bolt ? def.cycle : 0);
            lastShot = now;
            var f = CamFwd; var r = CamRight; var u = CamUp;
            var m = muzzleWorld != null ? muzzleWorld() : camPos + f * 0.6f;
            float spread = CurrentSpread(def);
            var shot = Match.training ? Training.OnShot() : Stats.OnShot();
            float zd = ZeroDist(), drop = 9.8f * zd / (2 * def.vel * def.vel);
            for (int k = 0; k < def.pellets; k++)
            {
                float rr = spread * Mathf.Sqrt(U.R()), th = U.R() * Mathf.PI * 2;
                var d = (f + r * (Mathf.Cos(th) * rr) + u * (Mathf.Sin(th) * rr + drop)).normalized;
                Bullets.Fire(a, camPos, d, def, m, def.pellets == 1 || k < 3, shot);
            }
            var mod = Attachments.Modifiers(inst);
            float rv = mod.v * def.recoilV * (ads > 0.5f ? 0.7f : 1) * (a.prone ? 0.62f : a.crouch ? 0.82f : 1) * U.Rand(0.85f, 1.15f);
            a.pitch = Mathf.Min(1.45f, a.pitch + rv); recoilAcc += rv;
            a.yaw += mod.h * def.recoilH * U.Rand(-1, 1.25f);
            camKick += def.kick * (def.cls == GunClass.Shotgun ? 0.019f : def.cls == GunClass.Pistol ? 0.014f : 0.016f);
            Fx.Shake(Mathf.Min(0.12f, def.kick * (suppressed ? 0.009f : 0.015f)));
            bloom = Mathf.Min(def.bloomMax, bloom + def.bloom);
            bool hideFlash = suppressed || inst.Att("muzzle") == "flash";
            onFireKick?.Invoke(def.kick, hideFlash);
            if (!hideFlash) Fx.Light(m, new Color(1f, 0.67f, 0.33f), 2.2f, 0.06f, 12);
            Match.OnShot(a, def, inst);
            if (def.action == ActionType.Pump) pumpT = 0;
            else if (def.action == ActionType.Bolt) { if (inst.mag > 0) cycleT = 0; }
            else if (def.action != ActionType.Break && def.reloadType != ReloadType.Revolver) EjectShell(def.cls == GunClass.Shotgun);
            if (inst.mag == 0 && a.ammo[Data.Extra[inst.id].ammo] > 0) autoReload = new AutoReload { weapon = inst, at = time + 0.22f };
        }
        static void EjectShell(bool red)
        {
            var r = CamRight; var u = CamUp; var f = CamFwd;
            var q = camPos + r * 0.12f - u * 0.08f + f * 0.35f;
            var e = r * U.Rand(2, 3) + u * U.Rand(1.2f, 2) + f * U.Rand(-0.3f, 0.3f) + a.vel;
            Fx.Shell(q, e, red);
        }

        public static void StartReload()
        {
            var inst = a.W(a.cur); var def = inst?.Def;
            if (def == null || reload != null || sw != null || throwSt != null) return;
            string am = Data.Extra[inst.id].ammo;
            if (inst.mag >= Attachments.Capacity(inst, def) || a.ammo[am] <= 0) return;
            bool empty = inst.mag == 0;
            if (def.reloadType == ReloadType.Shell || def.reloadType == ReloadType.Break)
            {
                bool pumpOrSemi = def.cls == GunClass.Shotgun && (def.action == ActionType.Pump || def.action == ActionType.Semi);
                reload = new Reload { kind = def.reloadType == ReloadType.Shell ? "shell" : "break", empty = empty, port = empty && pumpOrSemi, pair = def.reloadType == ReloadType.Break };
            }
            else reload = new Reload { kind = def.reloadType == ReloadType.Revolver ? "revolver" : "mag", dur = Reloads.Duration(inst.id, empty) * Attachments.Modifiers(inst).reload, empty = empty };
            reload.weaponId = inst.id;
            cycleT = -1;
            CancelHeal();
        }
        static void ReloadSounds(Reload R, float p, Sfx.ReloadEvent[] events, string key)
        {
            if (events == null) return;
            if (R.soundKey != key) { R.soundKey = key; R.soundIndex = 0; }
            while (R.soundIndex < events.Length && p >= events[R.soundIndex].at) { Sfx.Event(events[R.soundIndex].cue, R.weaponId, null); R.soundIndex++; }
        }
        public static float PhaseDur(Reload R, GunDef def)
        {
            float k = Reloads.Factor(R.empty) / Data.ReloadSpeed;
            if (def.id == "kr98" && R.phase == "start") return 0.5f * k;
            if (def.id == "kr98" && R.phase == "end") return 0.45f * k;
            if (R.phase == "start") return (R.kind == "break" ? 0.5f : R.port ? 0.95f : 0.35f) * k;
            if (R.phase == "end") return (R.kind == "break" ? 0.42f : (def.action == ActionType.Pump && R.empty && !R.port ? 0.62f : 0.3f)) * k;
            return Reloads.Duration(def.id, R.empty);
        }
        static void ReloadLogic(float dt)
        {
            var inst = a.W(a.cur); var def = inst?.Def; var R = reload;
            if (def == null) { reload = null; return; }
            string am = Data.Extra[inst.id].ammo;
            R.t += dt;
            if (R.kind == "mag" || R.kind == "revolver")
            {
                float p = R.t / R.dur;
                if (R.sounds == null) R.sounds = Sfx.ReloadEvents(inst.id, R.empty, null, false);
                ReloadSounds(R, p, R.sounds, "mag");
                if (p >= 1)
                {
                    int n = Mathf.Min(Attachments.Capacity(inst, def) - inst.mag, a.ammo[am]);
                    inst.mag += n; a.ammo[am] -= n;
                    reload = null;
                }
                return;
            }
            float pd = PhaseDur(R, def);
            void Cycle()
            {
                R.clip = def.clip > 0 && inst.mag == 0 && a.ammo[am] >= 2;
                R.per = R.clip ? def.clip : R.pair && def.mag - inst.mag >= 2 && a.ammo[am] >= 2 ? 2 : 1;
                R.cyc = R.clip ? def.clipReload * Reloads.Factor(R.empty) / Data.ReloadSpeed : Reloads.Duration(inst.id, R.empty) * (R.per == 2 ? 1.3f : 1);
            }
            float phaseP = R.phase == "load" ? (R.shellT + dt) / Mathf.Max(0.01f, R.cyc) : R.t / pd;
            if (R.eventPhase != R.phase) { R.eventPhase = R.phase; R.sounds = Sfx.ReloadEvents(inst.id, R.empty, R.phase, R.port); }
            ReloadSounds(R, phaseP, R.sounds, R.phase + ":" + R.cycle);
            if (R.phase == "start")
            {
                if (R.kind == "break" && !R.ej && R.t >= pd * 0.52f) { R.ej = true; for (int i = inst.mag; i < def.mag; i++) EjectShell(true); }
                if (R.port && !R.ported && R.t >= pd * (def.action == ActionType.Semi ? 0.63f : 0.68f)) { R.ported = true; if (a.ammo[am] > 0) { inst.mag++; a.ammo[am]--; } }
                if (R.t > pd) { R.t = 0; R.shellT = 0; if (inst.mag >= def.mag || a.ammo[am] <= 0) R.phase = "end"; else { R.phase = "load"; Cycle(); } }
            }
            else if (R.phase == "load")
            {
                R.shellT += dt;
                if (R.shellT >= R.cyc)
                {
                    R.shellT = 0; R.cycle++;
                    int n = Mathf.Min(R.per, Mathf.Min(def.mag - inst.mag, a.ammo[am]));
                    inst.mag += n; a.ammo[am] -= n;
                    if (inst.mag >= def.mag || a.ammo[am] <= 0) { R.phase = "end"; R.t = 0; } else Cycle();
                }
            }
            else if (R.phase == "end")
            {
                if (def.action == ActionType.Pump && R.empty && !R.port && !R.pumped && R.t > 0.12f * Reloads.Factor(R.empty) / Data.ReloadSpeed) { R.pumped = true; pumpT = 0.05f; }
                if (R.t > pd) reload = null;
            }
        }
        public static float ZoomOf(Weapon inst, GunDef def) { var sc = Attachments.Optic(inst, def); return sc != null ? Data.Scopes[sc].zoom : 1; }
        static void CycleScope()
        {
            var inst = a.W(a.cur);
            if (inst == null || reload != null) return;
            var def = inst.Def; var x = Data.Extra[inst.id];
            var opts = new System.Collections.Generic.List<string> { "iron" };
            foreach (var t in Data.ScopeOrder) if (System.Array.IndexOf(x.scopes, t) >= 0 && (t == x.baseSight || a.scopes[t] > 0 || inst.scope == t)) opts.Add(t);
            if (opts.Count <= 1) { GameUI.Toast("보유한 조준경이 없습니다"); return; }
            string current = inst.iron ? "iron" : (inst.scope ?? x.baseSight ?? "iron");
            string next = opts[(opts.IndexOf(current) + 1) % opts.Count];
            if (!Attachments.Change(a, inst, "optic", next, Match.training, out var msg)) { if (msg != null) GameUI.Toast(msg); return; }
            Sfx.Click("switch", null);
            GameUI.Toast(next == "iron" ? "가늠쇠 사용" : Data.Scopes[next].name + " 장착");
        }
        static void DoPunch()
        {
            var f = a.LookDir(); var e = a.Eye();
            foreach (var t in Match.actors)
            {
                if (!t.alive || t.team == a.team || t.state != "ground") continue;
                var c = t.Chest(); var d = c - e; float dist = d.magnitude;
                if (dist > 2.0f) continue;
                d /= dist;
                if (Vector3.Dot(d, f) < 0.7f) continue;
                Match.Damage(t, Data.FistDmg, a, "fists", false, c, f);
                Fx.Blood(c, f, 4); Sfx.Impact(c, SurfMat.Flesh);
                break;
            }
        }

        /* ---------------- 투척 ---------------- */
        static void StartThrow(bool under, bool quick, string btn)
        {
            if (a.throwables[throwKind] <= 0 && !CycleThrow()) return;
            reload = null;
            throwSt = new ThrowSt { kind = throwKind, under = under, quick = quick, btn = btn, prev = quick ? (sw != null ? sw.to : a.cur) : null };
            sw = null; raise = 1;
            a.cur = "throw";
        }
        static float FuseOf(string kind) => Throwables.FUSE.TryGetValue(kind, out var f) ? f : 3;
        static bool Cookable(string kind) => kind != "molotov";
        static void PullPin() { var T = throwSt; if (T == null || T.phase != "hold" || T.pinT >= 0 || !Cookable(T.kind)) return; T.pinT = 0; Sfx.Click("pin", null); }
        public static float FuseLeft(ThrowSt T) => FuseOf(T.kind) - Mathf.Max(0, T.pinT);
        static void AbortThrow()
        {
            var T = throwSt;
            if (T != null && T.phase == "hold" && T.pinT >= 0 && Cookable(T.kind) && a != null && a.throwables[T.kind] > 0)
            {
                a.throwables[T.kind]--;
                Throwables.Throw(a, T.kind, a.pos + Vector3.up * 0.3f, new Vector3(0, 0.5f, 0) + a.vel * 0.5f, Mathf.Max(0.05f, FuseLeft(T)));
            }
            throwSt = null;
        }
        static void ThrowLogic(float dt)
        {
            var T = throwSt;
            if (T.phase == "hold")
            {
                T.holdT += dt;
                if (T.pinT >= 0) T.pinT += dt;
                if (T.pinT >= 0 && Cookable(T.kind) && FuseLeft(T) <= 0)
                {
                    if (a.throwables[T.kind] > 0) { a.throwables[T.kind]--; var q0 = camPos + CamFwd * 0.35f; q0.y -= 0.15f; Throwables.Throw(a, T.kind, q0, Vector3.zero, 0.01f); }
                    T.phase = "throw"; T.released = true; T.t = 0.33f;
                    return;
                }
                bool held = T.btn == "lmb" ? GameInput.lmb : T.btn == "rmb" ? GameInput.rmb : T.btn != null && GameInput.Down(T.btn);
                if (!held && T.holdT >= 0.12f) { T.phase = "throw"; T.t = 0.25f; }
                else return;
            }
            T.t += dt;
            if (!T.released && T.t >= 0.33f)
            {
                T.released = true;
                if (a.throwables[T.kind] > 0)
                {
                    a.throwables[T.kind]--;
                    if (T.pinT < 0 && Cookable(T.kind)) Sfx.Click("pin", null);
                    var f = CamFwd; var r = CamRight;
                    var q = camPos + f * 0.45f + r * 0.15f; q.y -= 0.05f;
                    var d = T.under ? f * 9 + new Vector3(0, 2.2f, 0) : f * 21 + new Vector3(0, 2.6f, 0);
                    d += a.vel * 0.6f;
                    Throwables.Throw(a, T.kind, q, d, Cookable(T.kind) ? Mathf.Max(0.05f, FuseLeft(T)) : -1);
                    if (a.model != null) a.model.throwT = 0.5f;
                }
            }
            if (T.t >= 0.68f)
            {
                throwSt = null;
                if (T.quick && T.prev != null && T.prev != "throw") { a.cur = T.prev; raise = 0; sw = new Switch { t = 0.2f, to = T.prev }; }
                else if (a.throwables[T.kind] <= 0) { if (!CycleThrow()) { a.cur = a.BestGun(); raise = 0; sw = new Switch { t = 0.2f, to = a.cur }; } }
            }
        }

        /* ---------------- 치료 · 상호작용 ---------------- */
        static void StartHeal()
        {
            if (heal != null) { CancelHeal(); return; }
            if (a.knocked) return;
            if (a.hp >= 100) { GameUI.Toast("체력이 가득 찼습니다"); return; }
            string kind = null;
            if (a.medkit > 0 && (a.hp < 60 || a.bandage == 0 || a.hp >= 75)) kind = "medkit";
            else if (a.bandage > 0 && a.hp < 75) kind = "bandage";
            if (kind == null) { GameUI.Toast(a.bandage > 0 ? "붕대로는 체력 75까지만 회복됩니다" : "치료 아이템이 없습니다"); return; }
            heal = new HealSt { kind = kind, dur = kind == "medkit" ? 6 : 3.5f };
            reload = null; ads = 0;
        }
        public static void CancelHeal() { heal = null; }
        static void HealLogic(float dt)
        {
            var H = heal; if (H == null) return;
            if (a.knocked || GameInput.lmbHit || sw != null || throwSt != null) { heal = null; return; }
            H.t += dt; H.snd -= dt;
            if (H.snd <= 0) { H.snd = 1.1f; Sfx.Click("heal", null); }
            if (H.t >= H.dur)
            {
                if (H.kind == "medkit" && a.medkit > 0) { a.medkit--; a.hp = 100; }
                else if (H.kind == "bandage" && a.bandage > 0) { a.bandage--; a.hp = Mathf.Min(75, a.hp + 20); }
                Sfx.Click("healdone", null);
                heal = null;
            }
        }
        static void Interact(float dt)
        {
            prompt = ""; lootTarget = null; reviveTarget = null;
            var e = a.Eye();
            if (!a.knocked)
            {
                Actor best = null; float bd = 2.3f;
                foreach (var m in Match.teams[a.team].members)
                {
                    if (m == a || !m.alive || !m.knocked) continue;
                    float d = U.Hypot(m.pos.x - a.pos.x, m.pos.z - a.pos.z);
                    if (d < bd && Mathf.Abs(m.pos.y - a.pos.y) < 1.5f) { bd = d; best = m; }
                }
                if (best != null)
                {
                    reviveTarget = best;
                    if (GameInput.Down("use"))
                    {
                        if (revive == null || revive.target != best) revive = new ReviveSt { target = best };
                        revive.t += dt;
                        if (revive.t >= 5) { Match.Revive(best, a); revive = null; }
                    }
                    else revive = null;
                    if (revive == null) prompt = "[" + GameInput.Label("use") + "] 길게 눌러 <b>" + best.name + "</b> 소생";
                    return;
                }
            }
            revive = null;
            if (a.knocked) return;
            var f = a.LookDir();
            var it = Match.LootNear(e, f);
            if (it == null)
            {
                var v = Vehicles.Near(a);
                if (v != null) { prompt = "[" + GameInput.Label("use") + "] <b>차량</b> 탑승"; if (GameInput.Hit("use")) EnterVehicle(v); return; }
            }
            if (it != null)
            {
                lootTarget = it;
                prompt = "[" + GameInput.Label("use") + "] " + Match.LootLabel(it);
                if (GameInput.Hit("use"))
                {
                    bool hadGun = a.HasGun(); var before = a.W(a.cur);
                    string res = Match.Pickup(a, it);
                    if (a.W(a.cur) != before && a.cur != "throw") { reload = null; cycleT = -1; raise = 0; sw = new Switch { t = 0.2f, to = a.cur }; }
                    if (res != null)
                    {
                        if (it.airdrop) Stats.Unlock("airdrop");
                        GameUI.Pickup(res);
                        Sfx.Click("pickup", null);
                        if ((!hadGun && a.HasGun()) || (a.cur == "fists" && a.HasGun())) SwitchTo(a.BestGun());
                    }
                    else GameUI.Toast("더 이상 가질 수 없습니다");
                }
            }
        }

        static bool TryVault()
        {
            var f = new Vector3(-Mathf.Sin(a.yaw), 0, -Mathf.Cos(a.yaw));
            var e = new Vector3(a.pos.x, a.pos.y + 0.45f, a.pos.z);
            if (!World.Raycast(e, f, 1.1f)) return false;
            float d = World.hit.t, feet = a.pos.y;
            float top = World.Ground(a.pos.x + f.x * (d + 0.2f), a.pos.z + f.z * (d + 0.2f), feet + 1.6f, 0.12f, 0);
            float h = top - feet;
            if (h < 0.5f || h > 1.6f) return false;
            if (World.Raycast(new Vector3(a.pos.x, top + 0.35f, a.pos.z), f, d + 1.2f)) return false;
            if (World.Raycast(new Vector3(a.pos.x, top + 1.0f, a.pos.z), f, d + 1.2f)) return false;
            float tx = a.pos.x + f.x * (d + 0.95f), tz = a.pos.z + f.z * (d + 0.95f);
            float land = World.Ground(tx, tz, top + 0.1f, 0.25f, 0);
            if (top - land > 3.2f) return false;
            vault = new VaultSt { dur = 0.42f + h * 0.12f, x0 = a.pos.x, y0 = feet, z0 = a.pos.z, x1 = tx, y1 = land, z1 = tz, top = top + 0.12f };
            reload = null; ads = 0; lean = 0; a.leanX = 0;
            Sfx.Click("land", null);
            return true;
        }
        static void VaultLogic(float dt)
        {
            var V = vault;
            V.t += dt;
            float k = Mathf.Min(1, V.t / V.dur), e = k * k * (3 - 2 * k);
            float up = Mathf.Min(1, k / 0.55f), dn = Mathf.Max(0, (k - 0.55f) / 0.45f);
            a.pos = new Vector3(U.Lerp(V.x0, V.x1, e), dn > 0 ? U.Lerp(V.top, V.y1, dn * dn) : U.Lerp(V.y0, V.top, 1 - (1 - up) * (1 - up)), U.Lerp(V.z0, V.z1, e));
            a.vel = Vector3.zero; a.onGround = true; a.hspeed = 0;
            ads = 0; sprinting = false;
            if (k >= 1)
            {
                vault = null;
                a.vel = new Vector3(-Mathf.Sin(a.yaw) * 2.5f, 0, -Mathf.Cos(a.yaw) * 2.5f);
                if (!CharPhysics.CanStand(a)) a.crouch = true;
                landDip = 0.5f;
            }
            if (sw == null) raise = 1 - Mathf.Sin(k * Mathf.PI) * 0.8f;
            prompt = "";
            UpdateCamera(dt);
        }

        static void UpdateCamera(float dt)
        {
            float target = a.pos.y + a.EyeH();
            if (Mathf.Abs(camY - target) > 1.6f) camY = target;
            else camY = U.Damp(camY, target, a.onGround ? 16 : 40, dt);
            landDip = U.Damp(landDip, 0, 6, dt);
            float bob = a.onGround ? Mathf.Sin(stepPhase * 2) * 0.022f * U.Clamp(a.hspeed / 5, 0, 1.3f) * (1 - ads * 0.8f) : 0;
            float sh = Fx.shakeAmt;
            var pos = new Vector3(a.pos.x + (U.R() - 0.5f) * sh * 0.06f, camY + bob - landDip * 0.12f + (U.R() - 0.5f) * sh * 0.06f, a.pos.z + (U.R() - 0.5f) * sh * 0.06f);
            float leanRoll = 0;
            a.leanX = 0;
            if (Mathf.Abs(lean) > 0.01f)
            {
                float side = lean > 0 ? 1 : -1, want = Mathf.Abs(lean) * (a.prone ? 0.22f : 0.42f);
                var r = new Vector3(Mathf.Cos(a.yaw) * side, 0, -Mathf.Sin(a.yaw) * side);
                float room = World.Raycast(pos, r, want + 0.18f) ? Mathf.Max(0, World.hit.t - 0.18f) : want;
                pos += r * Mathf.Min(want, room);
                a.leanX = Mathf.Min(want, room) * side;
                pos.y -= Mathf.Abs(lean) * 0.05f;
                leanRoll = -lean * 0.16f;
            }
            float rx = a.pitch + camKick + camRX + (U.R() - 0.5f) * sh * 0.02f, ry = a.yaw + camRY + (U.R() - 0.5f) * sh * 0.02f, rz = camRZ + leanRoll + (U.R() - 0.5f) * sh * 0.015f;
            var inst = a.W(a.cur); var def = inst?.Def;
            string scope = inst != null ? Attachments.Optic(inst, def) : null;
            float zoom = scope != null ? Data.Scopes[scope].zoom : 1;
            if (zoom >= 2 && ads > 0.5f)
            {
                swayT += dt;
                float amp = (zoom >= 8 ? 0.0032f : zoom >= 4 ? 0.0022f : 0.0012f) * (holding ? 0.12f : breathLock ? 1.7f : 1) * (a.prone ? 0.35f : a.crouch ? 0.6f : 1) * (1 + U.Clamp(a.hspeed / 4, 0, 1.5f)) * ads;
                float t = swayT;
                rx += (Mathf.Sin(t * 0.9f) * 0.6f + Mathf.Sin(t * 2.3f + 1) * 0.25f) * amp;
                ry += (Mathf.Cos(t * 0.7f) * 0.6f + Mathf.Sin(t * 1.9f) * 0.3f) * amp;
            }
            camPos = pos;
            // 웹 Euler 'YXZ' (x = pitch 위 +, y = yaw 왼쪽 +, z = roll). 카메라는 -z 를 보므로 앞을 +z 로 쓰려면 Y 축으로 180° 더 돈다
            camQ = Vehicles.Rot(rx, ry, rz) * Quaternion.AngleAxis(180, Vector3.up);
            float baseFov = fov;
            float adsFov = def != null && def.adsFov > 0 ? Mathf.Min(def.adsFov, baseFov) : baseFov;
            if (zoom > 1) adsFov = 2 * Mathf.Atan(Mathf.Tan(baseFov * Mathf.Deg2Rad / 2) / zoom) * Mathf.Rad2Deg;
            float fv = U.Lerp(baseFov, adsFov, ads) + (sprinting ? 4 : 0);
            camFov = zoom > 1 && ads > 0.95f ? fv : U.Damp(camFov, fv, 18, dt);
        }

        /* ---------------- 차량 ---------------- */
        static void EnterVehicle(Vehicle v)
        {
            Vehicles.Enter(a, v);
            vehicle = v;
            reload = null; autoReload = null; heal = null; ads = 0; scopeView = 0; lean = 0; a.leanX = 0; AbortThrow(); cycleT = -1;
            orbitYaw = v.yaw; orbitPitch = -0.22f;
        }
        public static void ExitVehicle(bool forced)
        {
            if (vehicle == null) return;
            if (!Vehicles.Exit(a, forced)) return;
            a.yaw = orbitYaw;
            vehicle = null;
            camY = a.pos.y + a.EyeH();
            raise = 0; sw = new Switch { t = 0.2f, to = a.cur };
        }
        static void Drive(float dt)
        {
            var v = vehicle;
            camMode = "vehicle";
            orbitYaw -= GameInput.mdx * 0.0026f * sens;
            orbitPitch = U.Clamp(orbitPitch - LookY() * 0.0026f * sens, -1.1f, 0.25f);
            float thr = (GameInput.Down("forward") ? 1 : 0) - (GameInput.Down("back") ? 1 : 0), st = (GameInput.Down("left") ? 1 : 0) - (GameInput.Down("right") ? 1 : 0);
            Vehicles.Step(v, a, dt, thr, st, false, GameInput.Down("jump"));
            if (v.driver == null) return;
            sprinting = false; ads = 0; scopeView = 0;
            Sfx.SetLoop("engine", 0.32f + Mathf.Abs(v.speed) / Vehicles.MAX * 0.25f, null, 0.7f + Mathf.Abs(v.speed) / Vehicles.MAX * 1.1f);
            v.noiseT -= dt;
            if (v.noiseT <= 0) { v.noiseT = 1; Match.OnNoise(v.pos, 45 + Mathf.Abs(v.speed) * 2.5f, a); }
            var f = new Vector3(-Mathf.Sin(v.yaw), 0, -Mathf.Cos(v.yaw));
            if (Mathf.Abs(v.speed) > 7 && U.R() < dt * 14) Fx.Dust(v.pos + f * (-1.7f * Mathf.Sign(v.speed)), new Vector3(0, 0.3f, 0), new Color(0.5f, 0.45f, 0.36f), 1.4f);
            int hpP = Mathf.RoundToInt(v.hp / Vehicles.HP * 100);
            prompt = "[" + GameInput.Label("use") + "] 내리기 · [" + GameInput.Label("jump") + "] 드리프트 · <b>" + Mathf.RoundToInt(U.Hypot(v.speed, v.lat) * 3.6f) + "</b> km/h · 차량 " + (v.burnT > 0 ? "<color=#ff5a3c><b>불붙음!</b></color>" : (hpP < 30 ? "<color=#ff8a3c>" : "<color=#ffffff>") + "<b>" + hpP + "%</b></color>") + (v.drift ? " · <color=#ffd23f><b>DRIFT</b></color>" : "");
            lootTarget = null; reviveTarget = null;
            if (GameInput.Hit("use")) { ExitVehicle(false); return; }
            const float dist = 7.5f;
            var c = new Vector3(Mathf.Sin(orbitYaw) * Mathf.Cos(orbitPitch), -Mathf.Sin(orbitPitch), Mathf.Cos(orbitYaw) * Mathf.Cos(orbitPitch));
            var e = v.pos; e.y += 1.9f;
            var d = e + c * dist;
            for (int i = 1; i <= 8; i++) { float t = i / 8f, x = U.Lerp(e.x, d.x, t), z = U.Lerp(e.z, d.z, t); d.y = Mathf.Max(d.y, e.y + (World.HeightAt(x, z) + 0.5f - e.y) / t); }
            var cc = d - e; float L = cc.magnitude; cc /= L;
            float wall = World.RayBoxes(e.x, e.y, e.z, cc.x, cc.y, cc.z, L, false);
            if (wall < float.PositiveInfinity) L = Mathf.Max(0.3f, wall - 0.3f);
            var cp = e + cc * L;
            float gy = World.HeightAt(cp.x, cp.z) + 0.4f; if (cp.y < gy) cp.y = gy;
            LookAt(cp, e);
            camFov = U.Damp(camFov, 74 + Mathf.Abs(v.speed) * 0.35f, 5, dt);
        }

        /* ---------------- 관전 ---------------- */
        static void UpdateSpectate(float dt)
        {
            camMode = "spectate";
            var mates = Match.teams[a.team].members.FindAll(m => m.alive && m != a);
            if (mates.Count == 0) mates = Match.actors.FindAll(m => m.alive && m != a);
            Actor t = mates.Count > 0 ? mates[specIdx % mates.Count] : null;
            if (GameInput.lmbHit && mates.Count > 0) { specIdx++; t = mates[specIdx % mates.Count]; killcam = null; }
            var K = killcam;
            if (K != null) { K.t += dt; if (K.t > 5 || !K.killer.alive) killcam = null; else t = K.killer; }
            specTarget = t;
            if (t == null)
            {
                var e0 = a.pos; e0.y += 1;
                orbitYaw += dt * 0.15f;
                LookAt(new Vector3(e0.x + Mathf.Sin(orbitYaw) * 8, e0.y + 5, e0.z + Mathf.Cos(orbitYaw) * 8), e0);
                return;
            }
            if (t.state == "ground")
            {
                var e = t.Eye();
                var f = new Vector3(-Mathf.Sin(t.yaw), 0, -Mathf.Cos(t.yaw));
                var c = e - f * 3.2f; c.y += 0.7f;
                c += new Vector3(Mathf.Cos(t.yaw), 0, -Mathf.Sin(t.yaw)) * 0.6f;
                var d = c - e; float L = d.magnitude; d /= L;
                if (World.Raycast(e, d, L)) c = e + d * Mathf.Max(0.3f, World.hit.t - 0.3f);
                var np = Vector3.Lerp(camPos, c, 1 - Mathf.Exp(-10 * dt));
                var q = e + f * 10; q.y += Mathf.Sin(t.pitch) * 10;
                LookAt(np, q);
            }
            else
            {
                var e = t.state == "plane" && Match.plane != null ? Match.plane.pos : t.pos;
                LookAt(Vector3.Lerp(camPos, new Vector3(e.x + 10, e.y + 6, e.z + 10), 1 - Mathf.Exp(-4 * dt)), e);
            }
            camFov = U.Damp(camFov, 75, 4, dt);
        }

        public static void OnDeath(Actor killer, string weapon, bool head, float dist)
        {
            AbortThrow();
            reload = null; heal = null; revive = null; throwSt = null; ads = 0; scopeView = 0; cycleT = -1;
            lean = 0; vault = null; if (a != null) a.leanX = 0;
            if (vehicle != null) ExitVehicle(true);
            specIdx = 0; killcam = killer != null ? new KillCam { killer = killer, weapon = weapon, head = head, dist = dist } : null;
        }
        public static void OnKnock() { autoReload = null; lean = 0; a.leanX = 0; vault = null; if (vehicle != null) ExitVehicle(true); }
        public static void Flashed(float amt)
        {
            if (amt <= 0.05f) return;
            if (amt >= 0.5f && flashAmt < 0.3f) freezeReq = true;
            flashAmt = Mathf.Max(flashAmt, amt);
            flashHold = Mathf.Max(flashHold, amt * amt * 2.6f);
            Sfx.Ring(amt);
        }
        static void UpdateFlash(float dt)
        {
            if (flashHold > 0) flashHold -= dt;
            else flashAmt = Mathf.Max(0, flashAmt - dt * 0.55f);
        }
    }
}
