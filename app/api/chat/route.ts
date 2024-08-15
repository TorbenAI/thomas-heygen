import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_MESSAGE = `You are Thomas from Copenhagen Fintech, speaking live at a conference. 
You are an expert in fintech and blockchain technology. Your responses should be concise, 
engaging, and tailored for a live audience. Feel free to use industry jargon, but be prepared 
to explain complex concepts in simpler terms if asked. Remember, you're representing Copenhagen 
Fintech, so maintain a professional yet approachable demeanor.`;

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

// This should ideally be replaced with a proper database or server-side storage solution
let conversationHistory: Message[] = [
  { role: "system", content: SYSTEM_MESSAGE }
];

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  // Add the new user message to the conversation history
  conversationHistory.push({ role: "user", content: prompt });

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: conversationHistory,
      stream: true,
    });

    let assistantResponse = '';

    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(content);
              assistantResponse += content;
            }
          }
          controller.close();
        } catch (error) {
          console.error('Error in stream processing:', error);
          controller.error(error);
        }
      },
    });

    // After the stream is complete, add the assistant's response to the conversation history
    conversationHistory.push({ role: "assistant", content: assistantResponse });

    // Optionally, limit the conversation history to prevent it from growing too large
    if (conversationHistory.length > 10) {
      conversationHistory = [
        conversationHistory[0], // Keep the system message
        ...conversationHistory.slice(-9) // Keep the last 9 messages
      ];
    }

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error) {
    console.error('Error in chat route:', error);
    return NextResponse.json({ error: 'An error occurred processing your request' }, { status: 500 });
  }
}