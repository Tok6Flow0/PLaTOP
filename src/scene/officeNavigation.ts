import type { Activity, Decoration, OfficeAction } from '../types';

export type FloorPoint = readonly [number, number];
export type NavigationBounds = readonly [number, number, number, number];
export interface NavigationBlocker {
  bounds: NavigationBounds;
  officeId?: string;
  decoration?: Decoration;
  deskIndex?: number;
}
export interface WalkZone { bounds: NavigationBounds; floorY: number; officeId?: string }
export interface OfficeAnchor {
  officeId: string;
  place: 'desk' | 'door' | 'lounge' | 'task';
  position: FloorPoint;
  floorY: number;
  facing?: number;
  actorId?: string;
  deskIndex?: number;
  egress?: FloorPoint;
  seatHeight?: number;
}
export interface OfficeMap {
  zones: WalkZone[];
  blockers: NavigationBlocker[];
  waypoints: FloorPoint[];
  anchors: OfficeAnchor[];
  exit: FloorPoint;
  floorY: number;
}
interface LocalLayout {
  floorY: number;
  bounds: NavigationBounds;
  blockers: Array<Omit<NavigationBlocker, 'officeId'>>;
  waypoints: FloorPoint[];
  door: FloorPoint;
  lounge: FloorPoint;
  task: FloorPoint;
  desks: Array<{ position: FloorPoint; egress: FloorPoint; facing: number; seatHeight?: number }>;
}

/** Translate immutable room metadata once; actor ownership remains independent. */
export function makeOfficeMap(rooms: ReadonlyMap<string, { center: { x: number; z: number }; navigation: LocalLayout }>,
  teams: ReadonlyArray<{ id: string; members: ReadonlyArray<{ id: string }> }>,
  campus: { zones: NavigationBounds[]; blockers: NavigationBounds[]; waypoints: FloorPoint[]; exit: FloorPoint; floorY: number }): OfficeMap {
  const map: OfficeMap = {
    zones: campus.zones.map(bounds => ({ bounds, floorY: campus.floorY })),
    blockers: campus.blockers.map(bounds => ({ bounds })), waypoints: [...campus.waypoints],
    anchors: [], exit: campus.exit, floorY: campus.floorY,
  };
  for (const [officeId, room] of rooms) {
    const layout = room.navigation;
    const point = (local: FloorPoint): FloorPoint => [local[0] + room.center.x, local[1] + room.center.z];
    const bounds = (local: NavigationBounds): NavigationBounds =>
      [local[0] + room.center.x, local[1] + room.center.z, local[2] + room.center.x, local[3] + room.center.z];
    map.zones.unshift({ officeId, bounds: bounds(layout.bounds), floorY: layout.floorY });
    map.blockers.push(...layout.blockers.map(blocker => ({ ...blocker, bounds: bounds(blocker.bounds), officeId })));
    map.waypoints.push(...layout.waypoints.map(point));
    for (const place of ['door', 'lounge', 'task'] as const) map.anchors.push({ officeId, place, position: point(layout[place]), floorY: layout.floorY });
    layout.desks.forEach((desk, index) => {
      const actorId = teams.find(team => team.id === officeId)?.members[index]?.id;
      if (actorId) map.anchors.push({ officeId, place: 'desk', actorId, deskIndex: index,
        position: point(desk.position), egress: point(desk.egress), facing: desk.facing,
        floorY: layout.floorY, seatHeight: desk.seatHeight });
    });
  }
  return map;
}
interface RoutePoint { x: number; z: number; y: number }
type MotorMode = 'idle' | 'work' | 'rest' | 'celebrate' | 'walk' | 'away';
const EPSILON = 0.00001;
const CLEARANCE = 0.035;
export const WALK_SPEED = 0.85;
export const WALK_ACCELERATION = 1.7;
export const TURN_SPEED = 2.6;
export const WALK_STRIDE = 0.6;

