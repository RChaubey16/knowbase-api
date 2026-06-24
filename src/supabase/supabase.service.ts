import { Injectable } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    // Initialise once at startup with service-role credentials for server-side use
    this.client = createClient<any, "public">(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          // Disable token refresh and session persistence — this is a server-side client
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  /**
   * Return the initialised Supabase client for direct use (e.g. RPC calls, storage)
   *
   * @returns Configured SupabaseClient instance
   */
  getClient() {
    return this.client;
  }
}
