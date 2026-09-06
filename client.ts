import { createClient } from "@libsql/client";
import { EventEmitter } from "events";

interface TursoClientOptions {
    url: string;
    token: string;
    syncUrl?: string;
    maxKeys?: number;
    cleanupInterval?: number;
}

interface SetOptions {
    ttl?: number;
    nx?: boolean;
    xx?: boolean;
    keepTTL?: boolean;
}

interface ScanResult {
    cursor: number;
    keys: string[];
}

class tursoClient extends EventEmitter {
    public url: string;
    public token: string;
    public turso: any;
    public _initPromise: any;
    private _cleanupInterval: NodeJS.Timeout | null;
    private _maxKeys: number;
    private _isReady: boolean;

    constructor(options: TursoClientOptions) {
        super();

        this.url = options.url;
        this.token = options.token;
        this.turso = createClient({
            url: this.url,
            authToken: this.token,
            ...(options.syncUrl && { syncUrl: options.syncUrl })
        });
        this._cleanupInterval = null;
        this._maxKeys = options.maxKeys || 1000000;
        this._isReady = false;
        this._initPromise = this._init();
    }

    private async _init() {
        await this._initTable();
        this._isReady = true;
        this._startCleanup(3600000);
        this.emit('ready');
    }

    private async _initTable() {
        await this.turso.execute(`
            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                value TEXT,
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                type TEXT DEFAULT 'string'
            )
        `);
        await this.turso.execute(`
            CREATE INDEX IF NOT EXISTS idx_expires_at ON cache(expires_at)
        `);
        await this.turso.execute(`
            CREATE INDEX IF NOT EXISTS idx_created_at ON cache(created_at)
        `);
        await this.turso.execute(`
            CREATE INDEX IF NOT EXISTS idx_type ON cache(type)
        `);
    }

