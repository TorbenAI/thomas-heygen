import { NextRequest, NextResponse } from 'next/server';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    console.error('No file uploaded');
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const openaiFormData = new FormData();
    openaiFormData.append('file', new Blob([buffer], { type: file.type }), file.name);
    openaiFormData.append('model', 'whisper-1');

    console.log('Sending request to OpenAI API');
    console.log('File name:', file.name);
    console.log('File type:', file.type);
    console.log('File size:', file.size);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: openaiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API responded with ${response.status}:`, errorText);
      return NextResponse.json({ error: `OpenAI API error: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error calling Whisper API:', error);
    return NextResponse.json({ error: 'Error transcribing audio' }, { status: 500 });
  }
}