const distance = (a: FloorPoint, b: FloorPoint): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
const inBounds = (x: number, z: number, b: NavigationBounds, margin = 0): boolean =>
  x >= b[0] - margin && x <= b[2] + margin && z >= b[1] - margin && z <= b[3] + margin;
export const angleDifference = (target: number, current: number): number =>
  Math.atan2(Math.sin(target - current), Math.cos(target - current));

/** Small deterministic floor graph. Planning happens only when an intent changes. */
export class OfficeNavigator {
  private decorations: Record<string, Decoration[]> = {};
  private graph = new Map<string, { points: FloorPoint[]; edges: Array<Array<[number, number]>> }>();
  constructor(readonly map: OfficeMap) {}

  setDecorations(next: Record<string, Decoration[]>): void {
    this.decorations = next;
    this.graph.clear();
  }

  private active(blocker: NavigationBlocker): boolean {
    return !blocker.decoration || !!this.decorations[blocker.officeId ?? '']?.includes(blocker.decoration);
  }

  pointClear(point: FloorPoint, radius: number, ownDesk?: OfficeAnchor): boolean {
    const [x, z] = point;
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radius) || radius < 0) return false;
    const clearance = radius + CLEARANCE;
    // Check the disk against the union of connected floor rectangles. Shrinking
    // rectangles independently would close an otherwise open shared threshold.
    for (let index = 0; index < 16; index++) {
      const angle = index * Math.PI / 8;
      const px = x + Math.cos(angle) * clearance, pz = z + Math.sin(angle) * clearance;
      if (!this.map.zones.some(zone => inBounds(px, pz, zone.bounds, EPSILON))) return false;
    }
    if (!this.map.zones.some(zone => inBounds(x, z, zone.bounds, EPSILON))) return false;
    return !this.map.blockers.some(blocker => this.active(blocker)
      && !(ownDesk?.deskIndex !== undefined && blocker.officeId === ownDesk.officeId && blocker.deskIndex === ownDesk.deskIndex)
      && inBounds(x, z, blocker.bounds, clearance - EPSILON));
  }

  segmentClear(from: FloorPoint, to: FloorPoint, radius: number, ownDesk?: OfficeAnchor): boolean {
    if (!this.pointClear(from, radius, ownDesk) || !this.pointClear(to, radius, ownDesk)) return false;
    const dx = to[0] - from[0], dz = to[1] - from[1];
    const clearance = radius + CLEARANCE;
    // Exact segment/AABB test prevents a large frame or a long graph edge from
    // tunnelling through thin walls, chair backs or table corners.
    for (const blocker of this.map.blockers) {
      if (!this.active(blocker) || (ownDesk?.deskIndex !== undefined && blocker.officeId === ownDesk.officeId && blocker.deskIndex === ownDesk.deskIndex)) continue;
      let near = 0, far = 1;
      for (let axis = 0; axis < 2; axis++) {
        const origin = from[axis], direction = axis ? dz : dx;
        const low = blocker.bounds[axis] - clearance + EPSILON;
        const high = blocker.bounds[axis + 2] + clearance - EPSILON;
        if (Math.abs(direction) < EPSILON) {
          if (origin < low || origin > high) { near = 2; break; }
        } else {
          const first = (low - origin) / direction, second = (high - origin) / direction;
          near = Math.max(near, Math.min(first, second));
          far = Math.min(far, Math.max(first, second));
          if (near > far) break;
        }
      }
      if (near <= far && near <= 1 && far >= 0) return false;
    }
    const samples = Math.ceil(Math.hypot(dx, dz) / 0.12);
    for (let index = 1; index < samples; index++) {
      const fraction = index / samples;
      if (!this.pointClear([from[0] + dx * fraction, from[1] + dz * fraction], radius, ownDesk)) return false;
    }
    return true;
  }

  floorAt(point: FloorPoint): number {
    return this.map.zones.find(zone => inBounds(point[0], point[1], zone.bounds))?.floorY ?? this.map.floorY;
  }

  officeAt(point: FloorPoint): string | undefined {
    return this.map.zones.find(zone => zone.officeId && inBounds(point[0], point[1], zone.bounds))?.officeId;
  }

  desk(actorId: string): OfficeAnchor | undefined { return this.map.anchors.find(anchor => anchor.actorId === actorId && anchor.place === 'desk'); }
  anchor(officeId: string, place: OfficeAnchor['place']): OfficeAnchor | undefined {
    return this.map.anchors.find(anchor => anchor.officeId === officeId && anchor.place === place);
  }

  route(from: FloorPoint, to: FloorPoint, radius: number): FloorPoint[] | null {
    if (this.segmentClear(from, to, radius)) return distance(from, to) < EPSILON ? [] : [to];
    if (!this.pointClear(from, radius) || !this.pointClear(to, radius)) return null;
    const key = radius.toFixed(4);
    let graph = this.graph.get(key);
    if (!graph) {
      const candidates = [...this.map.waypoints, ...this.map.anchors.flatMap(anchor => anchor.egress ? [anchor.egress] : [anchor.position]), this.map.exit];
      const points = candidates.filter((point, index) => this.pointClear(point, radius)
        && candidates.findIndex(other => distance(point, other) < EPSILON) === index);
      const edges: Array<Array<[number, number]>> = points.map(() => []);
      for (let first = 0; first < points.length; first++) for (let second = first + 1; second < points.length; second++) {
        if (!this.segmentClear(points[first], points[second], radius)) continue;
        const length = distance(points[first], points[second]);
        edges[first].push([second, length]); edges[second].push([first, length]);
      }
      graph = { points, edges }; this.graph.set(key, graph);
    }
    const points = [...graph.points, from, to];
    const start = points.length - 2, finish = points.length - 1;
    const edges = graph.edges.map(list => [...list]); edges.push([], []);
    for (const endpoint of [start, finish]) for (let index = 0; index < start; index++) {
      if (!this.segmentClear(points[endpoint], points[index], radius)) continue;
      const length = distance(points[endpoint], points[index]);
      edges[endpoint].push([index, length]); edges[index].push([endpoint, length]);
    }
    const costs = points.map(() => Infinity), previous = points.map(() => -1), visited = points.map(() => false);
    costs[start] = 0;
    for (let count = 0; count < points.length; count++) {
      let best = -1;
      for (let index = 0; index < points.length; index++) if (!visited[index] && (best < 0 || costs[index] < costs[best])) best = index;
      if (best < 0 || !Number.isFinite(costs[best])) return null;
      if (best === finish) break;
      visited[best] = true;
      for (const [next, length] of edges[best]) if (costs[best] + length < costs[next]) {
        costs[next] = costs[best] + length; previous[next] = best;
      }
    }
    if (!Number.isFinite(costs[finish])) return null;
    const path: FloorPoint[] = [];
    for (let index = finish; index !== start; index = previous[index]) {
      if (index < 0) return null;
      path.push(points[index]);
    }
    return path.reverse();
  }
}

