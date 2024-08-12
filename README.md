# Thomas Heygen Demo

This project demonstrates an interactive avatar powered by Heygen and Claude AI.

## Prerequisites

- An OpenAI API key
- A Heygen API key
- An Claude API key

## Setup

1. Clone the repository:
   ```
   git clone https://github.com/TorbenAI/thomas-heygen.git
   cd thomas-heygen
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env.local` file in the project root and add your API keys:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   HEYGEN_API_KEY=your_heygen_api_key_here
   CLAUDE_API_KEY=your_claude_api_key_here
   ```

## Running the project

1. Start the development server:
   ```
   npm run dev
   ```

2. Open your browser and navigate to `http://localhost:3000`

## Features

- Interactive avatar powered by Heygen
- Speech-to-text functionality using Web Speech API and OpenAI's Whisper
- Chat interface with Claude AI

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Made with Cluade