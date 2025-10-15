import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Product {
  id: string;
  product_code: string;
  tpos_image_url: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting TPOS image migration...");

    // Get all products with TPOS image URLs
    const { data: products, error: fetchError } = await supabase
      .from("products")
      .select("id, product_code, tpos_image_url")
      .not("tpos_image_url", "is", null)
      .is("product_images", null); // Only migrate products without existing images

    if (fetchError) {
      throw new Error(`Failed to fetch products: ${fetchError.message}`);
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No products to migrate",
          migrated: 0,
          failed: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${products.length} products to migrate`);

    let migrated = 0;
    let failed = 0;
    const errors: Array<{ product_code: string; error: string }> = [];

    // Process products in batches
    for (const product of products) {
      try {
        console.log(`Migrating ${product.product_code}...`);

        // Download image from TPOS
        const imageResponse = await fetch(product.tpos_image_url!);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download: ${imageResponse.statusText}`);
        }

        const imageBlob = await imageResponse.blob();
        const arrayBuffer = await imageBlob.arrayBuffer();
        const imageData = new Uint8Array(arrayBuffer);

        // Determine file extension from content type or URL
        const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
        let extension = "jpg";
        if (contentType.includes("png")) extension = "png";
        else if (contentType.includes("webp")) extension = "webp";
        else if (contentType.includes("gif")) extension = "gif";

        // Upload to Supabase storage
        const fileName = `${product.product_code}-${Date.now()}.${extension}`;
        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, imageData, {
            contentType,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        // Update product with new image URL
        const { error: updateError } = await supabase
          .from("products")
          .update({
            product_images: [publicUrl],
          })
          .eq("id", product.id);

        if (updateError) {
          throw new Error(`Update failed: ${updateError.message}`);
        }

        migrated++;
        console.log(`✓ Migrated ${product.product_code}`);
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`✗ Failed ${product.product_code}: ${errorMessage}`);
        errors.push({
          product_code: product.product_code,
          error: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migration complete: ${migrated} succeeded, ${failed} failed`,
        migrated,
        failed,
        total: products.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Return first 10 errors
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Migration error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
