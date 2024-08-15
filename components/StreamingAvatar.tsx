import React, { useEffect, useRef, useState } from 'react';
import {
  Configuration,
  NewSessionData,
  StreamingAvatarApi,
} from "@heygen/streaming-avatar";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Divider,
  Spinner,
} from "@nextui-org/react";
import { Mic } from "lucide-react";

const PRE_CONFIGURED_AVATAR_ID = "e3bbda33f6044eb4a0e3f4a04182526c";
const PRE_CONFIGURED_VOICE_ID = "dabaf51591344a7e974a4d05b0cf9f1b";

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export default function StreamingAvatar() {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [debug, setDebug] = useState<string>();
  const [data, setData] = useState<NewSessionData>();
  const [input, setInput] = useState<string>("");
  const [initialized, setInitialized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<StreamingAvatarApi | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();
      console.log("Access Token:", token);
      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
      return "";
    }
  }

  async function startSession() {
    setIsLoadingSession(true);
    await updateToken();
    if (!avatar.current) {
      setDebug("Avatar API is not initialized");
      return;
    }
    try {
      const res = await avatar.current.createStartAvatar(
        {
          newSessionRequest: {
            quality: "high",
            avatarName: PRE_CONFIGURED_AVATAR_ID,
            voice: { voiceId: PRE_CONFIGURED_VOICE_ID },
          },
        },
        setDebug
      );
      setData(res);
      setStream(avatar.current.mediaStream);

      avatar.current.addEventHandler(
        "avatar_stop_talking",
        handleAvatarStopTalking
      );
    } catch (error) {
      console.error("Error starting avatar session:", error);
      setDebug("There was an error starting the session.");
    }
    setIsLoadingSession(false);
  }

  async function updateToken() {
    const newToken = await fetchAccessToken();
    console.log("Updating Access Token:", newToken);
    avatar.current = new StreamingAvatarApi(
      new Configuration({ accessToken: newToken, jitterBuffer: 200 })
    );
    setInitialized(true);
  }

  async function endSession() {
    if (!initialized || !avatar.current) {
      setDebug("Avatar API not initialized");
      return;
    }
    avatar.current.removeEventHandler(
      "avatar_stop_talking",
      handleAvatarStopTalking
    );
    await avatar.current.stopAvatar(
      { stopSessionRequest: { sessionId: data?.sessionId } },
      setDebug
    );
    setStream(undefined);
  }

  const handleAvatarStopTalking = () => {
    setIsLoadingChat(false);
    setDebug("Avatar stopped talking");
  };

  async function handleChat(inputText: string = input) {
    if (!initialized || !avatar.current || !inputText.trim()) {
      setDebug("Avatar API not initialized or empty input");
      return;
    }
    setIsLoadingChat(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: inputText }),
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;

        // Split the accumulated text into sentences
        const sentences = accumulatedText.match(/[^.!?]+[.!?]+/g) || [];

        if (sentences.length > 0) {
          // Speak the complete sentences
          for (const sentence of sentences) {
            await speakText(sentence.trim());
          }

          // Keep any remaining incomplete sentence
          accumulatedText = accumulatedText.slice(sentences.join('').length);
        }
      }

      // Speak any remaining text
      if (accumulatedText.trim()) {
        await speakText(accumulatedText.trim());
      }

    } catch (error) {
      console.error("Error processing chat:", error);
      setDebug(`Error processing chat request: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setInput("");
      setIsLoadingChat(false);
    }
  }

  async function speakText(text: string) {
    if (!avatar.current || !data?.sessionId) return;

    try {
      await avatar.current.speak({
        taskRequest: { text, sessionId: data.sessionId },
      });
    } catch (error) {
      console.error("Error speaking text:", error);
      setDebug("Error speaking text");
    }
  }

  const startListening = () => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      setDebug("Speech recognition is not supported in this browser.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join(' ');
      setInput(transcript);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.start();
    setIsListening(true);

    // Start recording for Whisper API
    startRecording();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);

    // Stop recording and send to Whisper API
    stopRecording();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorderRef.current.start(1000); // Collect data every second
    } catch (error) {
      console.error("Error starting audio recording:", error);
      setDebug("Error starting audio recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        await sendAudioToWhisper(audioBlob);
      };
    }
  };

  const sendAudioToWhisper = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.wav");
    formData.append("model", "whisper-1");

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription failed with status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log("Transcription result:", result);
      if (result.text) {
        setInput(result.text);
        // Automatically send the transcribed input to GPT-4o-mini
        await handleChat(result.text);
      } else {
        throw new Error("No transcription text received");
      }
    } catch (error) {
      console.error("Error transcribing audio:", error);
      setDebug(`Error transcribing audio: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  useEffect(() => {
    async function init() {
      const newToken = await fetchAccessToken();
      console.log("Initializing with Access Token:", newToken);
      avatar.current = new StreamingAvatarApi(
        new Configuration({ accessToken: newToken, jitterBuffer: 200 })
      );
      setInitialized(true);
    }
    init();

    return () => {
      endSession();
    };
  }, []);

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream
          .current!.play()
          .catch((e) => console.error("Error playing video:", e));
        setDebug("Playing");
      };
    }
  }, [stream]);

  return (
    <div className="flex flex-col h-screen bg-[#0a0d13] text-white overflow-hidden">
      <div className="flex-grow flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-4xl bg-[#1c2028] rounded-xl overflow-hidden">
          <CardBody className="p-6">
            {stream ? (
              <div className="relative w-full aspect-square rounded-lg overflow-hidden">
                <video
                  ref={mediaStream}
                  autoPlay
                  playsInline
                  className="absolute top-0 left-0 w-full h-full object-cover"
                >
                  <track kind="captions" />
                </video>
                <Button
                  size="sm"
                  onClick={endSession}
                  className="absolute top-4 right-4 bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  End Session
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px]">
                {isLoadingSession ? (
                  <Spinner size="lg" color="primary" />
                ) : (
                  <Button
                    size="lg"
                    onClick={startSession}
                    className="bg-[#7656f9] text-white hover:bg-[#6245e0] transition-colors"
                  >
                    Start Session
                  </Button>
                )}
              </div>
            )}
          </CardBody>
          <Divider />
          <CardFooter className="p-4">
            <div className="w-full">
              <label htmlFor="chatInput" className="block text-sm font-medium text-white mb-2">
                Chat with Thomas' Digital Twin
              </label>
              <div className="flex items-center">
                <input
                  id="chatInput"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoadingChat && input.trim()) {
                      handleChat();
                    }
                  }}
                  placeholder={isListening ? "Listening..." : "Type your message here..."}
                  className="flex-grow bg-[#323642] text-white placeholder-gray-400 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7656f9]"
                  disabled={!stream || isListening}
                />
                <button
                  onClick={() => handleChat()}
                  disabled={!stream || isLoadingChat || !input.trim() || isListening}
                  className="ml-2 bg-[#7656f9] text-white hover:bg-[#6245e0] transition-colors rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#7656f9] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingChat ? <Spinner size="sm" color="white" /> : "Send"}
                </button>
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={!stream || isLoadingChat}
                  className={`ml-2 ${isListening ? 'bg-red-500' : 'bg-[#7656f9]'} text-white hover:bg-opacity-90 transition-colors rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#7656f9] disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Mic size={20} />
                </button>
              </div>
            </div>
          </CardFooter>
        </Card>
        {debug && (
          <div className="mt-4 p-4 bg-[#1c2028] rounded-xl w-full max-w-4xl">
            <h3 className="font-semibold mb-2">Debug Console:</h3>
            <pre className="font-mono text-sm whitespace-pre-wrap text-gray-300">{debug}</pre>
          </div>
        )}
      </div>
    </div>
  );
}