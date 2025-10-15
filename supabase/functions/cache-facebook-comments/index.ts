import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://deno.land/x/sheetjs/xlsx.mjs";
// ============================================================================
// CORS HEADERS
// ============================================================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept",
  "Access-Control-Max-Age": "86400",
};
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function generateRandomId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getTPOSHeaders(bearerToken: string) {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9,vi;q=0.8",
    authorization: `Bearer ${bearerToken}`,
    priority: "u=1, i",
    "sec-ch-ua": '"Google Chrome";v="126", "Chromium";v="126", "Not?A_Brand";v="8"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    tposappversion: "5.9.10.1",
    Referer: "https://tomato.tpos.vn/",
    "x-request-id": generateRandomId(),
  };
}
function createErrorResponse(error, statusCode, details, postId) {
  const errorBody = {
    error,
    statusCode,
    ...(details && {
      details,
    }),
    ...(postId && {
      postId,
    }),
  };
  return new Response(JSON.stringify(errorBody), {
    status: statusCode,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
function createSuccessResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
// ============================================================================
// MAIN HANDLER
// ============================================================================
serve(async (req) => {
  console.log(`[Cache Comments] ${req.method} request received`);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[Cache Comments] OPTIONS request - returning CORS headers");
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }
  // Only allow POST
  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }
  try {
    // ========================================================================
    // STEP 1: PARSE AND VALIDATE REQUEST
    // ========================================================================
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return createErrorResponse("Invalid JSON body", 400, e instanceof Error ? e.message : String(e));
    }
    const { postId } = body;
    if (!postId || typeof postId !== "string") {
      return createErrorResponse("postId is required and must be a string", 400);
    }
    console.log(`[Cache Comments] Processing postId: ${postId}`);
    // ========================================================================
    // STEP 2: GET BEARER TOKEN FROM ENV
    // ========================================================================
    const bearerToken = Deno.env.get("FACEBOOK_BEARER_TOKEN");
    if (!bearerToken) {
      console.error("[Cache Comments] ❌ FACEBOOK_BEARER_TOKEN not found in environment!");
      return createErrorResponse(
        "Server configuration error",
        500,
        "FACEBOOK_BEARER_TOKEN is not configured. Please add it to Edge Function environment variables.",
      );
    }
    console.log("[Cache Comments] ✅ Bearer token found:", bearerToken.substring(0, 20) + "...");
    // ========================================================================
    // STEP 3: VALIDATE SUPABASE ENV
    // ========================================================================
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      return createErrorResponse(
        "Server configuration error",
        500,
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    const supabase = createClient(supabaseUrl, supabaseKey);
    // ========================================================================
    // STEP 4: FETCH EXCEL FROM TPOS WITH PROPER HEADERS (POST METHOD)
    // ========================================================================
    const exportUrl = `https://tomato.tpos.vn/facebook/exportcommentstoexcelv2?postid=${postId}`;
    console.log(`[Cache Comments] Fetching from TPOS (POST): ${exportUrl}`);
    let tposResponse;
    try {
      tposResponse = await fetch(exportUrl, {
        method: "POST",
        headers: {
          ...getTPOSHeaders(bearerToken),
          // Override accept for Excel file download
          "accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json",
          "content-type": "application/json;charset=UTF-8",
        },
        body: JSON.stringify({}),
      });
      console.log(`[Cache Comments] TPOS Response Status: ${tposResponse.status}`);
      console.log(`[Cache Comments] TPOS Response Headers:`, Object.fromEntries(tposResponse.headers));
    } catch (e) {
      console.error("[Cache Comments] TPOS fetch failed:", e);
      return createErrorResponse("Failed to connect to TPOS", 502, e instanceof Error ? e.message : String(e), postId);
    }
    // ========================================================================
    // STEP 5: HANDLE TPOS RESPONSE STATUS
    // ========================================================================
    if (!tposResponse.ok) {
      const responseText = await tposResponse.text();
      console.error(`[Cache Comments] TPOS Error Response:`, {
        status: tposResponse.status,
        statusText: tposResponse.statusText,
        body: responseText.substring(0, 500),
      });
      // Check if it's a 404 Not Found
      if (tposResponse.status === 404) {
        return createErrorResponse(
          "Post not found in TPOS",
          404,
          "Video may have been deleted or Post ID is incorrect. Response: " + responseText.substring(0, 200),
          postId,
        );
      }
      // Check if it's 401 Unauthorized
      if (tposResponse.status === 401) {
        return createErrorResponse(
          "Bearer Token expired or invalid",
          401,
          "Please update FACEBOOK_BEARER_TOKEN in Supabase Environment Variables",
          postId,
        );
      }
      return createErrorResponse(
        `TPOS API error: ${tposResponse.status}`,
        tposResponse.status,
        responseText.substring(0, 200),
        postId,
      );
    }
    // ========================================================================
    // STEP 6: READ AND VALIDATE EXCEL FILE
    // ========================================================================
    let arrayBuffer;
    try {
      arrayBuffer = await tposResponse.arrayBuffer();
      console.log(`[Cache Comments] ✅ Received ${arrayBuffer.byteLength} bytes`);
    } catch (e) {
      return createErrorResponse(
        "Failed to read Excel file from TPOS",
        500,
        e instanceof Error ? e.message : String(e),
        postId,
      );
    }
    if (arrayBuffer.byteLength === 0) {
      console.log("[Cache Comments] Empty file - no comments");
      return createSuccessResponse({
        success: true,
        postId,
        totalCached: 0,
        message: "No comments found (empty file from TPOS)",
      });
    }
    // ========================================================================
    // STEP 7: PARSE EXCEL
    // ========================================================================
    let jsonData;
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
      console.log(`[Cache Comments] ✅ Parsed ${jsonData.length} comments from Excel`);
    } catch (e) {
      return createErrorResponse("Failed to parse Excel file", 500, e instanceof Error ? e.message : String(e), postId);
    }
    if (jsonData.length === 0) {
      return createSuccessResponse({
        success: true,
        postId,
        totalCached: 0,
        message: "No comments found in Excel file",
      });
    }
    // ========================================================================
    // STEP 8: TRANSFORM DATA (Handle both English and Vietnamese columns)
    // ========================================================================
    // Helper function: Safe date parsing
    function parseDate(dateValue) {
      try {
        if (!dateValue) {
          return new Date().toISOString();
        }
        // If already a Date object
        if (dateValue instanceof Date) {
          if (isNaN(dateValue.getTime())) {
            console.warn("[Cache Comments] Invalid date object, using now");
            return new Date().toISOString();
          }
          return dateValue.toISOString();
        }
        // Try to parse string
        const parsed = new Date(dateValue);
        if (isNaN(parsed.getTime())) {
          console.warn("[Cache Comments] Invalid date string:", dateValue);
          return new Date().toISOString();
        }
        return parsed.toISOString();
      } catch (e) {
        console.warn("[Cache Comments] Date parsing error:", e, dateValue);
        return new Date().toISOString();
      }
    }
    // Helper function: Get value from row (try both English and Vietnamese keys)
    function getRowValue(row, englishKey, vietnameseKey, defaultValue = "") {
      return row[englishKey] ?? (vietnameseKey ? row[vietnameseKey] : undefined) ?? defaultValue;
    }
    const commentsToInsert = jsonData
      .map((row, index) => {
        try {
          // Extract values with fallbacks for Vietnamese column names
          const commentId = getRowValue(row, "CommentId", undefined, `generated_${postId}_${index}_${Date.now()}`);
          const userId = getRowValue(row, "UserId", "ASUId", "");
          const userName = getRowValue(row, "UserName", "Tên", "Unknown");
          const comment = getRowValue(row, "Comment", "Nội dung", "");
          const commentTime = getRowValue(row, "CommentTime", "Thời gian", new Date());
          const likeCount = getRowValue(row, "LikeCount", undefined, 0);
          const sessionIndex = getRowValue(row, "SessionIndex", undefined, index + 1);
          return {
            facebook_comment_id: String(commentId),
            facebook_post_id: postId,
            facebook_user_id: String(userId),
            facebook_user_name: String(userName),
            comment_message: String(comment),
            comment_created_time: parseDate(commentTime),
            like_count: Number(likeCount) || 0,
            comment_order: Number(sessionIndex) || index + 1,
            is_deleted: false,
          };
        } catch (e) {
          console.error("[Cache Comments] Error transforming row:", e, row);
          return null;
        }
      })
      .filter((item) => item !== null);
    console.log(`[Cache Comments] ✅ Transformed ${commentsToInsert.length} valid comments`);
    // Log sample for debugging
    if (commentsToInsert.length > 0) {
      console.log("[Cache Comments] Sample comment:", JSON.stringify(commentsToInsert[0], null, 2));
    }
    // ========================================================================
    // STEP 9: BATCH INSERT TO SUPABASE
    // ========================================================================
    const batchSize = 500;
    let totalInserted = 0;
    const errors = [];
    for (let i = 0; i < commentsToInsert.length; i += batchSize) {
      const batch = commentsToInsert.slice(i, i + batchSize);
      try {
        const { error } = await supabase.from("facebook_comments_archive").upsert(batch, {
          onConflict: "facebook_comment_id",
          ignoreDuplicates: false,
        });
        if (error) {
          console.error(`[Cache Comments] Batch ${i}-${i + batch.length} error:`, error);
          errors.push({
            batch: `${i}-${i + batch.length}`,
            error: error.message,
          });
        } else {
          totalInserted += batch.length;
          console.log(`[Cache Comments] Progress: ${totalInserted}/${commentsToInsert.length}`);
        }
      } catch (e) {
        console.error(`[Cache Comments] Batch ${i} exception:`, e);
        errors.push({
          batch: `${i}-${i + batch.length}`,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    // ========================================================================
    // STEP 10: RETURN SUCCESS RESPONSE
    // ========================================================================
    const response = {
      success: true,
      postId,
      totalCached: totalInserted,
      totalProcessed: commentsToInsert.length,
      message: `Successfully cached ${totalInserted} of ${commentsToInsert.length} comments`,
      ...(errors.length > 0 && {
        errors,
      }),
    };
    console.log("[Cache Comments] ✅ SUCCESS:", response.message);
    return createSuccessResponse(response);
  } catch (error) {
    // ========================================================================
    // CATCH-ALL ERROR HANDLER
    // ========================================================================
    console.error("[Cache Comments] ❌ Unexpected error:", error);
    return createErrorResponse("Internal server error", 500, error instanceof Error ? error.message : String(error));
  }
});
console.log("[Cache Comments] ✅ Function ready and listening");
