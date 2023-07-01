import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  Configuration,
  CreateCompletionRequest,
  OpenAIApi,
} from "https://esm.sh/openai@3.3.0";

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
    const GPT_MODEL = "gpt-3.5-turbo-0613";
    const MAX_TOKEN_RESPONSE_ANSWER = 2048;


    const { messages } = await req.json();
    const configuration = new Configuration({ apiKey: openAiKey });
    const openai = new OpenAIApi(configuration);

    /*
      1. Combine messages and add functions to the request
      2. Call Openai and get Question from it.
      3. Call Pinecone index to get relevant context.
      4. Add the context and question and send it to openai only the prompt
      5. Return the answer
    */

    const completionOptions = {
      model: GPT_MODEL,
      messages,
      functions: [
        {
          name: "get_calculation_result",
          description: "Evaluates a provided mathematical expression and returns the calculated result. This function is capable of handling simple to complex arithmetic operations comprising of actual number values and operators",
          parameters: {
            type: "object",
            properties: {
              calculation: {
                type: "string",
                description: "The mathematical equation to be calculated. This should include the actual number values and the operators (for example, '2+2' or '9*3'). The format should be appropriate for a mathematical calculation.",
              },
            },
            required: ["calculation"],
          },
        },
      ],
      max_tokens: MAX_TOKEN_RESPONSE_ANSWER,
      temperature: 0,
      function_call: 'auto'
    }

    const functionParamResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST", 
      body: JSON.stringify(completionOptions),
    });

    var embedding_input_json = await functionParamResponse.json();
    

    return new Response(JSON.stringify(embedding_input_json), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
