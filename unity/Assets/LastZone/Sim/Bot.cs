using UnityEngine;

namespace LastZone
{
    // 봇 AI (웹판 bots.js 그대로): 인지 · 전투 · 이동 · 파밍 · 자기장 · 소생 · 팀 · 차량
    public class Bot
    {
        public class Diff { public float react, err, track, vis, rate; public int b0, b1; public float p0, p1, nade, turn, head, peek, prone; }
        static readonly Diff Easy = new Diff { react = 1.35f, err = 2.5f, track = 0.85f, vis = 75, rate = 0.48f, b0 = 2, b1 = 3, p0 = 0.75f, p1 = 1.35f, nade = 0.05f, turn = 2.8f, head = 0.02f, peek = 0.35f, prone = 0.1f };
        static readonly Diff Normal = new Diff { react = 0.85f, err = 1.65f, track = 1.45f, vis = 105, rate = 0.68f, b0 = 2, b1 = 4, p0 = 0.48f, p1 = 0.95f, nade = 0.14f, turn = 3.8f, head = 0.07f, peek = 0.7f, prone = 0.22f };
        static readonly Diff Hard = new Diff { react = 0.28f, err = 0.7f, track = 3.3f, vis = 150, rate = 1.0f, b0 = 4, b1 = 8, p0 = 0.2f, p1 = 0.45f, nade = 0.45f, turn = 7, head = 0.3f, peek = 1, prone = 0.32f };
        static readonly Diff AllyEasy = new Diff { react = 0.9f, err = 1.7f, track = 1.5f, vis = 95, rate = 0.65f, b0 = 2, b1 = 4, p0 = 0.45f, p1 = 0.9f, nade = 0.12f, turn = 3.5f, head = 0.05f, peek = 0.7f, prone = 0.2f };
        static readonly Diff AllyNormal = new Diff { react = 0.5f, err = 1.1f, track = 2.3f, vis = 125, rate = 0.85f, b0 = 3, b1 = 6, p0 = 0.3f, p1 = 0.65f, nade = 0.28f, turn = 5, head = 0.15f, peek = 0.85f, prone = 0.26f };
        public static Diff Of(string diff, bool ally) => ally ? (diff == "easy" ? AllyEasy : diff == "hard" ? Hard : AllyNormal) : (diff == "easy" ? Easy : diff == "hard" ? Hard : Normal);

        public readonly Actor a; public readonly Diff d;
        public Actor target; public bool visible; public float lostT = 99; public Vector3 lastSeen; public bool hasLast;
        Vector3 aimOff; float reactT;
        public Vector3? goal; public string goalType = ""; float goalT; public LootItem lootItem;
        float thinkT, percT; int burstLeft; float burstPause, nextFire; public float reloadT; string reloadW;
        int strafe = 1; float strafeT; Vector3 coverPos; float coverT, coverSearchT;
        float progT; Vector3 lastProg; int stuck; float detourT, detourYaw; float avoidSide;
        float nadeCD; public Heal healing; public Actor reviving; float reviveT;
        Vector3 alertPos; float alertT;
        public Vector3 dropTarget; public float jumpAt; float chuteAt;
        float wanderT, time; Vector3 followOff; bool run;
        public float leanWant; public Vehicle vehicle; public Vehicle carGoal; public Vector3 carDest; public string carType = ""; float carCD;
        bool? aimHead; float hurtByT = -99, step; public bool vStop; public int vStuck;

        public class Heal { public string kind; public float t, dur; }

        public Bot(Actor a)
        {
            this.a = a;
            d = Of(Match.diff, a.team == 0);
            thinkT = U.R() * 0.4f; percT = U.R() * 0.2f; avoidSide = U.R() < 0.5f ? 1 : -1;
            nadeCD = U.Rand(8, 20); chuteAt = U.Rand(95, 140);
            followOff = new Vector3(U.Rand(-6, 6), 0, U.Rand(-6, 6)); carCD = U.Rand(3, 10);
        }
        float Now => Match.time;

