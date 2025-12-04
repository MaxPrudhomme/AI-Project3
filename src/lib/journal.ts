import type { State } from './automaton';
import type { Item } from './player';

export type JournalEntryType = 'node_change' | 'item_found' | 'item_used';

export interface BaseJournalEntry {
  id: string;
  timestamp: number;
  type: JournalEntryType;
}

export interface NodeChangeEntry extends BaseJournalEntry {
  type: 'node_change';
  fromBiome: string;
  toBiome: string;
  odds: number; // Weight as percentage (0-100)
  modifiedByItem: boolean; // Whether odds were affected by an item
}

export interface ItemFoundEntry extends BaseJournalEntry {
  type: 'item_found';
  itemName: string;
  itemDescription: string;
  itemRarity: Item['rarity'];
}

export interface ItemUsedEntry extends BaseJournalEntry {
  type: 'item_used';
  itemName: string;
  itemDescription: string;
}

export type JournalEntry = NodeChangeEntry | ItemFoundEntry | ItemUsedEntry;

export type JournalFilter = 'all' | 'nodes' | 'items';

class JournalManager {
  private entries: JournalEntry[] = [];

  /**
   * Add a new journal entry
   */
  public addEntry(entry: Omit<JournalEntry, 'id' | 'timestamp'>): void {
    const newEntry: JournalEntry = {
      ...entry,
      id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    } as JournalEntry;
    
    this.entries.unshift(newEntry); // Add to beginning (newest first)
  }

  /**
   * Get all entries, optionally filtered
   */
  public getEntries(filter: JournalFilter = 'all'): JournalEntry[] {
    if (filter === 'all') {
      return [...this.entries];
    }
    
    if (filter === 'nodes') {
      return this.entries.filter(entry => entry.type === 'node_change');
    }
    
    if (filter === 'items') {
      return this.entries.filter(entry => entry.type === 'item_found' || entry.type === 'item_used');
    }
    
    return [...this.entries];
  }

  /**
   * Clear all entries
   */
  public clear(): void {
    this.entries = [];
  }

  /**
   * Get entry count
   */
  public getEntryCount(filter: JournalFilter = 'all'): number {
    return this.getEntries(filter).length;
  }
}

export const journalManager = new JournalManager();

