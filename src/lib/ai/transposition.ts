// LRU-based transposition table for caching evaluated positions.

interface TTEntry {
  hash: bigint;
  depth: number;
  value: number;
  flag: "exact" | "lower" | "upper";
  bestMove?: { fromRow: number; fromCol: number; toRow: number; toCol: number };
}

const MAX_SIZE = 1_000_000; // 1M entries

class TranspositionTable {
  private map = new Map<string, TTEntry>();

  get(hash: bigint): TTEntry | undefined {
    return this.map.get(hash.toString());
  }

  set(entry: TTEntry): void {
    const key = entry.hash.toString();
    // If the position already exists, only replace if new search is deeper
    const existing = this.map.get(key);
    if (existing && existing.depth >= entry.depth) return;

    this.map.set(key, entry);

    // LRU eviction: delete oldest entries when exceeding max size
    if (this.map.size > MAX_SIZE) {
      const firstKey = this.map.keys().next().value;
      if (firstKey) this.map.delete(firstKey);
    }
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

export const transpositionTable = new TranspositionTable();