/** Visual motor only. It never starts, stops or controls the agent's real work. */
export class OfficeMotor {
  x: number;
  z: number;
  y: number;
  heading: number;
  speed = 0;
  distance = 0;
  mode: MotorMode = 'idle';
  present = true;
  blocked = false;
  manual = false;
  celebration = 0;
  private elapsedCelebration = 0;
  private handledId: string | undefined;
  private previousActivity: Activity = 'unknown';
  private path: RoutePoint[] = [];
  private pathIndex = 0;
  private segmentStart: RoutePoint;
  private finalMode: MotorMode = 'idle';
  private finalFacing: number | undefined;
  private destination: OfficeAnchor | undefined;

  constructor(readonly actorId: string, readonly ownerOfficeId: string, readonly radius: number,
    readonly navigator: OfficeNavigator, readonly home: OfficeAnchor) {
    this.x = home.position[0]; this.z = home.position[1];
    this.y = home.seatHeight ?? home.floorY; this.heading = home.facing ?? 0;
    this.segmentStart = { x: this.x, z: this.z, y: this.y };
  }

  get moving(): boolean { return this.speed > 0.025; }
  get pending(): boolean { return this.pathIndex < this.path.length || this.mode === 'celebrate' || (this.finalFacing !== undefined && Math.abs(angleDifference(this.finalFacing, this.heading)) > EPSILON); }
  get walkPhase(): number { return this.distance / WALK_STRIDE * Math.PI * 2; }
  get floorY(): number { return this.navigator.floorAt([this.x, this.z]); }
  get officeId(): string | undefined { return this.navigator.officeAt([this.x, this.z]); }

