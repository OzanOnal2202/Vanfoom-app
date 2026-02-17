import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_WINDOW_SECONDS = 3600; // 1 hour
const MAX_ATTEMPTS = 5;

interface RateLimitRecord {
  id: string;
  key: string;
  attempts: number;
  window_start: string;
}

async function checkRateLimit(supabase: any, userId: string): Promise<{ allowed: boolean; remainingAttempts: number }> {
  const rateLimitKey = `admin_promo:${userId}`;
  const now = new Date();
  
  const { data: existing } = await supabase
    .from("rate_limit_attempts")
    .select("*")
    .eq("key", rateLimitKey)
    .maybeSingle();

  if (!existing) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 };
  }

  const windowStart = new Date(existing.window_start);
  const windowEnd = new Date(windowStart.getTime() + RATE_LIMIT_WINDOW_SECONDS * 1000);

  // Window expired, reset
  if (now > windowEnd) {
    await supabase
      .from("rate_limit_attempts")
      .delete()
      .eq("key", rateLimitKey);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 };
  }

  // Check if too many attempts
  if (existing.attempts >= MAX_ATTEMPTS) {
    return { allowed: false, remainingAttempts: 0 };
  }

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - existing.attempts - 1 };
}

async function incrementRateLimit(supabase: any, userId: string): Promise<void> {
  const rateLimitKey = `admin_promo:${userId}`;
  
  const { data: existing } = await supabase
    .from("rate_limit_attempts")
    .select("*")
    .eq("key", rateLimitKey)
    .maybeSingle();

  if (!existing) {
    await supabase.from("rate_limit_attempts").insert({
      key: rateLimitKey,
      attempts: 1,
      window_start: new Date().toISOString(),
    });
  } else {
    await supabase
      .from("rate_limit_attempts")
      .update({ 
        attempts: existing.attempts + 1,
        updated_at: new Date().toISOString()
      })
      .eq("key", rateLimitKey);
  }
}

async function clearRateLimit(supabase: any, userId: string): Promise<void> {
  const rateLimitKey = `admin_promo:${userId}`;
  await supabase.from("rate_limit_attempts").delete().eq("key", rateLimitKey);
}

async function logPromotionAttempt(
  supabase: any, 
  userId: string, 
  success: boolean, 
  req: Request
): Promise<void> {
  await supabase.from("admin_promotion_logs").insert({
    user_id: userId,
    target_user_id: userId,
    success,
    ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
    user_agent: req.headers.get("user-agent"),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Niet geautoriseerd" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the user's token
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Ongeldige sessie" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limit
    const { allowed, remainingAttempts } = await checkRateLimit(supabase, userData.user.id);
    if (!allowed) {
      await logPromotionAttempt(supabase, userData.user.id, false, req);
      return new Response(
        JSON.stringify({ error: "Te veel pogingen. Probeer over 1 uur opnieuw." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { password } = await req.json();

    // Get admin password from database first, fallback to environment variable
    const { data: passwordSetting, error: settingError } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "admin_promotion_password")
      .maybeSingle();

    let storedPassword: string | undefined;
    let isHashed = false;
    
    if (passwordSetting && !settingError) {
      storedPassword = passwordSetting.setting_value;
      // Check if password is hashed (bcrypt hashes start with $2)
      isHashed = storedPassword?.startsWith("$2") || false;
    } else {
      // Fallback to environment variable (not hashed)
      storedPassword = Deno.env.get("ADMIN_PROMOTION_PASSWORD");
    }

    if (!storedPassword) {
      return new Response(
        JSON.stringify({ error: "Admin wachtwoord niet geconfigureerd" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password
    let passwordValid = false;
    if (isHashed) {
      passwordValid = await bcrypt.compare(password, storedPassword);
    } else {
      // Constant-time comparison for unhashed passwords
      const encoder = new TextEncoder();
      const a = encoder.encode(password);
      const b = encoder.encode(storedPassword);
      if (a.length === b.length) {
        let result = 0;
        for (let i = 0; i < a.length; i++) {
          result |= a[i] ^ b[i];
        }
        passwordValid = result === 0;
      }
    }

    if (!passwordValid) {
      await incrementRateLimit(supabase, userData.user.id);
      await logPromotionAttempt(supabase, userData.user.id, false, req);
      return new Response(
        JSON.stringify({ 
          error: "Ongeldig wachtwoord",
          remainingAttempts 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clear rate limit on success
    await clearRateLimit(supabase, userData.user.id);

    // Check if user already has admin role
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (existingRole) {
      await logPromotionAttempt(supabase, userData.user.id, true, req);
      return new Response(
        JSON.stringify({ message: "Je bent al een admin" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update existing role to admin or insert new admin role
    const { error: updateError } = await supabase
      .from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", userData.user.id);

    if (updateError) {
      // If no row to update, insert new one
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: userData.user.id, role: "admin" });

      if (insertError) {
        const requestId = crypto.randomUUID();
        console.error(`[${requestId}] Error inserting admin role:`, insertError);
        await logPromotionAttempt(supabase, userData.user.id, false, req);
        return new Response(
          JSON.stringify({ error: "Kon admin rol niet toewijzen", requestId }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    await logPromotionAttempt(supabase, userData.user.id, true, req);
    return new Response(
      JSON.stringify({ message: "Je bent nu een admin!", success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error(`[${requestId}] Error in promote-to-admin:`, error);
    return new Response(
      JSON.stringify({ error: "Er is een fout opgetreden", requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
