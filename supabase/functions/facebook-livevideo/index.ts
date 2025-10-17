import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Updated: 2025-01-15 - Use tpos_credentials table
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pageId = url.searchParams.get("pageId");
    const limit = url.searchParams.get("limit") || "10";
    const facebook_Type = url.searchParams.get("facebook_Type") || "page";

    if (!pageId) {
      return new Response(JSON.stringify({ error: "pageId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client for token lookup
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Fetch Facebook token from tpos_credentials
    const { data: tokenData, error: tokenError } = await supabase
      .from("tpos_credentials")
      .select("bearer_token")
      .eq("token_type", "facebook")
      .not("bearer_token", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError || !tokenData?.bearer_token) {
      console.error("❌ Facebook token not found:", tokenError);
      return new Response(JSON.stringify({ error: "Facebook Bearer Token not found" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bearerToken = tokenData.bearer_token;

    console.log(
      `Fetching Facebook live videos for pageId: ${pageId}, limit: ${limit}, facebook_Type: ${facebook_Type}`,
    );

    const response = await fetch(
      `https://tomato.tpos.vn/api/facebook-graph/livevideo?pageid=${pageId}&limit=${limit}&facebook_Type=${facebook_Type}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("TPOS API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `TPOS API error: ${response.status}`, details: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log(`Successfully fetched ${data?.length || 0} videos`);

    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in facebook-livevideo function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
