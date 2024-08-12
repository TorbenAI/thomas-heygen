const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

export async function POST() {
  try {
    if (!HEYGEN_API_KEY) {
      throw new Error("API key is missing from .env");
    }

    const options = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key': HEYGEN_API_KEY
      }
    };

    const res = await fetch(
      "https://api.heygen.com/v1/streaming.create_token",
      options
    );

    if (!res.ok) {
      throw new Error(`Heygen API responded with status ${res.status}`);
    }

    const data = await res.json();
    console.log("Heygen API response:", data);  // Log the full response for debugging

    if (!data.data || !data.data.token) {
      throw new Error("Unexpected API response structure");
    }

    return new Response(data.data.token, {
      status: 200,
    });
  } catch (error) {
    console.error("Error retrieving access token:", error);

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}