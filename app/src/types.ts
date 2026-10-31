export type LL = [number, number] // [lon, lat]
export interface Hole { number: number; par: number; handicap: number | null; yards: Record<string, number>; tee: LL; green: LL; path: LL[];
  features: { green: LL[][]; tees: LL[][]; fairways: LL[][]; bunkers: LL[][]; water: LL[][]; woods: LL[][] } }
export interface Course { id: string; name: string; shortName: string; address: string; par: number; holeCount: number; tees: string[];
  geometry: string; location: { lat: number; lon: number; status?: string }; trees: LL[]; holes: Hole[]; seeded?: boolean; mapLabel?: string; addedBy?: string
  extras?: { outline: LL[][]; water: LL[][]; streams: LL[][]; cartpaths: LL[][]; woods: LL[][] } }
export type PositionSource = 'gps' | 'simulated' | 'simulated-far'
export interface Shot { hole: number; shotIndex: number; lat: number; lon: number; club: string; positionSource: PositionSource; ts: number }
export interface Player { name: string; color: string }
export interface HoleResult { shots: Shot[]; score: number }
export type GhostMode = 'last' | 'best' | 'perfect'
export interface Round { id: string; courseId: string; date: number; ghostMode: GhostMode; players: Player[];
  holes: Record<number, HoleResult[]>; complete: boolean; roomCode?: string; startHole?: number }
export interface ClubAvg { yd: number; n: number }
export interface Profile { name: string; color: string; userId?: string; token?: string; clubAvgs?: Record<string, ClubAvg> }
