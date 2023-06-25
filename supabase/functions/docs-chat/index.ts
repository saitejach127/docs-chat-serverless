import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'
import 'https://deno.land/x/xhr@0.2.1/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.5.0'
import GPT3Tokenizer from 'https://esm.sh/gpt3-tokenizer@1.1.5'
import { Configuration, CreateCompletionRequest, OpenAIApi } from 'https://esm.sh/openai@3.1.0'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const EMBEDDING_MODEL = "text-embedding-ada-002"
  const GPT_MODEL = "gpt-3.5-turbo"
  const CONTEXT_MAX_TOKEN_LIMIT = 2500
  const MAX_TOKEN_RESPONSE_ANSWER = 1024
  // Search query is passed in request payload
  const { query, document_name, previous_qas } = await req.json()

  // OpenAI recommends replacing newlines with spaces for best results
  const input = query.replace(/\n/g, ' ')

  const openAiKey = Deno.env.get("OPENAI_API_KEY")

  const configuration = new Configuration({ apiKey: openAiKey })
  const openai = new OpenAIApi(configuration)

  var embedding_input = input;

  if(previous_qas && previous_qas.length > 0){
      var previousQuestions = "";
    
    previous_qas && previous_qas.forEach((questionAnswer, i) => {
      previousQuestions += `Question ${i+1}: ${questionAnswer.question}\n`;
    });

    var numberMoreString = "";
    for(let i=0;i<previous_qas.length;i++){
      if(previous_qas.length === 1){
        numberMoreString = "1";
        break;
      }
      if(i==previous_qas.length - 1){
        numberMoreString += `and ${i+1}`;
        break;
      }
      numberMoreString += `${i+1}, `;
    }

    console.log("number string", numberMoreString);

    const questionFetchingPrompt = `
    Below, there are ${previous_qas.length || 0} questions asked one after another, I want you to write the question for question ${(previous_qas.length || 0) + 1} itself such that it can stand alone without explicitly stating questions ${numberMoreString}. Only give me the question as output
    ${previousQuestions}
    Question ${(previous_qas.length || 0) + 1}: ${input}
    `

    console.log("question getting prompt \n", questionFetchingPrompt);

    const questionCompletionOptions = {
      model: GPT_MODEL,
      messages: [{"role": "user", "content": questionFetchingPrompt}],
      max_tokens: MAX_TOKEN_RESPONSE_ANSWER,
      temperature: 0
    }

    const questionCompletionResponseJson = await fetch('https://api.openai.com/v1/chat/completions', {
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify(questionCompletionOptions),
    })

    const questionCompletionResponse = await questionCompletionResponseJson.json();
    embedding_input = questionCompletionResponse['choices'][0]['message']['content'];

    console.log("embedding question input is : \n", embedding_input);

  }
  // Generate a one-time embedding for the query itself
  const embeddingResponse = await openai.createEmbedding({
    model: EMBEDDING_MODEL,
    input: embedding_input,
  })

  const [{ embedding }] = embeddingResponse.data.data

  // Fetching whole documents for this simple example.
  //
  // Ideally for context injection, documents are chunked into
  // smaller sections at earlier pre-processing/embedding step.
  const supabase = createClient(Deno.env.get("SUPABASE_URL"),Deno.env.get("SUPABASE_ANON_KEY"))
  
  const { data: documents } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: 0.78, // Choose an appropriate threshold for your data
    match_count: 20, // Choose the number of matches
    name_document: document_name
  })
  const tokenizer = new GPT3Tokenizer({ type: 'gpt3' })
  let tokenCount = 0
  let contextText = ''

  // Concat matched documents
  for (let i = 0; i < documents.length; i++) {
    const document = documents[i]
    const content = document.content
    const encoded = tokenizer.encode(content)
    tokenCount += encoded.text.length

    // Limit context to max 1500 tokens (configurable)
    if (tokenCount > CONTEXT_MAX_TOKEN_LIMIT) {
      break
    }

    contextText += `${content.trim()}\n---\n`
  }

  const prompt = `
  Use the below ServiceNow Customer Service Management Documentation to answer the subsequent question. If the answer cannot be found in the article, write "I could not find an answer."
  
  Context sections:
  """${contextText}"""

  Question: 
  '''${embedding_input}'''

  Answer:
  `
  var messages: any = [];

  // messages.push({
  //   "role": "system",
  //   "content": ``
  // })

  // previous_qas && previous_qas.forEach(previous_qa => {
  //   messages.push({
  //     "role": "user", "content": previous_qa.question
  //   });
  //   messages.push({
  //     "role": "assistant",
  //     "content": previous_qa.answer
  //   })
  // });
  messages.push({"role": "user", "content": prompt})

  const completionOptions = {
    model: GPT_MODEL,
    messages,
    max_tokens: MAX_TOKEN_RESPONSE_ANSWER,
    temperature: 0
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify(completionOptions),
  })

  return new Response(JSON.stringify({...await response.json(), embedding_input}), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
})