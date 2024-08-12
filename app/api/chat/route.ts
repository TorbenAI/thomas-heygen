import { NextRequest } from 'next/server';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API responded with status ${response.status}`);
    }

    const stream = response.body;
    if (!stream) {
      throw new Error('No stream in response');
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();

    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value);
              console.log('Received chunk:', chunk); // Log the raw chunk for debugging
              const lines = chunk.split('\n').filter((line) => line.trim() !== '');
              for (const line of lines) {
                if (line.includes('event: completion')) continue;
                if (line.includes('data: [DONE]')) {
                  controller.close();
                  return;
                }
                if (line.startsWith('data:')) {
                  try {
                    const data = JSON.parse(line.slice(5));
                    if (data.type === 'content_block_delta' && data.delta?.text) {
                      controller.enqueue(data.delta.text);
                    }
                  } catch (parseError) {
                    console.error('Error parsing JSON:', parseError, 'Line:', line);
                    controller.error(parseError);
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error in stream processing:', error);
            controller.error(error);
          }
        },
      }),
      {
        headers: {
          'Content-Type': 'text/plain',
        },
      }
    );
  } catch (error) {
    console.error('Error in chat route:', error);
    return new Response(JSON.stringify({ error: 'An error occurred processing your request' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}