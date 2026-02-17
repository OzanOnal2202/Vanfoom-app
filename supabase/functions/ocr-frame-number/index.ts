import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting OCR for frame number detection...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an OCR assistant specialized in reading bike frame numbers from images.

Your task:
1. Look for a barcode in the image - there should be text below or near the barcode
2. The frame number typically starts with "ASY" followed by numbers (e.g., ASY4104587)
3. Frame numbers can also be other alphanumeric formats like "VBK..." or just numbers
4. Extract ONLY the frame number text, nothing else

Rules:
- Return ONLY the frame number, no other text
- If you find multiple potential frame numbers, return the most likely one (usually near a barcode)
- If you cannot find any frame number, return "NOT_FOUND"
- Remove any spaces or special characters from the frame number
- The result should be a clean alphanumeric string`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Read the frame number from this bike label image. Return only the frame number text, nothing else."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 100,
        temperature: 0.1, // Low temperature for more consistent OCR
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add credits" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const frameNumber = data.choices?.[0]?.message?.content?.trim() || "NOT_FOUND";
    
    console.log("OCR result:", frameNumber);

    // Clean up the result - remove any extra text or formatting
    const cleanedResult = frameNumber
      .replace(/[^a-zA-Z0-9]/g, '') // Remove non-alphanumeric
      .toUpperCase();

    return new Response(
      JSON.stringify({ 
        frameNumber: cleanedResult === "NOTFOUND" ? null : cleanedResult,
        raw: frameNumber
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("OCR error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
