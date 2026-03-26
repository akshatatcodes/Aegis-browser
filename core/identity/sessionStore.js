/**
 * core/identity/sessionStore.js
 * 
 * Manages per-tab browser sessions (identity + circuit).
 * In Phase 2: In-memory store.
 * In Phase 6+: Will move to Redis.
 */

'use strict';

class SessionStore {
  constructor() {
    this.sessions = new Map();
    this.STALE_TIMEOUT = 3600000; // 1 hour cleanup
    
    // Auto-cleanup stale sessions every 15 minutes
    setInterval(() => this._cleanup(), 15 * 60 * 1000);
  }

  /**
   * Get session for a tabId
   */
  get(tabId) {
    const session = this.sessions.get(tabId);
    if (session) {
      session.lastAccessed = Date.now();
      return session;
    }
    return null;
  }

  /**
   * Set or update session for a tabId
   */
  set(tabId, data) {
    this.sessions.set(tabId, {
      ...data,
      lastAccessed: Date.now()
    });
  }

  /**
   * Check if session exists
   */
  has(tabId) {
    return this.sessions.has(tabId);
  }

  /**
   * Remove a session
   */
  delete(tabId) {
    return this.sessions.delete(tabId);
  }

  /**
   * Internal cleanup of old sessions
   */
  _cleanup() {
    const now = Date.now();
    for (const [tabId, session] of this.sessions.entries()) {
      if (now - session.lastAccessed > this.STALE_TIMEOUT) {
        this.sessions.delete(tabId);
        console.log(`[SessionStore] Purged stale session: ${tabId}`);
      }
    }
  }

  /**
   * Get all active tab IDs
   */
  getActiveTabIds() {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get stats for health check
   */
  getStats() {
    return {
      activeSessions: this.sessions.size
    };
  }
}

module.exports = new SessionStore();
