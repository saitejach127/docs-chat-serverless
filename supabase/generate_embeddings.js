const { createClient } = require("@supabase/supabase-js");
const { Configuration, OpenAIApi } = require("openai");
const { TextLoader } = require("langchain/document_loaders/fs/text");

async function getDocuments() {
  const loader = new TextLoader(
    "./processed_documents/splittedtext.txt"
  );

  const docs = await loader.load();
  console.log(docs[0].pageContent.split("$$$").length)
  return docs[0].pageContent.split("$$$");
}

async function generateEmbeddings() {
  const configuration = new Configuration({ apiKey: "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" });
  const openai = new OpenAIApi(configuration);

  const documents = await getDocuments(); // Your custom function to load docs
  const supabase = createClient('https://fbhwttacuyzgmbgdbusv.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiaHd0dGFjdXl6Z21iZ2RidXN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODI3OTIwODgsImV4cCI6MTk5ODM2ODA4OH0.epV9pTEvyppD_DeINU3G0bgx6ZlFdFCYRcV-P7eixmM')
  // Assuming each document is a string
  console.log("document started embeddings")
  const document_name = "servicenow_csm";
  
  for (let i=0;i<documents.length;i++) {
    console.log("document , doing...")
    // OpenAI recommends replacing newlines with spaces for best results
    const input = document.replace(/\n/g, " ");

    const embeddingResponse = await openai.createEmbedding({
      model: "text-embedding-ada-002",
      input,
    });

    const [{ embedding }] = embeddingResponse.data.data;
    console.log("embeddings arrived from openi");
    // In production we should handle possible errors
    await supabase.from("document_vectors").insert({
      content: document,
      embedding,
      document_name
    });
    console.log("inserted to supabase");
  }
}

generateEmbeddings();