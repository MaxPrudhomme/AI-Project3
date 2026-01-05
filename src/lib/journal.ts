import type { Item } from './player';

export type JournalEntryType = 'node_change' | 'item_found' | 'item_used' | 'llm_decision';

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

export interface LLMDecisionEntry extends BaseJournalEntry {
  type: 'llm_decision';
  action: 'move' | 'use_item';
  reasoning: string;
  modelId: string;
  itemName?: string;
}

export type JournalEntry = NodeChangeEntry | ItemFoundEntry | ItemUsedEntry | LLMDecisionEntry;

export type JournalFilter = 'all' | 'nodes' | 'items' | 'llm';

class JournalManager {
  private entries: JournalEntry[] = [];

  /**
   * Add a new journal entry
   */
  public addEntry(entry: 
    | Omit<NodeChangeEntry, 'id' | 'timestamp'>
    | Omit<ItemFoundEntry, 'id' | 'timestamp'>
    | Omit<ItemUsedEntry, 'id' | 'timestamp'>
    | Omit<LLMDecisionEntry, 'id' | 'timestamp'>
  ): void {
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
    
    if (filter === 'llm') {
      return this.entries.filter(entry => entry.type === 'llm_decision');
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

