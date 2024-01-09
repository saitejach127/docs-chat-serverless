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
    const EMBEDDING_MODEL = "text-embedding-ada-002"
    const MAX_TOKEN_RESPONSE_ANSWER = 2048;
    const PINECONE_TOP_RESULT_COUNT = 3;


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
          name: "get_some_context",
          description: "Get the context for the given question",
          parameters: {
            type: "object",
            properties: {
              question: {
                type: "string",
                description: "Question for getting the context",
              },
            },
            required: ["question"],
          },
        },
      ],
      max_tokens: MAX_TOKEN_RESPONSE_ANSWER,
      temperature: 0,
      function_call: {
        name: "get_some_context"
      },
    };

    const functionParamResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST", 
      body: JSON.stringify(completionOptions),
    });

    var embedding_input_json = await functionParamResponse.json();
    var embedding_input = JSON.parse(embedding_input_json.choices[0].message.function_call.arguments)["question"]
  console.log("crossed embeddings call openai with", embedding_input);
    const embeddingResponse = await openai.createEmbedding({
      model: EMBEDDING_MODEL,
      input: embedding_input,
    })
  
    const [{ embedding }] = embeddingResponse.data.data
console.log("got embedding from openai")
    const pineconeRequest = {
      "includeValues": "false",
      "includeMetadata": "true",
      "topK": PINECONE_TOP_RESULT_COUNT,
      "vector": embedding
    }
console.log("create pine req")
    const pineconeResponse = await fetch('https://summary-docs-index-d2784ca.svc.us-east-1-aws.pinecone.io/query', {
      headers: {
        'Api-key': `214b5e79-8256-4a22-b404-0afc60ee8313`,
        "Content-Type": "application/json",
      },
      method: "POST", 
      body: JSON.stringify(pineconeRequest),
    });
console.log("called pinecone")
    const pineconeResponseJson = await pineconeResponse.json();
    console.log("printing pine resp", pineconeResponseJson)
    const contextData = pineconeResponseJson.matches.map((a) => (a.metadata.text)).join("\n")
console.log("called pinecone done", contextData);
    const answerPrompt = `
    You are a ServiceNow Documentation Chatbot. Use the below Context and answer the question delimited by triple hyphens briefly and in a detailed manner.  

    Context:
    ${contextData}

    Question:
    ---${embedding_input}---
    `

    var answerGptRequest = {
      model: GPT_MODEL,
      max_tokens: MAX_TOKEN_RESPONSE_ANSWER,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: answerPrompt
        }
      ],
      stream: true
    }

    const answerGptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST", 
      body: JSON.stringify(answerGptRequest),
    });
console.log("done final call")
    return new Response(answerGptResponse.body, {
      headers: {
        ...corsHeaders,
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