        public void Update(float dt)
        {
            time += dt;
            if (!a.alive || a.state == "plane") return;
            if (a.state == "freefall" || a.state == "chute") { UpdateDrop(dt); return; }
            a.blindT = Mathf.Max(0, a.blindT - dt);
            alertT -= dt; nadeCD -= dt; coverT -= dt; coverSearchT -= dt;
            if (a.knocked) { UpdateKnocked(dt); return; }
            percT -= dt;
            if (percT <= 0) { percT = 0.16f + U.R() * 0.08f; Perceive(); }
            if (!visible) lostT += dt;
            if (reloadT > 0) { reloadT -= dt; if (reloadT <= 0) FinishReload(); }
            thinkT -= dt;
            if (thinkT <= 0) { thinkT = 0.3f + U.R() * 0.2f; Think(); }
            if (vehicle != null) { UpdateVehicle(dt); return; }
            carCD -= dt;
            if (carCD <= 0) { carCD = 4; ConsiderCar(); }

            var w = Vector3.zero;
            float speed = 0; float? faceYaw = null;
            bool combat = target != null && target.alive && (visible || lostT < 1.2f);
            if (healing != null)
            {
                healing.t += dt;
                if (!a.prone) a.crouch = true;
                if (healing.t >= healing.dur)
                {
                    if (healing.kind == "medkit" && a.medkit > 0) { a.medkit--; a.hp = 100; }
                    else if (a.bandage > 0) { a.bandage--; a.hp = Mathf.Min(75, a.hp + 20); }
                    healing = null; a.crouch = false;
                }
                else if (combat && visible) { healing = null; a.crouch = false; }
            }
            if (reviving != null)
            {
                var m = reviving;
                if (!m.alive || !m.knocked || U.Hypot(m.pos.x - a.pos.x, m.pos.z - a.pos.z) > 2.2f || (visible && target != null && Vector3.Distance(a.pos, target.pos) < 40)) reviving = null;
                else
                {
                    reviveT += dt; a.crouch = true;
                    faceYaw = Mathf.Atan2(-(m.pos.x - a.pos.x), -(m.pos.z - a.pos.z));
                    if (reviveT >= 5) { Match.Revive(m, a); reviving = null; a.crouch = false; }
                }
            }
            if (combat && reviving == null)
            {
                speed = Combat(dt, ref w);
                faceYaw = null;
            }
            else if (healing == null && reviving == null)
            {
                if (a.prone && goal != null) { if (CharPhysics.CanStand(a)) a.prone = false; else if (CharPhysics.CanStand(a, 1.27f)) { a.prone = false; a.crouch = true; } }
                if (leanWant != 0 && !combat) leanWant = 0;
                if (goal != null)
                {
                    speed = Navigate(dt, ref w);
                    faceYaw = speed > 0.1f ? Mathf.Atan2(-w.x, -w.z) : (float?)null;
                }
                if (alertT > 0 && goal == null) faceYaw = Mathf.Atan2(-(alertPos.x - a.pos.x), -(alertPos.z - a.pos.z));
                if (a.crouch && speed > 3) a.crouch = false;
                a.pitch = U.Damp(a.pitch, 0, 3, dt);
                if (a.cur == "fists" || a.W(a.cur) == null) a.cur = a.BestGun();
            }
            float leanTo = leanWant != 0 && !a.prone && a.onGround ? LeanRoom(leanWant) : 0;
            a.leanX = U.Damp(a.leanX, leanTo, 9, dt);
            if (Mathf.Abs(a.leanX) < 0.005f && leanTo == 0) a.leanX = 0;
            if (faceYaw.HasValue) a.yaw += U.Clamp(U.AngleDiff(a.yaw, faceYaw.Value), -d.turn * dt, d.turn * dt);
            if (a.blindT > 0) { a.yaw += Mathf.Sin(time * 3) * dt * 2; w *= 0.4f; }
            float acc = a.onGround ? 30 : 6;
            a.vel.x = U.Approach(a.vel.x, w.x, acc * dt); a.vel.z = U.Approach(a.vel.z, w.z, acc * dt);
            CharPhysics.Move(a, dt);
            if (a.landV < -15) Match.Damage(a, (-a.landV - 15) * 7, null, "fall", false, a.pos, Vector3.zero);
            if (a.onGround && a.hspeed > 2.5f)
            {
                step += a.hspeed * dt;
                if (step > 2.1f) { step = 0; Sfx.Footstep(a.pos, a.inWater ? SurfMat.Water : a.groundMat, a.crouch ? 0.15f : 0.4f); }
            }
        }

        /* ------------ 인지 ------------ */
        void Perceive()
        {
            if (a.blindT > 0) { visible = false; return; }
            var e = a.Eye();
            var f = a.LookDir(); f.y = 0; f.Normalize();
            Actor best = null; float bestS = float.PositiveInfinity;
            float vis = (Match.zone != null && Match.zone.cur.r < 60 ? d.vis * 0.8f : d.vis) * Match.visK;
            foreach (var t in Match.actors)
            {
                if (!t.alive || t.team == a.team || t.state != "ground") continue;
                float dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z, dist = Mathf.Sqrt(dx * dx + dz * dz);
                if (dist > vis) continue;
                float facing = (dx * f.x + dz * f.z) / (dist > 0 ? dist : 1);
                bool aware = t == target || dist < 12 || (alertT > 0 && dist < 70) || (Match.time - a.lastHurtT < 3);
                if (facing < 0.42f && !aware) continue;
                if (t.crouch && dist > 70 && t != target && U.R() < 0.5f) continue;
                bool seen = World.Los(e, t.Chest());
                if (!seen && !t.knocked) seen = World.Los(e, t.Head());
                if (!seen) continue;
                float s = dist + (t.knocked ? 30 : 0) - (t == target ? 12 : 0) - (t.isPlayer ? 3 : 0);
                if (s < bestS) { bestS = s; best = t; }
            }
            visible = best != null;
            if (best != null)
            {
                float dist = Vector3.Distance(a.pos, best.pos);
                if (best != target)
                {
                    target = best;
                    reactT = d.react * U.Rand(0.8f, 1.3f) * (1 + dist / 160) * (lostT < 3 ? 0.5f : 1);
                    float er = d.err * (1 + dist / 35);
                    aimOff = new Vector3(U.Rand(-1, 1), U.Rand(-0.6f, 1), U.Rand(-1, 1)).normalized * er;
                    burstLeft = 0;
                }
                lastSeen = best.pos; hasLast = true; lostT = 0;
                healing = null;
            }
            Peek();
        }

