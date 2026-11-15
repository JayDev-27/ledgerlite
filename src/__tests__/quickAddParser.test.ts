import { describe, it, expect } from 'vitest';
import { parseExpenseTextLocally } from '@/lib/quickAddParser';

describe('parseExpenseTextLocally', () => {
  it('parses "450 zomato yesterday upi"', () => {
    const draft = parseExpenseTextLocally('450 zomato yesterday upi');
    expect(draft.amount).toBe(450);
    expect(draft.merchant.toLowerCase()).toContain('zomato');
    expect(draft.paymentMethod).toBe('upi');
    expect(draft.categoryId).toBe('cat_food_dining');
  });

  it('parses "15k rent neft"', () => {
    const draft = parseExpenseTextLocally('15k rent neft');
    expect(draft.amount).toBe(15000);
    expect(draft.paymentMethod).toBe('net_banking');
    expect(draft.categoryId).toBe('cat_housing');
  });

  it('parses "₹1200 shell petrol card"', () => {
    const draft = parseExpenseTextLocally('₹1200 shell petrol card');
    expect(draft.amount).toBe(1200);
    expect(draft.paymentMethod).toBe('card');
    expect(draft.categoryId).toBe('cat_transport');
  });

  it('parses Indian variations with spaces, rupee symbols, commas, and slash-dash', () => {
    // "₹ 450 zomato"
    const d1 = parseExpenseTextLocally('₹ 450 zomato');
    expect(d1.amount).toBe(450);
    expect(d1.merchant.toLowerCase()).not.toContain('₹');
    expect(d1.merchant.toLowerCase()).toContain('zomato');

    // "450/- zomato"
    const d2 = parseExpenseTextLocally('450/- zomato');
    expect(d2.amount).toBe(450);
    expect(d2.merchant.toLowerCase()).toContain('zomato');

    // "1,500 uber card"
    const d3 = parseExpenseTextLocally('1,500 uber card');
    expect(d3.amount).toBe(1500);
    expect(d3.merchant.toLowerCase()).toContain('uber');

    // "rs. 450 swiggy"
    const d4 = parseExpenseTextLocally('rs. 450 swiggy');
    expect(d4.amount).toBe(450);
    expect(d4.merchant.toLowerCase()).not.toContain('rs');
    expect(d4.merchant.toLowerCase()).toContain('swiggy');
  });

  it('defaults gracefully for unrecognized text', () => {
    const draft = parseExpenseTextLocally('random something');
    expect(draft.amount).toBeNull();
    expect(draft.paymentMethod).toBe('upi');
    expect(draft.categoryId).toBe('cat_misc');
  });

  it('handles decimal amounts, Indian lakhs grouping, and empty inputs', () => {
    const d1 = parseExpenseTextLocally('₹450.75 chai point upi');
    expect(d1.amount).toBe(450.75);
    expect(d1.merchant.toLowerCase()).toContain('chai point');

    const d2 = parseExpenseTextLocally('1,50,000 house rent neft');
    expect(d2.amount).toBe(150000);
    expect(d2.paymentMethod).toBe('net_banking');
    expect(d2.categoryId).toBe('cat_housing');

    const d3 = parseExpenseTextLocally('   ');
    expect(d3.amount).toBeNull();
    expect(d3.merchant).toBe('Expense');
  });
});
