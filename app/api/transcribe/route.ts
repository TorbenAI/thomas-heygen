import { NextRequest, NextResponse } from 'next/server';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'multipart/form-data',
      },
      body: createFormData(buffer, file.name),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error calling Whisper API:', error);
    return NextResponse.json({ error: 'Error transcribing audio' }, { status: 500 });
  }
}

function createFormData(buffer: Buffer, filename: string) {
  const form = new FormData();
  const blob = new Blob([buffer], { type: 'audio/wav' });
  form.append('file', blob, filename);
  form.append('model', 'whisper-1');
  return form;
}