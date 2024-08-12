"use client";

import StreamingAvatar from "@/components/StreamingAvatar";

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Heygen Claude Avatar</h1>
      <StreamingAvatar />
    </div>
  );
}