  apply(action: OfficeAction): boolean {
    if (action.actorId !== this.actorId || action.id === this.handledId) return false;
    this.handledId = action.id;
    this.manual = true;
    if (action.kind === 'arrive') {
      if (!this.present) {
        this.x = this.navigator.map.exit[0]; this.z = this.navigator.map.exit[1];
        this.y = this.navigator.map.floorY; this.present = true;
      }
      const target = action.target ?? { officeId: this.ownerOfficeId, place: 'desk' as const };
      return this.goTo(this.resolve(target), target.place === 'desk' && target.officeId === this.ownerOfficeId ? 'work' : 'idle');
    }
    if (!this.present) return false;
    if (action.kind === 'walk_to') return this.goTo(action.target ? this.resolve(action.target) : undefined, 'idle');
    if (action.kind === 'leave') return this.goTo({ officeId: '', place: 'door', position: this.navigator.map.exit, floorY: this.navigator.map.floorY }, 'away');
    if (action.kind === 'work' || action.kind === 'rest') return this.goTo(this.home, action.kind);
    this.path = []; this.pathIndex = 0; this.speed = 0;
    this.mode = 'celebrate'; this.finalMode = 'idle'; this.finalFacing = undefined; this.elapsedCelebration = 0;
    return true;
  }

  private resolve(target: NonNullable<OfficeAction['target']>): OfficeAnchor | undefined {
    if (target.place === 'desk' && target.officeId === this.ownerOfficeId) return this.home;
    return this.navigator.anchor(target.officeId, target.place === 'desk' ? 'lounge' : target.place);
  }

  fallback(status: Activity): void {
    const changed = status !== this.previousActivity;
    this.previousActivity = status;
    // Observe activity while a command runs, but do not replace its route. A
    // completed gesture releases on the next real activity transition only.
    // Departed avatars always require an explicit arrive command.
    if (!changed || !this.present || (this.manual && this.pending)) return;
    this.manual = false;
    if (status === 'active') {
      const task = this.navigator.anchor(this.ownerOfficeId, 'task');
      this.goTo(this.home, 'work', task ? [task] : []);
    } else this.goTo(this.home, status === 'sleeping' ? 'rest' : 'idle');
  }

  replan(): void {
    if (this.destination && this.present && (this.pathIndex < this.path.length || this.blocked) && !this.goTo(this.destination, this.finalMode)) {
      this.path = []; this.pathIndex = 0; this.speed = 0; this.mode = 'idle'; this.finalFacing = undefined;
    }
  }