        void Peek()
        {
            var t = target;
            if (t == null || !t.alive || !hasLast || lostT > 5 || a.prone || a.knocked || !a.onGround || a.swimming || vehicle != null || reloadT > 0 || healing != null || reviving != null) { leanWant = 0; return; }
            if (visible) return;
            if (U.R() > d.peek) return;
            var c = lastSeen; c.y += t.Low() ? 0.3f : t.crouch ? 0.85f : 1.2f;
            var e = new Vector3(a.pos.x, a.pos.y + a.EyeH(), a.pos.z);
            if (World.Los(e, c)) { leanWant = 0; return; }
            float first = leanWant != 0 ? leanWant : (U.R() < 0.5f ? 1 : -1);
            foreach (var side in new[] { first, -first })
            {
                float room = LeanRoom(side);
                if (Mathf.Abs(room) < 0.25f) continue;
                var m = new Vector3(e.x + Mathf.Cos(a.yaw) * room, e.y, e.z - Mathf.Sin(a.yaw) * room);
                if (World.Los(m, c)) { leanWant = side; return; }
            }
            leanWant = 0;
        }

        float LeanRoom(float side)
        {
            const float want = 0.42f;
            var p = new Vector3(a.pos.x, a.pos.y + a.EyeH(), a.pos.z);
            var l = new Vector3(Mathf.Cos(a.yaw) * side, 0, -Mathf.Sin(a.yaw) * side);
            float room = World.Raycast(p, l, want + 0.18f) ? Mathf.Max(0, World.hit.t - 0.18f) : want;
            return Mathf.Min(want, room) * side;
        }

        public void Hear(Vector3 pos)
        {
            if (visible) return;
            float dd = Vector3.Distance(a.pos, pos);
            alertPos = pos + new Vector3(U.Rand(-1, 1), 0, U.Rand(-1, 1)) * (dd * 0.08f);
            alertT = 5;
            if (!hasLast || lostT > 6)
                if (dd < 70 && !(a.team == Match.player.team && goalType == "follow")) { lastSeen = alertPos; hasLast = true; lostT = 2; }
        }

        public void OnHurt(Actor attacker)
        {
            if (attacker == null || attacker == a) return;
            hurtByT = Match.time;
            healing = null;
            if (!visible)
            {
                alertPos = attacker.pos; alertT = 6;
                lastSeen = attacker.pos; hasLast = true; lostT = Mathf.Min(lostT, 1.5f);
                percT = 0;
            }
        }

        /* ------------ 의사결정 ------------ */
        void Think()
        {
            var Z = Match.zone;
            if (healing != null || reviving != null) return;
            bool combat = target != null && target.alive && visible;
            if (vehicle != null) { ThinkDriving(); return; }
            if (goalType == "car")
            {
                if (combat || goal == null || carGoal == null || carGoal.driver != null) ClearGoal();
                else { run = true; return; }
            }
            if (target != null && !target.alive) { target = null; hasLast = false; }
            var inst = a.W(a.cur); var idef = inst?.Def;
            if (!combat && inst != null && reloadT <= 0 && inst.mag < Attachments.Capacity(inst, idef) * 0.5f && a.ammo[Data.Extra[inst.id].ammo] > 0) StartReload();
            if (Z != null)
            {
                var zc = Z.next ?? Z.cur;
                float dzz = U.Hypot(a.pos.x - zc.x, a.pos.z - zc.z);
                bool outCur = U.Hypot(a.pos.x - Z.cur.x, a.pos.z - Z.cur.z) > Z.cur.r - 4;
                bool urgent = outCur || (Z.state == "shrink" && dzz > zc.r * 0.85f) || (Z.state == "wait" && Z.timer < 45 && dzz > zc.r * 0.85f);
                if (urgent && !combat)
                {
                    if (goalType != "zone" || goal == null || U.Hypot(goal.Value.x - zc.x, goal.Value.z - zc.z) > zc.r)
                    {
                        float ang = U.R() * 6.28f, rr = Mathf.Sqrt(U.R()) * zc.r * 0.55f;
                        SetGoal(new Vector3(zc.x + Mathf.Cos(ang) * rr, 0, zc.z + Mathf.Sin(ang) * rr), "zone");
                    }
                    run = true;
                    return;
                }
            }
            if (combat) { ClearGoal(); return; }
            // 치료
            if (a.hp < 60 && (a.medkit > 0 || (a.bandage > 0 && a.hp < 75)) && lostT > 2.5f)
            {
                string kind = a.medkit > 0 && (a.hp < 45 || a.bandage == 0) ? "medkit" : "bandage";
                healing = new Heal { kind = kind, t = 0, dur = kind == "medkit" ? 6 : 3.5f };
                if (hasLast && lostT < 10 && a.throwables["smoke"] > 0 && U.R() < 0.5f) ThrowAt("smoke", a.pos);
                return;
            }
            // 동료 소생
            var team = Match.teams[a.team];
            Actor km = null; float kd = 70;
            foreach (var m in team.members) if (m != a && m.alive && m.knocked) { float dd = Vector3.Distance(a.pos, m.pos); if (dd < kd) { kd = dd; km = m; } }
            if (km != null && lostT > 1.5f)
            {
                if (kd < 1.9f) { reviving = km; reviveT = 0; ClearGoal(); return; }
                SetGoal(km.pos, "revive"); run = true;
                if (hasLast && lostT < 8 && a.throwables["smoke"] > 0 && kd < 25 && U.R() < 0.3f) ThrowAt("smoke", km.pos);
                return;
            }
            // 마지막 목격 위치 → 투척 · 수색
            if (hasLast && lostT < 9)
            {
                float dl = Vector3.Distance(a.pos, lastSeen);
                if (nadeCD <= 0 && dl > 9 && dl < 38 && lostT > 0.8f && U.R() < d.nade)
                {
                    string k = a.throwables["frag"] > 0 ? "frag" : a.throwables["molotov"] > 0 ? "molotov" : a.throwables["flash"] > 0 && dl < 22 ? "flash" : null;
                    if (k != null) { ThrowAt(k, lastSeen); nadeCD = U.Rand(10, 22); }
                }
                if (lostT > 2 && !(a.team == Match.player.team && LeaderDist() > 30)) { SetGoal(lastSeen, "hunt"); run = false; return; }
                if (lostT <= 2) { ClearGoal(); return; }
            }
            // 팀 리더 따라가기
            var leader = Leader();
            if (leader != null && leader != a)
            {
                float ld = Vector3.Distance(a.pos, leader.pos);
                bool isPT = a.team == Match.player.team;
                if (ld > (isPT ? 16 : 26)) { SetGoal(leader.pos + followOff, "follow"); run = ld > 30; return; }
            }
            // 파밍
            if (goalType == "loot" && lootItem != null && !lootItem.taken && goal != null) return;
            var it = FindLoot();
            if (it != null) { ClearGoal(); lootItem = it; it.claim = a; SetGoal(it.pos, "loot"); run = Vector3.Distance(a.pos, it.pos) > 15; return; }
            // 배회
            wanderT -= 0.4f;
            if (goal == null || wanderT <= 0)
            {
                wanderT = U.Rand(10, 25);
                var c = Z != null ? (Z.next ?? Z.cur) : new Zone.Circle { x = 0, z = 0, r = 700 };
                Vector3? pt = null;
                var spots = Match.lootSpots;
                for (int i = 0; i < 8 && spots.Count > 0; i++)
                {
                    var s = U.Pick(spots);
                    if (U.Hypot(s.x - c.x, s.z - c.z) < c.r * 0.8f && U.Hypot(s.x - a.pos.x, s.z - a.pos.z) < 140) { pt = s; break; }
                }
                if (pt == null) { float ang = U.R() * 6.28f, rr = Mathf.Sqrt(U.R()) * c.r * 0.7f; pt = new Vector3(c.x + Mathf.Cos(ang) * rr, 0, c.z + Mathf.Sin(ang) * rr); }
                SetGoal(pt.Value, "wander"); run = false;
            }
        }

