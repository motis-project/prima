import { describe, it, expect } from 'vitest';
import { computeCosts, InsertionType, ToInsert, type InsertionDurations } from './insertions';

describe('', () => {
	it('TODO', () => {
        const toInsert = ToInsert.PICKUP;
        const type = InsertionType.APPEND;
        const durations: InsertionDurations = {
            approach: 5,
            return: 10,
            pickupToDropoff: 5,
            fromPrev: 5,
            toNext: 5,
            fullWindow:15
        }
        computeCosts(type, durations, toInsert);
    });
});