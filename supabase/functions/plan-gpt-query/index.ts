import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  Configuration,
  CreateCompletionRequest,
  OpenAIApi,
} from "https://esm.sh/openai@3.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const openAiKey = Deno.env.get("OPENAI_API_KEY");

  try {
    const GPT_MODEL = "gpt-3.5-turbo";
    const MAX_TOKEN_RESPONSE_ANSWER = 2048;
    const { messages } = await req.json();

    const completionOptions = {
      model: GPT_MODEL,
      messages,
      max_tokens: MAX_TOKEN_RESPONSE_ANSWER,
      temperature: 0
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(completionOptions),
    });

    return new Response(JSON.stringify(await response.json()), {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