        Actor Leader()
        {
            var team = Match.teams[a.team]; var p = Match.player;
            if (a.team == p.team && p.alive && !p.knocked && p.state == "ground") return p;
            foreach (var m in team.members) if (m.alive && !m.knocked && m.state == "ground") return m;
            return null;
        }
        float LeaderDist() { var l = Leader(); return l != null ? Vector3.Distance(l.pos, a.pos) : 0; }

        public void ClearGoal()
        {
            if (carGoal != null && carGoal.claim == a) carGoal.claim = null;
            if (lootItem != null && lootItem.claim == a) lootItem.claim = null;
            carGoal = null; lootItem = null; goal = null; goalType = "";
        }
        public void SetGoal(Vector3 p, string type)
        {
            if (type != "car" && carGoal != null) { if (carGoal.claim == a) carGoal.claim = null; carGoal = null; }
            goal = new Vector3(p.x, 0, p.z);
            if (goalType != type) stuck = 0;
            goalType = type; goalT = 0;
            if (type != "loot" && lootItem != null) { if (lootItem.claim == a) lootItem.claim = null; lootItem = null; }
        }

        bool Needs(LootItem it)
        {
            string k = it.kind;
            if (k == "crate") return true;
            var Wd = Data.Gun(k);
            if (Wd != null)
            {
                var cur = a.weapons[Data.SlotOf(Wd)];
                if (cur == null) return true;
                if (cur.id == k) return a.ammo[Data.Extra[k].ammo] < 30;
                return Data.Extra[k].tier > Data.Extra[cur.id].tier;
            }
            if (k.StartsWith("ammo_")) { string t = k.Substring(5); if (a.ammo[t] >= 60) return false; foreach (var s in Data.Slots) if (a.weapons[s] != null && Data.Extra[a.weapons[s].id].ammo == t) return true; return false; }
            if (k.StartsWith("scope_")) return false;
            if (Data.ThrowNames.ContainsKey(k)) return a.throwables[k] < 2;
            if (k == "bandage") return a.bandage < 4;
            if (k == "medkit") return a.medkit < 1;
            if (k == "vest") return Mathf.Max(1, it.level) > a.vest;
            if (k == "helmet") return Mathf.Max(1, it.level) > a.helmet;
            if (k == "bag") return Mathf.Max(1, it.level) > a.bag;
            return false;
        }

        LootItem FindLoot()
        {
            LootItem best = null; float bd = a.HasGun() ? 40 : 90;
            Match.LootAround(a.pos.x, a.pos.z, bd, it =>
            {
                if (it.claim != null && it.claim != a && it.claim.alive) return;
                if (Mathf.Abs(it.pos.y - a.pos.y) > 1.6f) return;
                float dd = Mathf.Abs(it.pos.x - a.pos.x) + Mathf.Abs(it.pos.z - a.pos.z);
                if (dd >= bd || it.failed == a) return;
                if (!Needs(it)) return;
                bd = dd; best = it;
            });
            return best;
        }

