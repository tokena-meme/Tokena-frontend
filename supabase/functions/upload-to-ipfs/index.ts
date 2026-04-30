import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const pinataJwt = Deno.env.get("PINATA_JWT");
    if (!pinataJwt) {
      throw new Error("PINATA_JWT not set in environment");
    }

    const contentType = req.headers.get("content-type") || "";
    let url = "";

    if (contentType.includes("multipart/form-data")) {
      url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
    } else if (contentType.includes("application/json")) {
      url = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
    } else {
      throw new Error("Unsupported content type");
    }

    // Forward the request to Pinata
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
        // Note: For multipart/form-data, don't set the content-type header manually,
        // let fetch handle the boundary. But for raw body we might need to be careful.
        ...(contentType.includes("application/json") ? { "Content-Type": "application/json" } : {}),
      },
      body: await req.blob(), // Pass the raw body through
    });

    const result = await response.json();
    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