  private goTo(target: OfficeAnchor | undefined, mode: MotorMode, via: OfficeAnchor[] = []): boolean {
    if (!target) { this.blocked = true; return false; }
    if (!via.length && distance([this.x, this.z], target.position) < EPSILON) {
      this.path = []; this.pathIndex = 0; this.destination = target;
      this.finalMode = mode; this.finalFacing = target.facing;
      this.blocked = false; this.finish(); return true;
    }
    const path: RoutePoint[] = [];
    let from: FloorPoint = [this.x, this.z];
    // An assigned chair may be entered/exited only through its explicit short
    // egress segment. Every ordinary graph edge still treats all chairs solid.
    if (this.home.egress && !this.navigator.pointClear(from, this.radius)) {
      if (!this.navigator.segmentClear(from, this.home.egress, this.radius, this.home)) { this.blocked = true; return false; }
      path.push({ x: this.home.egress[0], z: this.home.egress[1], y: this.home.floorY });
      from = this.home.egress;
    }
    for (const anchor of [...via, target]) {
      const goal = anchor.egress ?? anchor.position;
      const planned = this.navigator.route(from, goal, this.radius);
      if (!planned) { this.blocked = true; return false; }
      planned.forEach(point => path.push({ x: point[0], z: point[1], y: this.navigator.floorAt(point) }));
      if (anchor.egress && distance(anchor.egress, anchor.position) > EPSILON) {
        if (!this.navigator.segmentClear(anchor.egress, anchor.position, this.radius, anchor)) { this.blocked = true; return false; }
        path.push({ x: anchor.position[0], z: anchor.position[1], y: anchor.seatHeight ?? anchor.floorY });
      }
      from = anchor.position;
    }
    this.path = path; this.pathIndex = 0;
    this.segmentStart = { x: this.x, z: this.z, y: this.y };
    this.destination = target; this.finalMode = mode; this.finalFacing = target.facing;
    this.blocked = false; this.elapsedCelebration = 0; this.celebration = 0;
    if (path.length) this.mode = 'walk'; else this.finish();
    return true;
  }

  private finish(): void {
    this.speed = 0; this.mode = this.finalMode;
    if (this.finalFacing !== undefined && Math.abs(angleDifference(this.finalFacing, this.heading)) <= EPSILON) this.heading = this.finalFacing;
    if (this.mode === 'away') this.present = false;
  }

  update(seconds: number): void {
    const delta = Math.min(0.1, Math.max(0, seconds));
    if (!delta || !this.present) return;
    this.celebration = 0;
    if (this.pathIndex < this.path.length) {
      const target = this.path[this.pathIndex];
      const dx = target.x - this.x, dz = target.z - this.z;
      const remaining = Math.hypot(dx, dz);
      const desired = remaining > EPSILON ? Math.atan2(dx, dz) : this.heading;
      const turn = angleDifference(desired, this.heading);
      this.heading += Math.max(-TURN_SPEED * delta, Math.min(TURN_SPEED * delta, turn));
      const brakingSpeed = Math.sqrt(WALK_ACCELERATION ** 2 * delta ** 2 + 2 * WALK_ACCELERATION * remaining) - WALK_ACCELERATION * delta;
      const targetSpeed = Math.abs(turn) > 0.3 ? 0 : Math.min(WALK_SPEED, brakingSpeed);
      this.speed += Math.max(-WALK_ACCELERATION * delta, Math.min(WALK_ACCELERATION * delta, targetSpeed - this.speed));
      const travel = Math.min(remaining, this.speed * delta);
      if (remaining > EPSILON) { this.x += dx / remaining * travel; this.z += dz / remaining * travel; }
      this.distance += travel;
      const segmentLength = Math.hypot(target.x - this.segmentStart.x, target.z - this.segmentStart.z);
      const fraction = segmentLength > EPSILON ? 1 - (remaining - travel) / segmentLength : 1;
      const blend = Math.max(0, Math.min(1, fraction));
      this.y = this.segmentStart.y + (target.y - this.segmentStart.y) * blend * blend * (3 - 2 * blend);
      if (remaining - travel < EPSILON) {
        this.x = target.x; this.z = target.z; this.y = target.y;
        this.segmentStart = target; this.pathIndex++; this.speed = 0;
        if (this.pathIndex === this.path.length) this.finish();
      }
    } else if (this.finalFacing !== undefined) {
      const turn = angleDifference(this.finalFacing, this.heading);
      this.heading += Math.max(-TURN_SPEED * delta, Math.min(TURN_SPEED * delta, turn));
      if (Math.abs(turn) <= TURN_SPEED * delta) this.heading = this.finalFacing;
    }
    if (this.mode === 'celebrate') {
      this.elapsedCelebration += delta;
      this.celebration = Math.sin(Math.min(1, this.elapsedCelebration / 1.6) * Math.PI);
      if (this.elapsedCelebration >= 1.6) this.mode = 'idle';
    }
  }
}