        /* ------------ 이동 ------------ */
        float Navigate(float dt, ref Vector3 o)
        {
            var g = goal.Value;
            if (goalType == "car" && carGoal != null) { g.x = carGoal.pos.x; g.z = carGoal.pos.z; goal = g; }
            float dx = g.x - a.pos.x, dz = g.z - a.pos.z, dist = U.Hypot(dx, dz);
            goalT += dt;
            if (dist < (goalType == "loot" ? 1.3f : goalType == "revive" ? 1.1f : goalType == "car" ? 3.3f : 2.5f))
            {
                if (goalType == "car")
                {
                    var v = carGoal; ClearGoal();
                    if (v != null && v.driver == null && Vehicles.BotEnter(this, v)) SetGoal(carDest, carType);
                    return 0;
                }
                if (goalType == "loot" && lootItem != null)
                {
                    if (!lootItem.taken && Match.Pickup(a, lootItem) == null) lootItem.failed = a;
                    thinkT = 0.05f;
                }
                ClearGoal(); return 0;
            }
            if (goalT > 60) { ClearGoal(); return 0; }
            float yaw = Mathf.Atan2(-dx, -dz);
            if (detourT > 0) { detourT -= dt; yaw = detourYaw; }
            else if (Blocked(yaw, 2.4f))
            {
                bool found = false;
                foreach (var t in new[] { 0.5f, 1.0f, 1.5f, 2.1f })
                {
                    foreach (var s in new[] { avoidSide, -avoidSide })
                        if (!Blocked(yaw + t * s, 2.4f)) { yaw += t * s; found = true; avoidSide = s; break; }
                    if (found) break;
                }
                if (!found) yaw += Mathf.PI * 0.6f * avoidSide;
            }
            var p = new Vector3(a.pos.x - Mathf.Sin(yaw) * 3, a.pos.y, a.pos.z - Mathf.Cos(yaw) * 3);
            if (Throwables.FireAt(p, 1)) yaw += 1.6f;
            if (World.WaterAt(p.x, p.z) < 0.1f && World.HeightAt(p.x, p.z) < World.WATER - 1.5f && World.HeightAt(a.pos.x, a.pos.z) > World.WATER - 1.5f && goalType != "zone") yaw += 1.4f * avoidSide;
            progT += dt;
            if (progT > 1.2f)
            {
                float moved = U.Hypot(a.pos.x - lastProg.x, a.pos.z - lastProg.z);
                if (moved < 0.6f)
                {
                    stuck++;
                    if (a.onGround) a.vel.y = 7;
                    detourT = 0.8f + U.R() * 0.6f;
                    detourYaw = yaw + (U.R() < 0.5f ? 1 : -1) * U.Rand(1.2f, 2.4f);
                    if (stuck > 4) { if (lootItem != null) lootItem.failed = a; ClearGoal(); stuck = 0; return 0; }
                }
                else stuck = Mathf.Max(0, stuck - 1);
                progT = 0; lastProg = a.pos;
            }
            float sp = a.swimming ? 2.6f : run ? 6.2f : 4.3f;
            o = new Vector3(-Mathf.Sin(yaw) * sp, 0, -Mathf.Cos(yaw) * sp);
            return sp;
        }

        bool Blocked(float yaw, float len)
        {
            float dx = -Mathf.Sin(yaw), dz = -Mathf.Cos(yaw);
            if (World.RayBoxes(a.pos.x, a.pos.y + 0.65f, a.pos.z, dx, 0, dz, len, false) < float.PositiveInfinity) return true;
            if (World.RayBoxes(a.pos.x, a.pos.y + 1.4f, a.pos.z, dx, 0, dz, len * 0.8f, false) < float.PositiveInfinity) return true;
            float h = World.HeightAt(a.pos.x + dx * len, a.pos.z + dz * len);
            return h - a.pos.y > 1.4f;
        }

        /* ------------ 전투 ------------ */
        string ChooseWeapon(float dist)
        {
            bool Ok(string k) { var w = a.weapons[k]; return w != null && (w.mag > 0 || a.ammo[Data.Extra[w.id].ammo] > 0); }
            if (dist < 14 && Ok("shotgun")) return "shotgun";
            if (Ok("rifle")) return "rifle";
            if (dist < 45 && Ok("pistol")) return "pistol";
            if (Ok("shotgun")) return "shotgun";
            if (Ok("pistol")) return "pistol";
            return "fists";
        }

        bool FindCover(Actor t)
        {
            float best = float.PositiveInfinity; Vector3? point = null;
            var nearby = new System.Collections.Generic.List<Box>();
            World.QueryBoxes(a.pos.x - 13, a.pos.z - 13, a.pos.x + 13, a.pos.z + 13, b => nearby.Add(b));
            foreach (var b in nearby)
            {
                if (b.maxY - b.minY < 0.7f || b.minY > a.pos.y + 1.5f) continue;
                float cx = (b.minX + b.maxX) * 0.5f, cz = (b.minZ + b.maxZ) * 0.5f;
                if (U.Hypot(cx - a.pos.x, cz - a.pos.z) > 13) continue;
                float dx = cx - t.pos.x, dz = cz - t.pos.z, len = U.Hypot(dx, dz); if (len < 0.01f) continue; dx /= len; dz /= len;
                float radius = Mathf.Abs(dx) * (b.maxX - b.minX) * 0.5f + Mathf.Abs(dz) * (b.maxZ - b.minZ) * 0.5f + 0.7f;
                float x = cx + dx * radius, z = cz + dz * radius, dist = U.Hypot(x - a.pos.x, z - a.pos.z);
                if (dist > 12 || dist < 0.4f || dist >= best) continue;
                float y = World.HeightAt(x, z); if (Mathf.Abs(y - a.pos.y) > 1.2f) continue;
                if (World.RayBoxes(a.pos.x, a.pos.y + 0.7f, a.pos.z, (x - a.pos.x) / dist, 0, (z - a.pos.z) / dist, dist - 0.4f, false) < float.PositiveInfinity) continue;
                float tx = t.pos.x - x, tz = t.pos.z - z, td = U.Hypot(tx, tz);
                if (float.IsPositiveInfinity(World.RayBoxes(x, y + 0.8f, z, tx / td, 0, tz / td, td - 0.3f, false))) continue;
                best = dist; point = new Vector3(x, y, z);
            }
            if (point == null) return false;
            coverPos = point.Value; coverT = 2.2f; return true;
        }

