import type { Activity, Decoration, OfficeAction, OfficeGesture, OfficeMotion } from '../types';

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
  place: 'desk' | 'door' | 'lounge' | 'task' | 'whiteboard' | 'cabinet';
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
  interactions?: Partial<Record<'whiteboard' | 'cabinet', { position: FloorPoint; facing: number }>>;
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
    for (const place of ['whiteboard', 'cabinet'] as const) {
      const interaction = layout.interactions?.[place];
      if (interaction) map.anchors.push({ officeId, place, position: point(interaction.position),
        facing: interaction.facing, floorY: layout.floorY });
    }
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
type MotorMode = 'idle' | 'work' | 'rest' | 'celebrate' | 'walk' | 'away' | 'interact';
const EPSILON = 0.00001;
const CLEARANCE = 0.035;
export const WALK_SPEED = 0.85;
export const WALK_ACCELERATION = 1.7;
export const TURN_SPEED = 2.6;
export const WALK_STRIDE = 0.6;

export interface MovementProfile {
  speed: number; acceleration: number; turnSpeed: number; stride: number;
  phase: number; lateral: number; side: number; route: 'natural' | 'direct' | 'roomy';
}

/** Identity affects how an already-chosen journey looks, never whether one
 * happens. No random timer, status classifier, role assignment or private ID. */
