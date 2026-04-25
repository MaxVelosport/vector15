import { Store } from "express-session";
import { supabase } from "./supabase";

const TABLE = "Tvoy_vector_2_sessions";

export class SupabaseSessionStore extends Store {
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    this.cleanupInterval = setInterval(() => this._cleanup(), 6 * 60 * 60 * 1000);
    this.cleanupInterval.unref?.();
  }

  async get(sid: string, callback: (err: any, session?: any) => void) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("sess, expire")
        .eq("sid", sid)
        .single();
      if (error || !data) return callback(null, null);
      if (new Date(data.expire) < new Date()) {
        await this.destroy(sid, () => {});
        return callback(null, null);
      }
      callback(null, data.sess);
    } catch (e) {
      callback(e);
    }
  }

  async set(sid: string, session: any, callback?: (err?: any) => void) {
    try {
      const maxAge = session?.cookie?.maxAge ?? 365 * 24 * 60 * 60 * 1000;
      const expire = new Date(Date.now() + maxAge).toISOString();
      const { error } = await supabase
        .from(TABLE)
        .upsert({ sid, sess: session, expire }, { onConflict: "sid" });
      if (error) {
        console.error("Session store set error:", error.message);
        throw new Error(error.message);
      }
      callback?.();
    } catch (e) {
      callback?.(e);
    }
  }

  async destroy(sid: string, callback?: (err?: any) => void) {
    try {
      await supabase.from(TABLE).delete().eq("sid", sid);
      callback?.();
    } catch (e) {
      callback?.(e);
    }
  }

  async touch(sid: string, session: any, callback?: (err?: any) => void) {
    return this.set(sid, session, callback);
  }

  private async _cleanup() {
    try {
      await supabase.from(TABLE).delete().lt("expire", new Date().toISOString());
    } catch {}
  }
}