    private _startCleanup(intervalMs: number) {
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
        }
        this._cleanupInterval = setInterval(() => {
            this.cleanupExpired().catch(err => {
                this.emit('error', err);
            });
        }, intervalMs);
    }

    private _ensureReady() {
        if (!this._isReady) {
            throw new Error('Client not ready. Wait for ready event.');
        }
    }

    private _serialize(value: any): string {
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return String(value);
        if (typeof value === 'boolean') return String(value);
        return JSON.stringify(value);
    }

    private _deserialize(value: string): any {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    public async get(key: string): Promise<any> {
        await this._initPromise;
        this._ensureReady();
        
        const result = await this.turso.execute({
            sql: `SELECT value FROM cache 
                  WHERE key = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
            args: [key]
        });
        
        if (result.rows.length === 0) return null;
        return this._deserialize(result.rows[0].value);
    }

    public async mget(...keys: string[]): Promise<any[]> {
        await this._initPromise;
        this._ensureReady();
        
        if (keys.length === 0) return [];
        
        const placeholders = keys.map(() => '?').join(',');
        const result = await this.turso.execute({
            sql: `SELECT key, value FROM cache 
                  WHERE key IN (${placeholders}) 
                  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
            args: keys
        });
        
        const valueMap: Record<string, any> = {};
        result.rows.forEach((row: any) => {
            valueMap[row.key] = this._deserialize(row.value);
        });
        
        return keys.map(key => valueMap[key] || null);
    }

    public async set(key: string, value: any, options: SetOptions = {}): Promise<string | null> {
        await this._initPromise;
        this._ensureReady();
        
        const serialized = this._serialize(value);
        const now = new Date().toISOString();
        
        if (options.nx) {
            const exists = await this.exists(key);
            if (exists) return null;
        }
        
        if (options.xx) {
            const exists = await this.exists(key);
            if (!exists) return null;
        }
        
        let expiresAt: string | null = null;
        
        if (options.keepTTL) {
            const currentTTL = await this.ttl(key);
            if (currentTTL > 0) {
                expiresAt = `datetime('now', '+${currentTTL} seconds')`;
            }
        } else if (options.ttl) {
            expiresAt = `datetime('now', '+${options.ttl} seconds')`;
        }
        
        const existing = await this.turso.execute({
            sql: `SELECT created_at FROM cache WHERE key = ?`,
            args: [key]
        });
        
        const createdAt = existing.rows.length > 0 
            ? existing.rows[0].created_at 
            : now;
        
        await this.turso.execute({
            sql: `INSERT OR REPLACE INTO cache (key, value, expires_at, created_at, updated_at, type) 
                  VALUES (?, ?, ${expiresAt || 'NULL'}, ?, ?, 'string')`,
            args: [key, serialized, createdAt, now]
        });
        
        return "OK";
    }

    public async mset(keyValuePairs: Record<string, any>): Promise<string> {
        await this._initPromise;
        this._ensureReady();
        
        const entries = Object.entries(keyValuePairs);
        if (entries.length === 0) return "OK";
        
        const now = new Date().toISOString();
        const placeholders = entries.map(() => '(?, ?, NULL, ?, ?, ?)').join(',');
        const flatArgs: any[] = [];
        
        entries.forEach(([key, value]) => {
            flatArgs.push(key);
            flatArgs.push(this._serialize(value));
            flatArgs.push(now);
            flatArgs.push(now);
            flatArgs.push('string');
        });
        
        await this.turso.execute({
            sql: `INSERT OR REPLACE INTO cache (key, value, expires_at, created_at, updated_at, type) 
                  VALUES ${placeholders}`,
            args: flatArgs
        });
        
        return "OK";
    }

    public async exists(key: string): Promise<boolean>;
    public async exists(...keys: string[]): Promise<number>;
    public async exists(...keys: string[]): Promise<boolean | number> {
        await this._initPromise;
        this._ensureReady();
        
        if (keys.length === 0) return 0;
        
        if (keys.length === 1) {
            const result = await this.turso.execute({
                sql: `SELECT 1 FROM cache 
                      WHERE key = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
                args: [keys[0]]
            });
            return result.rows.length > 0;
        }
        
        const placeholders = keys.map(() => '?').join(',');
        const result = await this.turso.execute({
            sql: `SELECT COUNT(*) as count FROM cache 
                  WHERE key IN (${placeholders}) 
                  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
            args: keys
        });
        return result.rows[0].count;
    }

    public async del(...keys: string[]): Promise<number> {
        await this._initPromise;
        this._ensureReady();
        
        if (keys.length === 0) return 0;
        
        const placeholders = keys.map(() => '?').join(',');
        const result = await this.turso.execute({
            sql: `DELETE FROM cache WHERE key IN (${placeholders})`,
            args: keys
        });
        return result.rowsAffected;
    }

    public async ttl(key: string): Promise<number> {
        await this._initPromise;
        this._ensureReady();
        
        const result = await this.turso.execute({
            sql: `SELECT expires_at FROM cache WHERE key = ?`,
            args: [key]
        });
        
        if (result.rows.length === 0) return -2;
        
        const expiresAt = result.rows[0].expires_at;
        if (!expiresAt) return -1;
        
        const now = new Date();
        const expiry = new Date(expiresAt);
        const ttlSeconds = Math.floor((expiry.getTime() - now.getTime()) / 1000);
        return ttlSeconds > 0 ? ttlSeconds : -2;
    }

    public async pttl(key: string): Promise<number> {
        await this._initPromise;
        this._ensureReady();
        
        const result = await this.turso.execute({
            sql: `SELECT expires_at FROM cache WHERE key = ?`,
            args: [key]
        });
        
        if (result.rows.length === 0) return -2;
        
        const expiresAt = result.rows[0].expires_at;
        if (!expiresAt) return -1;
        
        const now = new Date();
        const expiry = new Date(expiresAt);
        const ttlMilliseconds = expiry.getTime() - now.getTime();
        return ttlMilliseconds > 0 ? ttlMilliseconds : -2;
    }

    public async expire(key: string, seconds: number): Promise<number> {
        await this._initPromise;
        this._ensureReady();
        
        const result = await this.turso.execute({
            sql: `UPDATE cache SET expires_at = datetime('now', '+${seconds} seconds') 
                  WHERE key = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
            args: [key]
        });
        return result.rowsAffected > 0 ? 1 : 0;
    }

    public async expireat(key: string, timestamp: number): Promise<number> {
        await this._initPromise;
        this._ensureReady();
        
        const date = new Date(timestamp * 1000).toISOString();
        const result = await this.turso.execute({
            sql: `UPDATE cache SET expires_at = ? 
                  WHERE key = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
            args: [date, key]
        });
        return result.rowsAffected > 0 ? 1 : 0;
    }

    public async pexpire(key: string, milliseconds: number): Promise<number> {
        await this._initPromise;
        this._ensureReady();
        
        const seconds = Math.floor(milliseconds / 1000);
        return this.expire(key, seconds);
    }

    public async pexpireat(key: string, timestamp: number): Promise<number> {
        await this._initPromise;
        this._ensureReady();
        
        const seconds = Math.floor(timestamp / 1000);
        return this.expireat(key, seconds);
    }

    public async persist(key: string): Promise<number> {
        await this._initPromise;
        this._ensureReady();
        
        const result = await this.turso.execute({
            sql: `UPDATE cache SET expires_at = NULL 
                  WHERE key = ? AND expires_at IS NOT NULL`,
            args: [key]
        });
        return result.rowsAffected > 0 ? 1 : 0;
    }

    public async incr(key: string): Promise<number> {
        await this._initPromise;
        this._ensureReady();
        
        const result = await this.turso.execute({
            sql: `UPDATE cache SET value = CAST(value AS INTEGER) + 1 
                  WHERE key = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
            args: [key]
        });
        
        if (result.rowsAffected === 0) {
            await this.set(key, '1');
            return 1;
        }
        
        const val = await this.get(key);
        return parseInt(val, 10);
    }

    public async incrby(key: string, increment: number): Promise<number> {
        await this._initPromise;
        this._ensureReady();
        
        const result = await this.turso.execute({
            sql: `UPDATE cache SET value = CAST(value AS INTEGER) + ? 
                  WHERE key = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
            args: [increment, key]
        });
        
        if (result.rowsAffected === 0) {
            await this.set(key, String(increment));
            return increment;
        }
        
        const val = await this.get(key);
        return parseInt(val, 10);
    }

    public async decr(key: string): Promise<number> {
        return this.incrby(key, -1);
    }

    public async decrby(key: string, decrement: number): Promise<number> {
        return this.incrby(key, -decrement);
    }

    public async keys(pattern: string = '*'): Promise<string[]> {
        await this._initPromise;
        this._ensureReady();
        
        const sqlPattern = pattern.replace(/\*/g, '%');
        const result = await this.turso.execute({
            sql: `SELECT key FROM cache 
                  WHERE key LIKE ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
            args: [sqlPattern]
        });
        return result.rows.map((row: any) => row.key);
    }

    public async scan(cursor: number = 0, pattern: string = '*', count: number = 10): Promise<ScanResult> {
        await this._initPromise;
        this._ensureReady();
        
        const sqlPattern = pattern.replace(/\*/g, '%');
        const result = await this.turso.execute({
            sql: `SELECT key FROM cache 
                  WHERE key LIKE ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                  LIMIT ? OFFSET ?`,
            args: [sqlPattern, count, cursor]
        });
        
        const keys = result.rows.map((row: any) => row.key);
        const nextCursor = keys.length === count ? cursor + count : 0;
        
        return { cursor: nextCursor, keys };
    }

    public async randomkey(): Promise<string | null> {
        await this._initPromise;
        this._ensureReady();
        
        const result = await this.turso.execute({
            sql: `SELECT key FROM cache 
                  WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP
                  ORDER BY RANDOM() LIMIT 1`
        });
        
        return result.rows.length > 0 ? result.rows[0].key : null;
    }

    public async rename(oldKey: string, newKey: string): Promise<string> {
        await this._initPromise;
        this._ensureReady();
        
        if (oldKey === newKey) return "OK";
        
        const exists = await this.exists(newKey);
        if (exists) {
            throw new Error('ERR target key already exists');
        }
        
        await this.turso.execute({
            sql: `UPDATE cache SET key = ? WHERE key = ?`,
            args: [newKey, oldKey]
        });
        
        return "OK";
    }

    public async renamenx(oldKey: string, newKey: string): Promise<number> {
        await this._initPromise;
        this._ensureReady();
        
        if (oldKey === newKey) return 0;
        
        const exists = await this.exists(newKey);
        if (exists) return 0;
        
        await this.turso.execute({
            sql: `UPDATE cache SET key = ? WHERE key = ?`,
            args: [newKey, oldKey]
        });
        
        return 1;
    }

    public async type(key: string): Promise<string> {
        await this._initPromise;
        this._ensureReady();
        
        const result = await this.turso.execute({
            sql: `SELECT type FROM cache WHERE key = ?`,
            args: [key]
        });
        
        if (result.rows.length === 0) return 'none';
        return result.rows[0].type;
    }

    public async flushAll(): Promise<string> {
        await this._initPromise;
        this._ensureReady();
        
        await this.turso.execute('DELETE FROM cache');
        return "OK";
    }

    public async flushDb(): Promise<string> {
        return this.flushAll();
    }

    public async dbsize(): Promise<number> {
        await this._initPromise;
        this._ensureReady();
        
        const result = await this.turso.execute({
            sql: `SELECT COUNT(*) as count FROM cache 
                  WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP`
        });
        return result.rows[0].count;
    }

    public async cleanupExpired(): Promise<number> {
        await this._initPromise;
        this._ensureReady();
        
        const result = await this.turso.execute(
            'DELETE FROM cache WHERE expires_at <= CURRENT_TIMESTAMP'
        );
        return result.rowsAffected;
    }

    public async pipeline(commands: Array<[string, ...any[]]>): Promise<any[]> {
        await this._initPromise;
        this._ensureReady();
        
        const results: any[] = [];
        const transaction = await this.turso.transaction();
        
        try {
            for (const [cmd, ...args] of commands) {
                switch (cmd.toLowerCase()) {
                    case 'get':
                        results.push(await this.get(args[0]));
                        break;
                    case 'set':
                        results.push(await this.set(args[0], args[1], args[2] ? { ttl: args[2] } : {}));
                        break;
                    case 'del':
                        results.push(await this.del(...args));
                        break;
                    case 'exists':
                        results.push(await this.exists(...args));
                        break;
                    case 'incr':
                        results.push(await this.incr(args[0]));
                        break;
                    case 'decr':
                        results.push(await this.decr(args[0]));
                        break;
                    case 'expire':
                        results.push(await this.expire(args[0], args[1]));
                        break;
                    case 'ttl':
                        results.push(await this.ttl(args[0]));
                        break;
                    case 'persist':
                        results.push(await this.persist(args[0]));
                        break;
                    default:
                        throw new Error(`Unknown command: ${cmd}`);
                }
            }
            await transaction.commit();
            return results;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    public async transaction(commands: Array<[string, ...any[]]>): Promise<any[]> {
        return this.pipeline(commands);
    }

    public async healthCheck(): Promise<boolean> {
        try {
            await this.turso.execute('SELECT 1');
            return true;
        } catch {
            return false;
        }
    }

    public override on(event: 'ready', listener: () => void): this;
    public override on(event: 'error', listener: (error: Error) => void): this;
    public override on(event: 'cleanup', listener: (count: number) => void): this;
    public override on(event: string | symbol, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    public destroy() {
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
            this._cleanupInterval = null;
        }
        this.removeAllListeners();
        this._isReady = false;
    }
}

export default tursoClient;