        float Combat(float dt, ref Vector3 o)
        {
            var t = target; float now = Now;
            var c = t.Chest();
            if (aimHead == null || U.R() < dt * 0.5f) aimHead = U.R() < d.head;
            if (aimHead.Value && !t.knocked) c = t.Head();
            float dist = Vector3.Distance(a.pos, t.pos);
            string want = ChooseWeapon(dist);
            if (want != a.cur && reloadT <= 0) { a.cur = want; nextFire = Mathf.Max(nextFire, now + 0.45f); }
            aimOff *= Mathf.Exp(-d.track * dt);
            float tv = t.hspeed;
            aimOff.x += (U.R() - 0.5f) * dt * (0.6f + tv * 0.35f) * d.err;
            aimOff.y += (U.R() - 0.5f) * dt * 0.4f * d.err;
            aimOff.z += (U.R() - 0.5f) * dt * (0.6f + tv * 0.35f) * d.err;
            var aimP = visible ? c + aimOff : lastSeen + new Vector3(0, 1.2f, 0) + aimOff;
            var e = a.Eye();
            var dv = aimP - e;
            float hd = U.Hypot(dv.x, dv.z);
            float wantYaw = Mathf.Atan2(-dv.x, -dv.z), wantPitch = Mathf.Atan2(dv.y, hd);
            a.yaw += U.Clamp(U.AngleDiff(a.yaw, wantYaw), -d.turn * dt, d.turn * dt);
            a.pitch += U.Clamp(wantPitch - a.pitch, -d.turn * dt, d.turn * dt);
            if (reactT > 0) reactT -= dt;
            var inst = a.W(a.cur); var def = inst?.Def;
            bool aligned = Mathf.Abs(U.AngleDiff(a.yaw, wantYaw)) < 0.06f + 0.5f / Mathf.Max(dist, 1) && Mathf.Abs(wantPitch - a.pitch) < 0.1f;
            if (a.cur == "fists")
            {
                if (dist < 1.9f && now >= nextFire && visible && reactT <= 0)
                {
                    nextFire = now + 0.7f;
                    Match.Damage(t, Data.FistDmg * 0.8f, a, "fists", false, c, dv.normalized);
                    Sfx.Click("punch", a.pos);
                    if (a.model != null) a.model.kick = 1;
                }
            }
            else if (inst != null && visible && reactT <= 0 && aligned && now >= nextFire && reloadT <= 0 && a.blindT <= 0 && dist < def.range * 0.8f)
            {
                if (inst.mag <= 0) StartReload();
                else if (burstPause > 0) burstPause -= dt;
                else Fire(def, inst, aimP, dist);
            }
            else if (inst != null && inst.mag <= 0 && reloadT <= 0) StartReload();
            if (burstPause > 0 && !(inst != null && visible)) burstPause -= dt;
            if (a.blindT > 0 && inst != null && inst.mag > 0 && now >= nextFire && U.R() < 0.2f) Fire(def, inst, lastSeen + new Vector3(U.Rand(-4, 4), 1, U.Rand(-4, 4)), dist);
            // 이동
            strafeT -= dt;
            if (strafeT <= 0)
            {
                strafeT = U.Rand(0.5f, 1.6f);
                float r = U.R();
                strafe = r < 0.4f ? 1 : r < 0.8f ? -1 : 0;
                if (a.prone)
                {
                    if ((dist < 22 || (!visible && lostT > 2) || U.R() < 0.12f) && CharPhysics.CanStand(a)) a.prone = false;
                    strafe = 0;
                }
                else if (dist > 45 && a.cur == "rifle" && a.onGround && !a.inWater && !a.swimming && leanWant == 0 && visible && U.R() < d.prone) { a.prone = true; a.crouch = false; strafe = 0; }
                else if (dist > 35 && U.R() < 0.35f && a.cur != "shotgun") { a.crouch = true; strafe = 0; }
                else if (U.R() < 0.5f) a.crouch = false;
                if (leanWant != 0) strafe = 0;
                if (Match.diff == "hard" && U.R() < 0.12f && a.onGround && dist < 30) a.vel.y = 7;
            }
            var f = new Vector3(-Mathf.Sin(a.yaw), 0, -Mathf.Cos(a.yaw)); var rr = new Vector3(Mathf.Cos(a.yaw), 0, -Mathf.Sin(a.yaw));
            float fwd = 0;
            float r0 = a.cur == "shotgun" ? 3 : a.cur == "fists" ? 0 : a.cur == "pistol" ? 8 : 15;
            float r1 = a.cur == "shotgun" ? 10 : a.cur == "fists" ? 1.4f : a.cur == "pistol" ? 30 : 70;
            if (dist > r1) fwd = 1; else if (dist < r0) fwd = -0.6f;
            if (!visible) fwd = 0.6f;
            if (leanWant != 0 || a.prone) { fwd = dist < r0 && !a.prone ? -0.6f : 0; strafe = a.prone ? 0 : strafe; }
            float spd = a.prone ? 0.9f : a.crouch ? 2.2f : 4.0f;
            o = rr * strafe + f * fwd;
            if (o.sqrMagnitude > 0) o = o.normalized * spd;
            if (strafe != 0 && Blocked(a.yaw - strafe * Mathf.PI / 2, 1.5f)) strafe = -strafe;
            if (fwd != 0 && Blocked(a.yaw + (fwd > 0 ? 0 : Mathf.PI), 1.5f)) o += f * (-fwd * spd * 0.9f);
            if ((reloadT > 0 || (inst != null && inst.mag == 0)) && !a.prone)
            {
                if (coverSearchT <= 0) { coverSearchT = 1.2f; FindCover(t); }
                if (coverT > 0)
                {
                    float dx = coverPos.x - a.pos.x, dz = coverPos.z - a.pos.z, cd = U.Hypot(dx, dz);
                    if (cd > 0.9f) { o = new Vector3(dx / cd * 4, 0, dz / cd * 4); a.crouch = false; } else { o = Vector3.zero; a.crouch = true; }
                }
                else o += f * -2;
            }
            if (Throwables.FireAt(a.pos, 0.5f)) o += f * -5;
            return o.magnitude;
        }