export function movementProfile(actorId: string, choice: OfficeMotion = {}): Readonly<MovementProfile> {
  let seed = 2166136261;
  for (const character of actorId) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  const sample = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const pace = choice.pace === 'unhurried' ? .74 : choice.pace === 'brisk' ? 1.24 : 1;
  return Object.freeze({ speed: WALK_SPEED * (.84 + .34 * sample()) * pace,
    acceleration: WALK_ACCELERATION * (.76 + .45 * sample()) * pace,
    turnSpeed: TURN_SPEED * (.80 + .35 * sample()), stride: WALK_STRIDE * (.80 + .35 * sample()),
    phase: sample() * Math.PI * 2, lateral: .10 + .16 * sample(), side: sample() < .5 ? -1 : 1,
    route: choice.route ?? 'natural' });
}

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

  route(from: FloorPoint, to: FloorPoint, radius: number, profile?: Readonly<MovementProfile>): FloorPoint[] | null {
    // More elbow room is a preference, not permission to abandon a reachable
    // doorway. The certified body clearance remains the minimum in all cases.
    let clearance = profile?.route === 'roomy' ? radius + .10 : radius;
    let path = this.shortestRoute(from, to, clearance, profile);
    if (!path && clearance > radius) { clearance = radius; path = this.shortestRoute(from, to, clearance, profile); }
    if (!path || !profile || !path.length) return path;
    return this.shapeRoute(from, path, clearance, profile);
  }

  private shortestRoute(from: FloorPoint, to: FloorPoint, radius: number, profile?: Readonly<MovementProfile>): FloorPoint[] | null {
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
      for (const [next, length] of edges[best]) {
        const side = ((to[0] - from[0]) * ((points[best][1] + points[next][1]) / 2 - from[1])
          - (to[1] - from[1]) * ((points[best][0] + points[next][0]) / 2 - from[0])) / Math.max(EPSILON, distance(from, to));
        const cost = length * (1 + (profile && profile.route !== 'direct' ? .06 * profile.side * Math.tanh(side) : 0));
        if (costs[best] + cost < costs[next]) { costs[next] = costs[best] + cost; previous[next] = best; }
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

  /** Gentle individual lines and rounded corners, planned once per intent.
   * Every proposed segment is certified; tight spaces keep the shared safe line. */
  private shapeRoute(from: FloorPoint, path: FloorPoint[], radius: number, profile: Readonly<MovementProfile>): FloorPoint[] {
    const bowed: FloorPoint[] = [from];
    let previous = from;
    for (const target of path) {
      const length = distance(previous, target);
      if (length > 1.4 && profile.route !== 'direct') {
        const bend = profile.lateral * profile.side * (profile.route === 'roomy' ? 1.25 : 1);
        for (const factor of [1, .5]) {
          const samples: FloorPoint[] = [.25, .5, .75, 1].map(t => [
            previous[0] + (target[0] - previous[0]) * t - (target[1] - previous[1]) / length * Math.sin(Math.PI * t) * bend * factor,
            previous[1] + (target[1] - previous[1]) * t + (target[0] - previous[0]) / length * Math.sin(Math.PI * t) * bend * factor,
          ]);
          samples[samples.length - 1] = target;
          if (samples.every((point, i) => this.segmentClear(i ? samples[i - 1] : previous, point, radius))) {
            bowed.push(...samples.slice(0, -1)); break;
          }
        }
      }
      bowed.push(target); previous = target;
    }
    const rounded: FloorPoint[] = [from];
    for (let i = 1; i < bowed.length - 1; i++) {
      const a = bowed[i - 1], b = bowed[i], c = bowed[i + 1];
      const incoming = distance(a, b), outgoing = distance(b, c), cut = Math.min(.24, incoming * .25, outgoing * .25);
      if (cut < .015) { rounded.push(b); continue; }
      const entry: FloorPoint = [b[0] + (a[0] - b[0]) * cut / incoming, b[1] + (a[1] - b[1]) * cut / incoming];
      const exit: FloorPoint = [b[0] + (c[0] - b[0]) * cut / outgoing, b[1] + (c[1] - b[1]) * cut / outgoing];
      const curve: FloorPoint[] = [0, .25, .5, .75, 1].map(t => [
        (1 - t) ** 2 * entry[0] + 2 * t * (1 - t) * b[0] + t * t * exit[0],
        (1 - t) ** 2 * entry[1] + 2 * t * (1 - t) * b[1] + t * t * exit[1],
      ]);
      if (curve.every((point, index) => this.segmentClear(index ? curve[index - 1] : rounded[rounded.length - 1], point, radius))
        && this.segmentClear(exit, c, radius)) rounded.push(...curve);
      else rounded.push(b);
    }
    rounded.push(path[path.length - 1]);
    // Exact destinations matter for seating and prop interaction; no random
    // endpoint jitter or route changes from an activity heartbeat.
    return rounded.slice(1).filter((point, index) => distance(point, rounded[index]) > EPSILON);
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
  gesture: OfficeGesture | undefined;
  profile: Readonly<MovementProfile>;
  private elapsedCelebration = 0;
  private handledId: string | undefined;
  private path: RoutePoint[] = [];
  private pathIndex = 0;
  private segmentStart: RoutePoint;
  private finalMode: MotorMode = 'idle';
  private finalFacing: number | undefined;
  private finalGesture: OfficeGesture | undefined;
  private destination: OfficeAnchor | undefined;

  constructor(readonly actorId: string, readonly ownerOfficeId: string, readonly radius: number,
    readonly navigator: OfficeNavigator, readonly home: OfficeAnchor) {
    this.x = home.position[0]; this.z = home.position[1];
    this.y = home.seatHeight ?? home.floorY; this.heading = home.facing ?? 0;
    this.profile = movementProfile(actorId);
    this.segmentStart = { x: this.x, z: this.z, y: this.y };
  }

  get moving(): boolean { return this.speed > 0.025; }
  get pending(): boolean { return this.pathIndex < this.path.length || this.mode === 'celebrate' || (this.finalFacing !== undefined && Math.abs(angleDifference(this.finalFacing, this.heading)) > EPSILON); }
  get walkPhase(): number { return this.distance / this.profile.stride * Math.PI * 2 + this.profile.phase; }
  get floorY(): number { return this.navigator.floorAt([this.x, this.z]); }
  get officeId(): string | undefined { return this.navigator.officeAt([this.x, this.z]); }

  /** Restore a chosen public intent in a new view, not proof of a past arrival. */
  restore(action: OfficeAction): boolean {
    if (action.actorId !== this.actorId || (action.id === this.handledId && !this.pending)) return false;
    let target: OfficeAnchor | undefined;
    let mode: MotorMode = 'idle';
    let gesture: OfficeGesture | undefined;
    if (action.kind === 'leave') {
      target = { officeId: '', place: 'door', position: this.navigator.map.exit, floorY: this.navigator.map.floorY };
      mode = 'away';
    } else if (action.kind === 'work' || action.kind === 'rest') {
      target = this.home; mode = action.kind;
    } else if (action.kind === 'arrive') {
      const destination = action.target ?? { officeId: this.ownerOfficeId, place: 'desk' as const };
      target = this.resolve(destination);
      mode = destination.place === 'desk' && destination.officeId === this.ownerOfficeId ? 'work' : 'idle';
    } else if (action.kind === 'walk_to' || action.kind === 'interact') {
      target = action.target ? this.resolve(action.target) : undefined;
      if (action.kind === 'interact') {
        if (!action.gesture) return false;
        mode = 'interact'; gesture = action.gesture;
      }
    } else if (action.kind !== 'celebrate') return false;
    // Validate before changing any pose or consumed ID. Assigned chairs retain
    // their certified short egress exception; other stops use ordinary clearance.
    if (action.kind !== 'celebrate') {
      if (!target) return false;
      const start = this.home.egress ?? this.home.position, goal = target.egress ?? target.position;
      if (!this.navigator.pointClear(goal, this.radius)
        || (target.egress && !this.navigator.segmentClear(target.egress, target.position, this.radius, target))
        || !this.navigator.route(start, goal, this.radius)) return false;
    }
    this.handledId = action.id; this.manual = true;
    this.profile = movementProfile(this.actorId, action.motion);
    this.path = []; this.pathIndex = 0; this.speed = 0; this.distance = 0;
    this.destination = target; this.finalMode = mode; this.finalGesture = gesture;
    this.finalFacing = target?.facing; this.blocked = false;
    this.elapsedCelebration = 0; this.celebration = 0;
    if (target) {
      this.x = target.position[0]; this.z = target.position[1];
      this.y = target.seatHeight ?? target.floorY;
      this.heading = target.facing ?? this.heading;
    }
    this.segmentStart = { x: this.x, z: this.z, y: this.y };
    this.present = mode !== 'away'; this.mode = mode; this.gesture = gesture;
    return true;
  }

  apply(action: OfficeAction): boolean {
    if (action.actorId !== this.actorId || action.id === this.handledId) return false;
    this.handledId = action.id;
    this.manual = true;
    const profile = movementProfile(this.actorId, action.motion);
    if (action.kind === 'arrive') {
      if (!this.present) {
        this.x = this.navigator.map.exit[0]; this.z = this.navigator.map.exit[1];
        this.y = this.navigator.map.floorY; this.present = true;
      }
      const target = action.target ?? { officeId: this.ownerOfficeId, place: 'desk' as const };
      return this.goTo(this.resolve(target), target.place === 'desk' && target.officeId === this.ownerOfficeId ? 'work' : 'idle', undefined, profile);
    }
    if (!this.present) return false;
    if (action.kind === 'walk_to') return this.goTo(action.target ? this.resolve(action.target) : undefined, 'idle', undefined, profile);
    if (action.kind === 'interact') return action.gesture !== undefined && this.goTo(action.target ? this.resolve(action.target) : undefined, 'interact', action.gesture, profile);
    if (action.kind === 'leave') return this.goTo({ officeId: '', place: 'door', position: this.navigator.map.exit, floorY: this.navigator.map.floorY }, 'away', undefined, profile);
    if (action.kind === 'work' || action.kind === 'rest') return this.goTo(this.home, action.kind, undefined, profile);
    this.path = []; this.pathIndex = 0; this.speed = 0;
    this.gesture = undefined; this.finalGesture = undefined; this.destination = undefined;
    this.mode = 'celebrate'; this.finalMode = 'idle'; this.finalFacing = undefined; this.elapsedCelebration = 0;
    return true;
  }

  private resolve(target: NonNullable<OfficeAction['target']>): OfficeAnchor | undefined {
    if (target.place === 'desk' && target.officeId === this.ownerOfficeId) return this.home;
    return this.navigator.anchor(target.officeId, target.place === 'desk' ? 'lounge' : target.place);
  }

  /** Compatibility hook: activity is reporting, never an avatar movement intent. */
  fallback(_status: Activity): void {}

  replan(): void {
    if (this.destination && this.present && (this.pathIndex < this.path.length || this.blocked) && !this.goTo(this.destination, this.finalMode, this.finalGesture)) {
      this.path = []; this.pathIndex = 0; this.speed = 0; this.mode = 'idle'; this.finalFacing = undefined; this.gesture = undefined;
    }
  }

  private goTo(target: OfficeAnchor | undefined, mode: MotorMode, gesture?: OfficeGesture, profile = this.profile): boolean {
    if (!target) { this.blocked = true; return false; }
    if (distance([this.x, this.z], target.position) < EPSILON) {
      this.profile = profile;
      this.path = []; this.pathIndex = 0; this.destination = target;
      this.finalMode = mode; this.finalFacing = target.facing; this.finalGesture = gesture; this.gesture = undefined;
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
    for (const anchor of [target]) {
      const goal = anchor.egress ?? anchor.position;
      const planned = this.navigator.route(from, goal, this.radius, profile);
      if (!planned) { this.blocked = true; return false; }
      planned.forEach(point => path.push({ x: point[0], z: point[1], y: this.navigator.floorAt(point) }));
      if (anchor.egress && distance(anchor.egress, anchor.position) > EPSILON) {
        if (!this.navigator.segmentClear(anchor.egress, anchor.position, this.radius, anchor)) { this.blocked = true; return false; }
        path.push({ x: anchor.position[0], z: anchor.position[1], y: anchor.seatHeight ?? anchor.floorY });
      }
      from = anchor.position;
    }
    this.profile = profile;
    this.path = path; this.pathIndex = 0;
    this.segmentStart = { x: this.x, z: this.z, y: this.y };
    this.destination = target; this.finalMode = mode; this.finalFacing = target.facing;
    this.finalGesture = gesture; this.gesture = undefined;
    this.blocked = false; this.elapsedCelebration = 0; this.celebration = 0;
    if (path.length) this.mode = 'walk'; else this.finish();
    return true;
  }

  private finish(): void {
    this.speed = 0; this.mode = this.finalMode;
    if (this.finalFacing !== undefined && Math.abs(angleDifference(this.finalFacing, this.heading)) <= EPSILON) this.heading = this.finalFacing;
    this.gesture = this.mode === 'interact' && (this.finalFacing === undefined || Math.abs(angleDifference(this.finalFacing, this.heading)) <= EPSILON)
      ? this.finalGesture : undefined;
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
      const { speed: cruise, acceleration, turnSpeed } = this.profile;
      this.heading += Math.max(-turnSpeed * delta, Math.min(turnSpeed * delta, turn));
      const next = this.path[this.pathIndex + 1];
      const corner = next ? Math.abs(angleDifference(Math.atan2(next.x - target.x, next.z - target.z), desired)) : Math.PI;
      const cornerSpeed = next ? cruise * Math.max(0, 1 - corner / 1.2) : 0;
      const brakingSpeed = Math.sqrt(acceleration ** 2 * delta ** 2 + cornerSpeed ** 2 + 2 * acceleration * remaining) - acceleration * delta;
      const targetSpeed = Math.min(cruise, Math.max(0, brakingSpeed)) * Math.max(0, 1 - Math.abs(turn) / 1.2);
      this.speed += Math.max(-acceleration * delta, Math.min(acceleration * delta, targetSpeed - this.speed));
      const travel = Math.min(remaining, this.speed * delta);
      if (remaining > EPSILON) { this.x += dx / remaining * travel; this.z += dz / remaining * travel; }
      this.distance += travel;
      const segmentLength = Math.hypot(target.x - this.segmentStart.x, target.z - this.segmentStart.z);
      const fraction = segmentLength > EPSILON ? 1 - (remaining - travel) / segmentLength : 1;
      const blend = Math.max(0, Math.min(1, fraction));
      this.y = this.segmentStart.y + (target.y - this.segmentStart.y) * blend * blend * (3 - 2 * blend);
      if (remaining - travel < EPSILON) {
        this.x = target.x; this.z = target.z; this.y = target.y;
        this.segmentStart = target; this.pathIndex++;
        if (this.pathIndex === this.path.length) this.finish();
      }
    } else if (this.finalFacing !== undefined) {
      const turn = angleDifference(this.finalFacing, this.heading);
      this.heading += Math.max(-this.profile.turnSpeed * delta, Math.min(this.profile.turnSpeed * delta, turn));
      if (Math.abs(turn) <= this.profile.turnSpeed * delta) this.heading = this.finalFacing;
      if (this.mode === 'interact' && this.heading === this.finalFacing) this.gesture = this.finalGesture;
    }
    if (this.mode === 'celebrate') {
      this.elapsedCelebration += delta;
      this.celebration = Math.sin(Math.min(1, this.elapsedCelebration / 1.6) * Math.PI);
      if (this.elapsedCelebration >= 1.6) this.mode = 'idle';
    }
  }
}
