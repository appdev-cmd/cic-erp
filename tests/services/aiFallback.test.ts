import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callAgentTurn } from '../../services/ai/gateway';

// Mock Supabase to prevent real db calls during tests
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        throwOnError: vi.fn()
      }))
    }))
  }
}));

describe('AI Gateway Fallback Tests', () => {
  const originalFetch = global.fetch;
  const originalLocalStorage = global.localStorage;
  const originalWindow = global.window;
  let storage: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    storage = {};
    
    // Custom robust mockup for localStorage & window in Node test env
    global.window = {
      location: { hostname: 'localhost' }
    } as any;
    
    global.localStorage = {
      getItem: vi.fn((key: string) => storage[key] || null),
      setItem: vi.fn((key: string, val: string) => { storage[key] = val; }),
      removeItem: vi.fn((key: string) => { delete storage[key]; }),
      clear: vi.fn(() => { storage = {}; })
    } as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.localStorage = originalLocalStorage;
    global.window = originalWindow;
  });

  it('should throw error if local model fails and no custom Gemini key is set', async () => {
    // Mock local model to fail
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    await expect(
      callAgentTurn({
        model: 'gemma-4-26b',
        messages: [{ role: 'user', content: 'hello' }]
      })
    ).rejects.toThrow('Máy chủ AI chính gặp sự cố kết nối. Để kích hoạt kết nối dự phòng Gemini, vui lòng cấu hình API Key cá nhân');
  });

  it('should fallback to Gemini if local model fails and custom Gemini key is set', async () => {
    // Set custom key in mock storage
    storage['cic_custom_gemini_key'] = 'fake-user-gemini-key';

    // First call (gemma local) fails, second call (gemini fallback) succeeds
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Connection refused')) // Gemma fails
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Hello from Gemini Fallback',
              role: 'assistant'
            }
          }]
        })
      } as any); // Gemini succeeds

    const res = await callAgentTurn({
      model: 'gemma-4-26b',
      messages: [{ role: 'user', content: 'hello' }]
    });

    expect(res.wasFallback).toBe(true);
    expect(res.activeModel).toBe('gemini-2.0-flash');
    expect(res.message).toBe('Hello from Gemini Fallback');
  });
});