        void Fire(GunDef def, Weapon inst, Vector3 aimP, float dist)
        {
            float now = Now;
            inst.mag--;
            float interval = 60f / def.rpm;
            if (def.cls == GunClass.Pistol && !def.auto) interval = Mathf.Max(interval, 0.28f);
            if (def.action == ActionType.Bolt) interval = Mathf.Max(interval, def.cycle + 0.25f);
            nextFire = now + interval / d.rate;
            if (def.auto)
            {
                if (burstLeft <= 0) burstLeft = U.RandInt(d.b0, d.b1) + (dist < 20 ? 3 : 0);
                burstLeft--;
                if (burstLeft <= 0) burstPause = U.Rand(d.p0, d.p1) * (1 + dist / 80);
            }
            var e = a.Eye();
            var dd = (aimP - e).normalized;
            var r = new Vector3(Mathf.Cos(a.yaw), 0, -Mathf.Sin(a.yaw));
            var m = e + dd * 0.75f + r * 0.12f; m.y -= 0.2f;
            float spread = def.spread * (a.hspeed > 1 ? 1.1f : 0.7f) * (a.prone ? 0.6f : a.crouch ? 0.8f : 1);
            for (int k = 0; k < def.pellets; k++)
            {
                float rr = spread * Mathf.Sqrt(U.R()), th = U.R() * Mathf.PI * 2;
                var p = (dd + r * (Mathf.Cos(th) * rr) + Vector3.up * (Mathf.Sin(th) * rr)).normalized;
                Bullets.Fire(a, e, p, def, m, k < 2 && U.R() < 0.55f, null);
            }
            aimOff.y += def.recoilV * Mathf.Max(dist, 5) * 0.55f;
            aimOff.x += (U.R() - 0.5f) * def.recoilH * dist;
            bool suppressed = inst.Att("muzzle") == "suppressor";
            if (!suppressed && inst.Att("muzzle") != "flash") Fx.Muzzle(m, dd, def.cls == GunClass.Shotgun, false);
            Sfx.Shot(inst.id, a.pos, false, suppressed);
            Match.OnShot(a, def, inst);
            if (a.model != null) a.model.kick = 1;
        }

        void StartReload()
        {
            var inst = a.W(a.cur); if (inst == null) return;
            var def = inst.Def; string am = Data.Extra[inst.id].ammo;
            if (reloadT > 0 || a.ammo[am] <= 0 || inst.mag >= Attachments.Capacity(inst, def)) return;
            reloadT = (def.reloadType == ReloadType.Shell || def.reloadType == ReloadType.Break ? Mathf.Min(3.4f, 0.8f + (def.mag - inst.mag) * def.reload) : def.reload * 1.1f * Attachments.Modifiers(inst).reload) * Reloads.Factor(inst.mag == 0);
            reloadW = a.cur;
            Sfx.Event(def.reloadType == ReloadType.Mag ? "magout" : "open", inst.id, a.pos);
        }
        void FinishReload()
        {
            var inst = a.W(reloadW); if (inst == null) return;
            var def = inst.Def; string am = Data.Extra[inst.id].ammo;
            Sfx.Event(def.reloadType == ReloadType.Mag ? "magin" : "close", inst.id, a.pos);
            int n = Mathf.Min(Attachments.Capacity(inst, def) - inst.mag, a.ammo[am]);
            inst.mag += n; a.ammo[am] -= n;
        }
        void ThrowAt(string kind, Vector3 tgt)
        {
            if (a.throwables[kind] <= 0) return;
            a.throwables[kind]--;
            var e = a.Eye();
            var v = Throwables.Aim(e, tgt, 22);
            var p = e + new Vector3(-Mathf.Sin(a.yaw) * 0.4f, 0, -Mathf.Cos(a.yaw) * 0.4f);
            Throwables.Throw(a, kind, p, v, -1);
            if (a.model != null) a.model.throwT = 0.5f;
        }

