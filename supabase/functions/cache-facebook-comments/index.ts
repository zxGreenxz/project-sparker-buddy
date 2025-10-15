import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://deno.land/x/sheetjs/xlsx.mjs";

// ============================================================================
// CORS - ULTIMATE FIX
// ============================================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-requested-with, accept",
  "Access-Control-Max-Age": "86400",
};

// ============================================================================
// TYPES
// ============================================================================
interface ExcelComment {
  SessionIndex: number;
  UserName: string;
  UserId: string;
  CommentId: string;
  Comment: string;
  CommentTime: string;
  LikeCount: number;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req) => {
  console.log(`[Cache Comments] ${req.method} request received`);

  // ============================================================================
  // HANDLE CORS PREFLIGHT - MUST RETURN 200!
  // ============================================================================
  if (req.method === "OPTIONS") {
    console.log("[Cache Comments] OPTIONS request - returning CORS headers");
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // ============================================================================
  // ONLY ALLOW POST
  // ============================================================================
  if (req.method !== "POST") {
    console.log(`[Cache Comments] Method ${req.method} not allowed`);
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ============================================================================
  // MAIN LOGIC WITH TRY-CATCH
  // ============================================================================
  try {
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("[Cache Comments] Failed to parse JSON:", e);
      return new Response(
        JSON.stringify({
          error: "Invalid JSON body",
          details: e.toString(),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { postId } = body;

    // Validate postId
    if (!postId || typeof postId !== "string") {
      console.error("[Cache Comments] Missing or invalid postId");
      return new Response(
        JSON.stringify({
          error: "postId is required and must be a string",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`[Cache Comments] Processing postId: ${postId}`);

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("[Cache Comments] Missing environment variables");
      return new Response(
        JSON.stringify({
          error: "Server configuration error",
          details: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ========================================================================
    // 1. FETCH EXCEL FROM TPOS
    // ========================================================================
    const exportUrl = `https://tomato.tpos.vn/facebook/exportcommentstoexcelv2?postid=${postId}`;
    console.log(`[Cache Comments] Fetching from TPOS: ${exportUrl}`);

    let tposResponse: Response;
    try {
      tposResponse = await fetch(exportUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
    } catch (e) {
      console.error("[Cache Comments] TPOS fetch failed:", e);
      return new Response(
        JSON.stringify({
          error: "Failed to connect to TPOS",
          details: e.toString(),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!tposResponse.ok) {
      console.error(`[Cache Comments] TPOS returned ${tposResponse.status}`);
      return new Response(
        JSON.stringify({
          error: `TPOS API error: ${tposResponse.statusText}`,
          status: tposResponse.status,
        }),
        {
          status: tposResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ========================================================================
    // 2. READ AND PARSE EXCEL
    // ========================================================================
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await tposResponse.arrayBuffer();
      console.log(`[Cache Comments] Received ${arrayBuffer.byteLength} bytes`);
    } catch (e) {
      console.error("[Cache Comments] Failed to read response:", e);
      return new Response(
        JSON.stringify({
          error: "Failed to read Excel file",
          details: e.toString(),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (arrayBuffer.byteLength === 0) {
      console.log("[Cache Comments] Empty file received");
      return new Response(
        JSON.stringify({
          success: true,
          postId,
          totalCached: 0,
          message: "No comments found (empty file)",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let jsonData: ExcelComment[];
    try {
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
        type: "array",
        cellDates: true,
      });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("Excel file has no sheets");
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log(`[Cache Comments] Parsed ${jsonData.length} comments`);
    } catch (e) {
      console.error("[Cache Comments] Excel parse error:", e);
      return new Response(
        JSON.stringify({
          error: "Failed to parse Excel file",
          details: e.toString(),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (jsonData.length === 0) {
      console.log("[Cache Comments] No comments in Excel");
      return new Response(
        JSON.stringify({
          success: true,
          postId,
          totalCached: 0,
          message: "No comments found in Excel",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ========================================================================
    // 3. TRANSFORM DATA
    // ========================================================================
    const commentsToInsert = jsonData
      .map((row) => {
        try {
          return {
            facebook_comment_id: String(row.CommentId || ""),
            facebook_post_id: postId,
            facebook_user_id: String(row.UserId || ""),
            facebook_user_name: String(row.UserName || "Unknown"),
            comment_message: String(row.Comment || ""),
            comment_created_time: new Date(row.CommentTime).toISOString(),
            like_count: Number(row.LikeCount) || 0,
            comment_order: Number(row.SessionIndex) || 0,
          };
        } catch (e) {
          console.error("[Cache Comments] Error transforming row:", e, row);
          return null;
        }
      })
      .filter((item) => item !== null);

    console.log(
      `[Cache Comments] Transformed ${commentsToInsert.length} valid comments`,
    );

    // ========================================================================
    // 4. BATCH INSERT TO SUPABASE
    // ========================================================================
    const batchSize = 500;
    let totalInserted = 0;
    const errors: any[] = [];

    for (let i = 0; i < commentsToInsert.length; i += batchSize) {
      const batch = commentsToInsert.slice(i, i + batchSize);

      try {
        const { error } = await supabase
          .from("facebook_comments_archive")
          .upsert(batch, {
            onConflict: "facebook_comment_id",
            ignoreDuplicates: false,
          });

        if (error) {
          console.error(
            `[Cache Comments] Batch ${i}-${i + batch.length} error:`,
            error,
          );
          errors.push({
            batch: `${i}-${i + batch.length}`,
            error: error.message,
          });
        } else {
          totalInserted += batch.length;
          console.log(
            `[Cache Comments] Progress: ${totalInserted}/${commentsToInsert.length}`,
          );
        }
      } catch (e) {
        console.error(`[Cache Comments] Batch ${i} exception:`, e);
        errors.push({
          batch: `${i}-${i + batch.length}`,
          error: e.toString(),
        });
      }
    }

    // ========================================================================
    // 5. RETURN SUCCESS RESPONSE
    // ========================================================================
    const response = {
      success: true,
      postId,
      totalCached: totalInserted,
      totalProcessed: commentsToInsert.length,
      message: `Successfully cached ${totalInserted} of ${commentsToInsert.length} comments`,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("[Cache Comments] Success:", response.message);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // ========================================================================
    // CATCH-ALL ERROR HANDLER
    // ========================================================================
    console.error("[Cache Comments] Unexpected error:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

console.log("[Cache Comments] ✅ Function ready and listening");