        /* ------------ 강하 / 기절 ------------ */
        void UpdateDrop(float dt)
        {
            var p = Match.player;
            if (a.team == p.team && p.alive && (p.state == "freefall" || p.state == "chute" || p.state == "ground"))
            {
                dropTarget = new Vector3(p.pos.x + followOff.x * 1.5f, 0, p.pos.z + followOff.z * 1.5f);
                if (p.state != "freefall" && a.state == "freefall" && a.pos.y - World.HeightAt(a.pos.x, a.pos.z) < 220) Match.OpenChute(a);
            }
            float dx = dropTarget.x - a.pos.x, dz = dropTarget.z - a.pos.z, hd = U.Hypot(dx, dz);
            float gh = World.Ground(a.pos.x, a.pos.z, a.pos.y, 0.3f, 0.5f);
            float agl = a.pos.y - Mathf.Max(gh, World.WaterAt(a.pos.x, a.pos.z));
            float hs, vs;
            if (a.state == "freefall")
            {
                float tFall = agl / 48;
                hs = hd > tFall * 15 ? 34 : U.Clamp(hd / Mathf.Max(tFall, 0.5f), 0, 15);
                vs = hs > 30 ? -60 : -48;
                if (agl < chuteAt) Match.OpenChute(a);
            }
            else { hs = U.Clamp(hd * 0.5f, 0, hd > 30 ? 13 : 8); vs = hs > 12 ? -8.5f : -5.2f; }
            if (hd > 1) a.yaw = Mathf.Atan2(-dx, -dz);
            float k = a.state == "freefall" ? 1.6f : 2.5f;
            a.vel.x = U.Damp(a.vel.x, hd > 0.5f ? dx / hd * hs : 0, k, dt); a.vel.z = U.Damp(a.vel.z, hd > 0.5f ? dz / hd * hs : 0, k, dt);
            a.vel.y = U.Damp(a.vel.y, vs, a.state == "freefall" ? 1.2f : 3, dt);
            a.pos += a.vel * dt;
            float lim = World.HALF - 5; a.pos.x = U.Clamp(a.pos.x, -lim, lim); a.pos.z = U.Clamp(a.pos.z, -lim, lim);
            float g2 = World.Ground(a.pos.x, a.pos.z, a.pos.y + 0.5f, 0.3f, 0.6f);
            if (a.pos.y <= g2 + 0.02f || a.pos.y < World.WaterAt(a.pos.x, a.pos.z) - 1.2f) { Match.Land(a); a.cur = a.BestGun(); thinkT = 0; }
        }

        /* ------------ 차량 ------------ */
        void ConsiderCar()
        {
            if (vehicle != null || goal == null || healing != null || reviving != null || a.prone || a.swimming) return;
            if (a.team == Match.player.team || !a.HasGun()) return;
            if (goalType != "zone" && goalType != "wander") return;
            if (target != null && target.alive && lostT < 8) return;
            float gd = U.Hypot(goal.Value.x - a.pos.x, goal.Value.z - a.pos.z);
            if (gd < 150) return;
            var v = Vehicles.FreeNear(a, 45);
            if (v == null || U.Hypot(goal.Value.x - v.pos.x, goal.Value.z - v.pos.z) > gd + 20) return;
            carDest = goal.Value; carType = goalType;
            carGoal = v; v.claim = a;
            SetGoal(v.pos, "car"); run = true;
        }
        void ThinkDriving()
        {
            var Z = Match.zone; if (Z == null) return;
            var zc = Z.next ?? Z.cur;
            if (goal == null || U.Hypot(goal.Value.x - zc.x, goal.Value.z - zc.z) > zc.r * 0.9f)
            {
                float ang = U.R() * 6.28f, rr = Mathf.Sqrt(U.R()) * zc.r * 0.5f;
                SetGoal(new Vector3(zc.x + Mathf.Cos(ang) * rr, 0, zc.z + Mathf.Sin(ang) * rr), "zone");
            }
        }
        void UpdateVehicle(float dt)
        {
            var v = vehicle;
            bool threat = (visible && target != null && Vector3.Distance(a.pos, target.pos) < 70) || Match.time - hurtByT < 1;
            if (threat || vStuck > 3 || goal == null) vStop = true;
            if (vStop)
            {
                Vehicles.Step(v, a, dt, 0, 0, true);
                if (Mathf.Abs(v.speed) < 3) { Vehicles.BotExit(this); vStop = false; vStuck = 0; carCD = 25; }
                return;
            }
            if (Vehicles.BotDrive(this, dt, goal.Value)) { Vehicles.BotExit(this); carCD = 25; }
        }
        void UpdateKnocked(float dt)
        {
            var team = Match.teams[a.team];
            Actor best = null; float bd = 1e9f;
            foreach (var m in team.members) if (m != a && m.alive && !m.knocked) { float dd = Vector3.Distance(a.pos, m.pos); if (dd < bd) { bd = dd; best = m; } }
            var w = Vector3.zero;
            if (best != null && bd > 2)
            {
                float dx = best.pos.x - a.pos.x, dz = best.pos.z - a.pos.z;
                float yaw = Mathf.Atan2(-dx, -dz);
                a.yaw += U.Clamp(U.AngleDiff(a.yaw, yaw), -2 * dt, 2 * dt);
                w = new Vector3(-Mathf.Sin(a.yaw), 0, -Mathf.Cos(a.yaw));
            }
            a.vel.x = U.Approach(a.vel.x, w.x, 10 * dt); a.vel.z = U.Approach(a.vel.z, w.z, 10 * dt);
            CharPhysics.Move(a, dt);
        }
    }
}
